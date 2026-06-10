'use strict';

const { User } = require('../../models');
const matrixPoller = require('./matrixPoller');
const matrixNotificationService = require('./matrixNotificationService');
const { logError } = require('../../services/logService');
const { getAuthenticatedUserId } = require('../../utils/request-utils');

const matrixController = {
    async saveSettings(req, res) {
        try {
            const userId = getAuthenticatedUserId(req);
            if (!userId) return res.status(401).json({ error: 'Authentication required' });

            const {
                matrix_homeserver_url,
                matrix_access_token,
                matrix_room_id,
                matrix_bot_user_id,
            } = req.body;

            const user = await User.findByPk(userId);
            if (!user) return res.status(404).json({ error: 'User not found' });

            const updates = {
                matrix_homeserver_url: matrix_homeserver_url || null,
                matrix_room_id: matrix_room_id || null,
                matrix_bot_user_id: matrix_bot_user_id || null,
            };

            // Only update access token when a new value is explicitly provided
            if (matrix_access_token && matrix_access_token !== '***') {
                updates.matrix_access_token = matrix_access_token;
            }

            await user.update(updates);

            res.json({ success: true, message: 'Matrix settings saved' });
        } catch (error) {
            logError('Matrix: error saving settings:', error);
            res.status(500).json({ error: 'Failed to save Matrix settings' });
        }
    },

    async getSettings(req, res) {
        try {
            const userId = getAuthenticatedUserId(req);
            if (!userId) return res.status(401).json({ error: 'Authentication required' });

            const user = await User.findByPk(userId);
            if (!user) return res.status(404).json({ error: 'User not found' });

            res.json({
                matrix_homeserver_url: user.matrix_homeserver_url || '',
                matrix_access_token: user.matrix_access_token ? '***' : '',
                matrix_room_id: user.matrix_room_id || '',
                matrix_bot_user_id: user.matrix_bot_user_id || '',
                configured: !!(user.matrix_homeserver_url && user.matrix_access_token && user.matrix_bot_user_id),
            });
        } catch (error) {
            logError('Matrix: error getting settings:', error);
            res.status(500).json({ error: 'Failed to get Matrix settings' });
        }
    },

    async startPolling(req, res) {
        try {
            const userId = getAuthenticatedUserId(req);
            if (!userId) return res.status(401).json({ error: 'Authentication required' });

            const user = await User.findByPk(userId);
            if (!user || !user.matrix_access_token) {
                return res.status(400).json({ error: 'Matrix not configured' });
            }

            await matrixPoller.start(userId);
            res.json({ success: true, status: matrixPoller.getStatus() });
        } catch (error) {
            logError('Matrix: error starting polling:', error);
            res.status(500).json({ error: 'Failed to start Matrix polling' });
        }
    },

    async stopPolling(req, res) {
        try {
            const userId = getAuthenticatedUserId(req);
            if (!userId) return res.status(401).json({ error: 'Authentication required' });

            await matrixPoller.stop(userId);
            res.json({ success: true, status: matrixPoller.getStatus() });
        } catch (error) {
            logError('Matrix: error stopping polling:', error);
            res.status(500).json({ error: 'Failed to stop Matrix polling' });
        }
    },

    async getPollingStatus(req, res) {
        try {
            res.json({ success: true, status: matrixPoller.getStatus() });
        } catch (error) {
            logError('Matrix: error getting polling status:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    async testConnection(req, res) {
        try {
            const userId = getAuthenticatedUserId(req);
            if (!userId) return res.status(401).json({ error: 'Authentication required' });

            const user = await User.findByPk(userId);
            if (!user || !user.matrix_homeserver_url || !user.matrix_access_token) {
                return res.status(400).json({ error: 'Matrix integration is not configured' });
            }

            const { MatrixClient } = require('matrix-bot-sdk');
            const client = new MatrixClient(user.matrix_homeserver_url, user.matrix_access_token);
            const whoami = await client.getWhoAmI();

            res.json({ success: true, userId: whoami.user_id, homeserver: user.matrix_homeserver_url });
        } catch (error) {
            logError('Matrix: connection test failed:', error);
            const statusCode = error.statusCode === 401 || error.statusCode === 403 ? 401 : 500;
            res.status(statusCode).json({
                error: error.errcode === 'M_UNKNOWN_TOKEN' || error.statusCode === 401 || error.statusCode === 403
                    ? 'Access token is invalid or expired. Please regenerate it.'
                    : `Connection failed: ${error.message}`,
                errcode: error.errcode,
            });
        }
    },

    async testSummary(req, res) {
        try {
            const userId = getAuthenticatedUserId(req);
            if (!userId) return res.status(401).json({ error: 'Authentication required' });

            const user = await User.findByPk(userId);
            if (!user) return res.status(404).json({ error: 'User not found' });

            if (!user.matrix_access_token || !user.matrix_room_id) {
                return res.status(400).json({ error: 'Matrix integration is not configured' });
            }

            await matrixNotificationService.sendMessage(
                user.matrix_homeserver_url,
                user.matrix_access_token,
                user.matrix_room_id,
                '📋 This is a test summary from tududi!',
                user.id
            );

            res.json({ success: true });
        } catch (error) {
            logError('Matrix: error sending test summary:', error);
            res.status(500).json({ error: error.message });
        }
    },
};

module.exports = matrixController;
