'use strict';

const { sendMatrixMessage } = require('./matrixPoller');

function isMatrixConfigured(user) {
    return !!(
        user &&
        user.matrix_homeserver_url &&
        user.matrix_access_token &&
        user.matrix_room_id
    );
}

function formatNotificationMessage(user, notification) {
    const { title, message } = notification;
    const userName = user.name || 'there';
    return `${userName}, ${message || title}`;
}

async function sendMatrixNotification(user, notification) {
    try {
        if (!isMatrixConfigured(user)) {
            return { success: false, error: 'Matrix not configured for user' };
        }

        const formattedMessage = formatNotificationMessage(user, notification);
        await sendMatrixMessage(
            user.matrix_homeserver_url,
            user.matrix_access_token,
            user.matrix_room_id,
            formattedMessage,
            user.id
        );

        return { success: true };
    } catch (error) {
        console.error('Matrix: failed to send notification:', error);
        return { success: false, error: error.message || 'Unknown error' };
    }
}

module.exports = {
    isMatrixConfigured,
    formatNotificationMessage,
    sendMatrixNotification,
    sendMessage: sendMatrixMessage,
};
