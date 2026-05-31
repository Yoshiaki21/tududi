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

function isAuthorizedMatrixUser(user, sender) {
    const raw = user.matrix_allowed_users;
    if (!raw || raw.trim() === '') return true;

    const allowed = raw
        .split(',')
        .map((u) => u.trim().toLowerCase())
        .filter((u) => u.length > 0);

    if (allowed.length === 0) return true;
    return allowed.includes(sender.toLowerCase());
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

async function processMessage(user, { roomId, text, sender, eventId }) {
    if (!isAuthorizedMatrixUser(user, sender)) {
        console.log(`Matrix: ignoring unauthorized sender ${sender} for user ${user.id}`);
        return;
    }

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

                // Only process messages in the configured room if set
                if (currentUser.matrix_room_id && roomId !== currentUser.matrix_room_id) return;

                // Ignore own messages
                if (currentUser.matrix_bot_user_id && event.sender === currentUser.matrix_bot_user_id) return;

                // Ignore non-text messages
                if (event.type !== 'm.room.message') return;
                if (event.content?.msgtype !== 'm.text') return;

                // Deduplicate
                if (seen.has(event.event_id)) return;
                seen.add(event.event_id);

                // Keep seen set bounded
                if (seen.size > 1000) {
                    const oldest = Array.from(seen).slice(0, 100);
                    oldest.forEach((id) => seen.delete(id));
                }

                const text = event.content?.body;
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

        // E2EE: 招待を自動承諾してデバイスキー交換を完了させる
        client.on('room.invite', async (roomId) => {
            try {
                await client.joinRoom(roomId);
            } catch (err) {
                console.error(`Matrix: failed to join room ${roomId} for user ${user.id}:`, err.message);
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

async function stop(userId) {
    // 型を整数に統一（APIから文字列で渡される場合があるため）
    const numericId = Number(userId);
    pendingRetries.delete(numericId); // リトライ待機中もキャンセル

    const client = activeClients.get(numericId);
    if (!client) return;

    try {
        await client.stop();
    } catch (_) {}

    activeClients.delete(numericId);
    processedEvents.delete(numericId);
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

module.exports = { start, stop, getStatus, sendMatrixMessage };
