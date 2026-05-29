'use strict';

const matrixPoller = require('./matrixPoller');
const { User } = require('../../models');
const { getConfig } = require('../../config/config');
const { Op } = require('sequelize');

async function initializeMatrixPolling() {
    const config = getConfig();
    if (config.environment === 'test') return;

    const startupDelay = 10000;

    setTimeout(async () => {
        try {
            const users = await User.findAll({
                where: {
                    matrix_access_token: { [Op.ne]: null },
                    matrix_homeserver_url: { [Op.ne]: null },
                },
            });

            if (users.length > 0) {
                console.log(`Matrix: initializing polling for ${users.length} user(s)...`);
                for (const user of users) {
                    await matrixPoller.start(user);
                }
            }
        } catch (error) {
            console.error('Matrix: error during initialization:', error.message);
        }
    }, startupDelay);
}

module.exports = { initializeMatrixPolling };
