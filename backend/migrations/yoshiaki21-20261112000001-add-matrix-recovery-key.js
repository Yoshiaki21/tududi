'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'users', [
            {
                name: 'matrix_recovery_key',
                definition: {
                    type: Sequelize.TEXT,
                    allowNull: true,
                    comment:
                        'Matrix bot recovery key (Security Key), encrypted with secretCipher',
                },
            },
        ]);
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('users', 'matrix_recovery_key');
    },
};
