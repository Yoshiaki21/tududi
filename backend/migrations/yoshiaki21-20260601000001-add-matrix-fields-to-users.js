'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'users', [
            {
                name: 'matrix_homeserver_url',
                definition: {
                    type: Sequelize.STRING,
                    allowNull: true,
                    comment: 'Matrix homeserver URL (e.g. https://matrix.example.com)',
                },
            },
            {
                name: 'matrix_access_token',
                definition: {
                    type: Sequelize.STRING,
                    allowNull: true,
                    comment: 'Matrix bot account access token',
                },
            },
            {
                name: 'matrix_room_id',
                definition: {
                    type: Sequelize.STRING,
                    allowNull: true,
                    comment: 'Matrix room ID for receiving and sending messages (e.g. !xxx:homeserver)',
                },
            },
            {
                name: 'matrix_bot_user_id',
                definition: {
                    type: Sequelize.STRING,
                    allowNull: true,
                    comment: 'Matrix bot user ID (e.g. @tududi-bot:homeserver)',
                },
            },
            {
                name: 'matrix_allowed_users',
                definition: {
                    type: Sequelize.TEXT,
                    allowNull: true,
                    comment: 'Comma-separated list of allowed Matrix user IDs',
                },
            },
        ]);
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('users', 'matrix_homeserver_url');
        await queryInterface.removeColumn('users', 'matrix_access_token');
        await queryInterface.removeColumn('users', 'matrix_room_id');
        await queryInterface.removeColumn('users', 'matrix_bot_user_id');
        await queryInterface.removeColumn('users', 'matrix_allowed_users');
    },
};
