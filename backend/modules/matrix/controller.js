'use strict';

const { User } = require('../../models');
const matrixPoller = require('./matrixPoller');
const matrixNotificationService = require('./matrixNotificationService');
const crossSigning = require('./crossSigning');
const secretCipher = require('../../shared/crypto/secretCipher');
const { logError } = require('../../services/logService');
const { getAuthenticatedUserId } = require('../../utils/request-utils');

const matrixController = {
    async saveSettings(req, res) {
        try {
            const userId = getAuthenticatedUserId(req);
            if (!userId)
                return res
                    .status(401)
                    .json({ error: 'Authentication required' });

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
            if (!userId)
                return res
                    .status(401)
                    .json({ error: 'Authentication required' });

            const user = await User.findByPk(userId);
            if (!user) return res.status(404).json({ error: 'User not found' });

            res.json({
                matrix_homeserver_url: user.matrix_homeserver_url || '',
                matrix_access_token: user.matrix_access_token ? '***' : '',
                matrix_room_id: user.matrix_room_id || '',
                matrix_bot_user_id: user.matrix_bot_user_id || '',
                recovery_key_set: !!user.matrix_recovery_key,
                configured: !!(
                    user.matrix_homeserver_url &&
                    user.matrix_access_token &&
                    user.matrix_bot_user_id
                ),
            });
        } catch (error) {
            logError('Matrix: error getting settings:', error);
            res.status(500).json({ error: 'Failed to get Matrix settings' });
        }
    },

    async startPolling(req, res) {
        try {
            const userId = getAuthenticatedUserId(req);
            if (!userId)
                return res
                    .status(401)
                    .json({ error: 'Authentication required' });

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
            if (!userId)
                return res
                    .status(401)
                    .json({ error: 'Authentication required' });

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
            if (!userId)
                return res
                    .status(401)
                    .json({ error: 'Authentication required' });

            const user = await User.findByPk(userId);
            if (
                !user ||
                !user.matrix_homeserver_url ||
                !user.matrix_access_token
            ) {
                return res
                    .status(400)
                    .json({ error: 'Matrix integration is not configured' });
            }

            const { MatrixClient } = require('@vector-im/matrix-bot-sdk');
            const client = new MatrixClient(
                user.matrix_homeserver_url,
                user.matrix_access_token
            );
            const whoami = await client.getWhoAmI();

            res.json({
                success: true,
                userId: whoami.user_id,
                homeserver: user.matrix_homeserver_url,
            });
        } catch (error) {
            logError('Matrix: connection test failed:', error);
            const statusCode =
                error.statusCode === 401 || error.statusCode === 403
                    ? 401
                    : 500;
            res.status(statusCode).json({
                error:
                    error.errcode === 'M_UNKNOWN_TOKEN' ||
                    error.statusCode === 401 ||
                    error.statusCode === 403
                        ? 'Access token is invalid or expired. Please regenerate it.'
                        : `Connection failed: ${error.message}`,
                errcode: error.errcode,
            });
        }
    },

    async testSummary(req, res) {
        try {
            const userId = getAuthenticatedUserId(req);
            if (!userId)
                return res
                    .status(401)
                    .json({ error: 'Authentication required' });

            const user = await User.findByPk(userId);
            if (!user) return res.status(404).json({ error: 'User not found' });

            if (!user.matrix_access_token || !user.matrix_room_id) {
                return res
                    .status(400)
                    .json({ error: 'Matrix integration is not configured' });
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

    // --- クロス署名（bot デバイスのセルフ検証） ---

    async getCrossSigningStatus(req, res) {
        try {
            const user = await findCurrentUser(req, res);
            if (!user) return;
            const client = matrixPoller.getActiveClient(user.id);
            res.json(await crossSigning.getStatus(client, user));
        } catch (error) {
            logError('Matrix: error getting cross-signing status:', error);
            res.status(500).json({
                error: 'Failed to get cross-signing status',
            });
        }
    },

    async saveRecoveryKey(req, res) {
        try {
            const user = await findCurrentUser(req, res);
            if (!user) return;

            const recoveryKey =
                typeof req.body?.recovery_key === 'string'
                    ? req.body.recovery_key.trim()
                    : '';
            if (!recoveryKey) {
                return res
                    .status(400)
                    .json({ error: 'Recovery key is required' });
            }
            if (!secretCipher.hasKeyMaterial()) {
                return res.status(400).json({
                    error: 'Set TUDUDI_SESSION_SECRET (or TUDUDI_OIDC_SECRET_ENCRYPTION_KEY) to store the recovery key encrypted',
                });
            }

            await user.update({
                matrix_recovery_key:
                    crossSigning.encryptRecoveryKey(recoveryKey),
            });

            // クライアントが動いていればすぐ検証する
            const client = matrixPoller.getActiveClient(user.id);
            if (client) await crossSigning.confirmIdentity(client, user);
            res.json(await crossSigning.getStatus(client, user));
        } catch (error) {
            logError('Matrix: error saving recovery key:', error);
            res.status(500).json({ error: 'Failed to save recovery key' });
        }
    },

    async deleteRecoveryKey(req, res) {
        try {
            const user = await findCurrentUser(req, res);
            if (!user) return;
            await user.update({ matrix_recovery_key: null });
            crossSigning.clearLastResult(user.id);
            const client = matrixPoller.getActiveClient(user.id);
            res.json(await crossSigning.getStatus(client, user));
        } catch (error) {
            logError('Matrix: error deleting recovery key:', error);
            res.status(500).json({ error: 'Failed to delete recovery key' });
        }
    },

    async verifyDevice(req, res) {
        try {
            const user = await findCurrentUser(req, res);
            if (!user) return;
            const client = matrixPoller.getActiveClient(user.id);
            if (!client) {
                return res.status(400).json({
                    error: 'Start Matrix polling before verifying the device',
                });
            }
            await crossSigning.confirmIdentity(client, user);
            res.json(await crossSigning.getStatus(client, user));
        } catch (error) {
            logError('Matrix: error verifying device:', error);
            res.status(500).json({ error: 'Failed to verify device' });
        }
    },

    async createIdentity(req, res) {
        try {
            const user = await findCurrentUser(req, res);
            if (!user) return;
            const client = matrixPoller.getActiveClient(user.id);
            if (!client) {
                return res.status(400).json({
                    error: 'Start Matrix polling before setting up cross-signing',
                });
            }
            if (!secretCipher.hasKeyMaterial()) {
                return res.status(400).json({
                    error: 'Set TUDUDI_SESSION_SECRET (or TUDUDI_OIDC_SECRET_ENCRYPTION_KEY) to store the recovery key encrypted',
                });
            }

            const recoveryKey = await crossSigning.createIdentity(client, user);
            await user.update({
                matrix_recovery_key:
                    crossSigning.encryptRecoveryKey(recoveryKey),
            });
            res.json({
                recovery_key: recoveryKey,
                status: await crossSigning.getStatus(client, user),
            });
        } catch (error) {
            logError('Matrix: error creating cross-signing identity:', error);
            res.status(400).json({ error: error.message });
        }
    },
};

async function findCurrentUser(req, res) {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return null;
    }
    const user = await User.findByPk(userId);
    if (!user) {
        res.status(404).json({ error: 'User not found' });
        return null;
    }
    return user;
}

module.exports = matrixController;
