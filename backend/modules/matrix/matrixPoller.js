'use strict';

const { createMatrixClient } = require('./matrixClient');
const { InboxItem, User } = require('../../models');
const { Op } = require('sequelize');

// userId -> MatrixClient
const activeClients = new Map();

// Per-client processed event IDs to prevent duplicate processing
const processedEvents = new Map(); // userId -> Set<event_id>

// リトライ待機中のユーザーID（重複リトライ防止）
const pendingRetries = new Set();

// 既にキー要求済みのセッション（重複リクエスト防止）
const requestedSessions = new Map(); // userId -> Set<`${roomId}:${sessionId}`>

function extractCleanText(event) {
    const body = event.content?.body;
    const formattedBody = event.content?.formatted_body;

    if (formattedBody && event.content?.format === 'org.matrix.custom.html') {
        const cleaned = formattedBody
            .replace(/<a href="https:\/\/matrix\.to\/#\/@[^"]*">[^<]*<\/a>/g, '')
            .replace(/<[^>]*>/g, '')
            .replace(/^[:\s]+/, '')
            .trim();
        return cleaned || body;
    }

    return body;
}

function isBotMentioned(event, botUserId) {
    if (!botUserId) return false;

    // Modern Matrix spec: m.mentions (Matrix 1.7+)
    const mentions = event.content?.['m.mentions'];
    if (mentions?.user_ids?.includes(botUserId)) return true;

    // Fallback: formatted_body HTML pill
    const formattedBody = event.content?.formatted_body;
    if (formattedBody && formattedBody.includes(`https://matrix.to/#/${botUserId}`)) return true;

    // Last resort: plain body contains the bot user ID
    const body = event.content?.body;
    if (body && body.toLowerCase().includes(botUserId.toLowerCase())) return true;

    return false;
}

async function createInboxItem(content, userId) {
    const recentCutoff = new Date(Date.now() - 30000);
    const existing = await InboxItem.findOne({
        where: {
            content,
            user_id: userId,
            source: 'matrix',
            created_at: { [Op.gte]: recentCutoff },
        },
    });
    if (existing) return existing;

    return InboxItem.create({ content, source: 'matrix', user_id: userId });
}

async function sendMatrixMessage(homeserverUrl, accessToken, roomId, message, userId = null) {
    // userId が指定されている場合、E2EE対応のアクティブクライアントを使用する
    if (userId != null) {
        const activeClient = activeClients.get(Number(userId));
        if (activeClient) {
            await activeClient.sendMessage(roomId, {
                msgtype: 'm.text',
                body: message,
            });
            return;
        }
    }
    // フォールバック: 新規クライアントで送信（非暗号化ルーム用）
    const { MatrixClient } = require('matrix-bot-sdk');
    const client = new MatrixClient(homeserverUrl, accessToken);
    await client.sendMessage(roomId, {
        msgtype: 'm.text',
        body: message,
    });
}

async function handleBotCommand(command, user, roomId) {
    const { homeserverUrl, accessToken } = {
        homeserverUrl: user.matrix_homeserver_url,
        accessToken: user.matrix_access_token,
    };

    switch (command.toLowerCase()) {
        case '/start':
        case '/help':
            await sendMatrixMessage(
                homeserverUrl,
                accessToken,
                roomId,
                'Welcome to tududi!\n\nSend me any text and I\'ll add it to your inbox.\n\nCommands:\n/help - Show this message',
                user.id
            );
            break;
        default:
            await sendMatrixMessage(
                homeserverUrl,
                accessToken,
                roomId,
                `Unknown command: ${command}\n\nUse /help to see available commands.`,
                user.id
            );
    }
}

async function requestMissingRoomKey(client, user, roomId, encryptedEvent) {
    const sender = encryptedEvent.sender;
    const sessionId = encryptedEvent.content?.session_id;
    const algorithm = encryptedEvent.content?.algorithm;

    if (!sender || !sessionId || !algorithm) return false;
    if (user.matrix_bot_user_id && sender === user.matrix_bot_user_id) return false;

    let userSessions = requestedSessions.get(user.id);
    if (!userSessions) {
        userSessions = new Set();
        requestedSessions.set(user.id, userSessions);
    }

    const sessionKey = `${roomId}:${sessionId}`;
    if (userSessions.has(sessionKey)) return false;
    userSessions.add(sessionKey);

    if (userSessions.size > 200) {
        const oldest = Array.from(userSessions).slice(0, 50);
        oldest.forEach((k) => userSessions.delete(k));
    }

    try {
        const whoami = await client.getWhoAmI();
        const botDeviceId = whoami.device_id;
        if (!botDeviceId) return false;

        const requestId = `tududi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const keyRequestBody = {
            action: 'request',
            body: { algorithm, room_id: roomId, session_id: sessionId },
            request_id: requestId,
            requesting_device_id: botDeviceId,
        };
        if (encryptedEvent.content?.sender_key) {
            keyRequestBody.body.sender_key = encryptedEvent.content.sender_key;
        }

        const botUserId = whoami.user_id;
        const recipients = { [sender]: { '*': keyRequestBody } };
        if (botUserId && botUserId !== sender) {
            recipients[botUserId] = { '*': keyRequestBody };
        }
        await client.sendToDevices('m.room_key_request', recipients);

        console.log(`Matrix: sent key request for session ${sessionId} to ${sender} and ${botUserId}`);
        return true;
    } catch (error) {
        console.error(`Matrix: key request failed:`, error.message);
        userSessions.delete(sessionKey);
        return false;
    }
}

async function processMessage(user, { roomId, text, sender, eventId }) {
    try {
        if (text.startsWith('/')) {
            await handleBotCommand(text, user, roomId);
            return;
        }

        await createInboxItem(text, user.id);

        await sendMatrixMessage(
            user.matrix_homeserver_url,
            user.matrix_access_token,
            roomId,
            `Added to tududi inbox: "${text}"`,
            user.id
        );

        console.log(`Matrix: processed message for user ${user.id}: "${text}"`);
    } catch (error) {
        console.error(`Matrix: error processing message for user ${user.id}:`, error.message);
        await sendMatrixMessage(
            user.matrix_homeserver_url,
            user.matrix_access_token,
            roomId,
            `Failed to add to inbox: ${error.message}`,
            user.id
        ).catch(() => {});
    }
}

async function start(userId) {
    // 型を整数に統一（stop() との型不一致を防ぐ）
    const numericId = Number(userId);
    // DB から最新の設定を取得（Room ID 等の変更が即反映される）
    const user = await User.findByPk(numericId);
    if (!user || !user.matrix_homeserver_url || !user.matrix_access_token) {
        console.log(`Matrix: skipping user ${numericId} - missing config`);
        return;
    }

    // user.id（整数）を一貫して使用してキー型不整合を防ぐ
    if (activeClients.has(user.id)) return;

    try {
        const client = createMatrixClient(
            user.matrix_homeserver_url,
            user.matrix_access_token,
            user.id
        );

        const seen = new Set();
        processedEvents.set(user.id, seen);

        client.on('room.message', async (roomId, event) => {
            try {
                // 毎回 DB から最新設定を取得（Room ID 変更を即反映）
                const currentUser = await User.findByPk(user.id);
                if (!currentUser) return;

                // Ignore own messages
                if (currentUser.matrix_bot_user_id && event.sender === currentUser.matrix_bot_user_id) return;

                // Ignore non-text messages
                if (event.type !== 'm.room.message') return;
                if (event.content?.msgtype !== 'm.text') return;

                // Only process messages that mention the bot
                if (!isBotMentioned(event, currentUser.matrix_bot_user_id)) return;

                // Log which room the message came from to aid E2EE diagnostics
                const isConfiguredRoom = currentUser.matrix_room_id && roomId === currentUser.matrix_room_id;
                console.log(`Matrix: message received in ${roomId}${isConfiguredRoom ? ' [configured room]' : ''} from ${event.sender}`);

                // Deduplicate
                if (seen.has(event.event_id)) return;
                seen.add(event.event_id);

                // Keep seen set bounded
                if (seen.size > 1000) {
                    const oldest = Array.from(seen).slice(0, 100);
                    oldest.forEach((id) => seen.delete(id));
                }

                const text = extractCleanText(event);
                if (!text) return;

                await processMessage(currentUser, {
                    roomId,
                    text,
                    sender: event.sender,
                    eventId: event.event_id,
                });
            } catch (err) {
                console.error(`Matrix: event handler error for user ${user.id}:`, err.message);
            }
        });

        client.on('room.failed_decryption', async (roomId, event, _err) => {
            try {
                const currentUser = await User.findByPk(user.id);
                if (!currentUser) return;

                console.log(`Matrix: decryption failed in ${roomId} event ${event.event_id} from ${event.sender}: ${_err?.message}`);

                // 設定済みルーム以外は無視
                if (!currentUser.matrix_room_id || roomId !== currentUser.matrix_room_id) return;

                // 自分自身のメッセージは無視
                if (currentUser.matrix_bot_user_id && event.sender === currentUser.matrix_bot_user_id) return;

                const isNewRequest = await requestMissingRoomKey(client, currentUser, roomId, event);
                if (isNewRequest) {
                    await sendMatrixMessage(
                        currentUser.matrix_homeserver_url,
                        currentUser.matrix_access_token,
                        roomId,
                        '⚠️ メッセージを復号できませんでした。\n暗号化キーの共有リクエストを送信しました。Elementの通知から「共有する」を承認してください。\n（承認は同じキーが使われている間は1回のみ必要です）',
                        user.id
                    );
                }
            } catch (err) {
                console.error(`Matrix: failed_decryption handler error for user ${user.id}:`, err.message);
            }
        });

        await client.start();

        activeClients.set(user.id, client);
        console.log(`Matrix: started client for user ${user.id}`);
    } catch (error) {
        console.error(`Matrix: failed to start client for user ${user.id}:`, error.message);
        // クリーンアップ
        processedEvents.delete(user.id);

        // 一時的なサーバーエラー（5xx）の場合は60秒後にリトライ
        const isTransient = error.statusCode >= 500 || error.errcode === 'M_UNKNOWN';
        if (isTransient && !pendingRetries.has(user.id)) {
            pendingRetries.add(user.id);
            console.log(`Matrix: will retry start for user ${user.id} in 60 seconds`);
            setTimeout(async () => {
                pendingRetries.delete(user.id);
                await start(user.id);
            }, 60000);
        }
    }
}

function closeMachine(client) {
    try {
        // matrix-bot-sdk does not call machine.close() in client.stop(), so we do
        // it explicitly to prevent a Rust/Tokio runtime panic on process exit.
        const machine = client.crypto?.engine?.machine;
        if (machine && typeof machine.close === 'function') {
            machine.close();
        }
    } catch (_) {}
}

async function stop(userId) {
    // 型を整数に統一（APIから文字列で渡される場合があるため）
    const numericId = Number(userId);
    pendingRetries.delete(numericId); // リトライ待機中もキャンセル

    const client = activeClients.get(numericId);
    if (!client) return;

    closeMachine(client);
    try {
        await client.stop();
    } catch (_) {}

    activeClients.delete(numericId);
    processedEvents.delete(numericId);
    requestedSessions.delete(numericId);
    // crypto ストレージのロック解放を待つ（新クライアントとの競合防止）
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log(`Matrix: stopped client for user ${numericId}`);
}

function getStatus() {
    return {
        running: activeClients.size > 0,
        usersCount: activeClients.size,
        userIds: Array.from(activeClients.keys()),
    };
}

// Close all OlmMachines on process exit to avoid Rust/Tokio runtime panic.
process.once('exit', () => {
    for (const [, client] of activeClients) {
        closeMachine(client);
    }
});

module.exports = { start, stop, getStatus, sendMatrixMessage };
