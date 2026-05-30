'use strict';

const { createMatrixClient } = require('./matrixClient');
const { InboxItem } = require('../../models');
const { Op } = require('sequelize');

// userId -> MatrixClient
const activeClients = new Map();

// Per-client processed event IDs to prevent duplicate processing
const processedEvents = new Map(); // userId -> Set<event_id>

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

async function sendMatrixMessage(homeserverUrl, accessToken, roomId, message) {
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
                'Welcome to tududi!\n\nSend me any text and I\'ll add it to your inbox.\n\nCommands:\n/help - Show this message'
            );
            break;
        default:
            await sendMatrixMessage(
                homeserverUrl,
                accessToken,
                roomId,
                `Unknown command: ${command}\n\nUse /help to see available commands.`
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
            `Added to tududi inbox: "${text}"`
        );

        console.log(`Matrix: processed message for user ${user.id}: "${text}"`);
    } catch (error) {
        console.error(`Matrix: error processing message for user ${user.id}:`, error.message);
        await sendMatrixMessage(
            user.matrix_homeserver_url,
            user.matrix_access_token,
            roomId,
            `Failed to add to inbox: ${error.message}`
        ).catch(() => {});
    }
}

async function start(user) {
    if (activeClients.has(user.id)) return;

    if (!user.matrix_homeserver_url || !user.matrix_access_token) {
        console.log(`Matrix: skipping user ${user.id} - missing config`);
        return;
    }

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
                // Only process messages in the configured room if set
                if (user.matrix_room_id && roomId !== user.matrix_room_id) return;

                // Ignore own messages
                if (user.matrix_bot_user_id && event.sender === user.matrix_bot_user_id) return;

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

                await processMessage(user, {
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

        // E2EE: デバイスキーをサーバーに登録（初回のみ実行される）
        try {
            await client.crypto.uploadDeviceKeys();
            console.log(`Matrix: device keys uploaded for user ${user.id}`);
        } catch (err) {
            console.error(`Matrix: failed to upload device keys for user ${user.id}:`, err.message);
        }

        activeClients.set(user.id, client);
        console.log(`Matrix: started client for user ${user.id}`);
    } catch (error) {
        console.error(`Matrix: failed to start client for user ${user.id}:`, error.message);
    }
}

async function stop(userId) {
    const client = activeClients.get(userId);
    if (!client) return;

    try {
        await client.stop();
    } catch (_) {}

    activeClients.delete(userId);
    processedEvents.delete(userId);
    console.log(`Matrix: stopped client for user ${userId}`);
}

function getStatus() {
    return {
        running: activeClients.size > 0,
        usersCount: activeClients.size,
        userIds: Array.from(activeClients.keys()),
    };
}

module.exports = { start, stop, getStatus, sendMatrixMessage };
