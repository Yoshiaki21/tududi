'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'users', [
            {
                name: 'default_unit_price',
                definition: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    defaultValue: 25000,
                },
            },
        ]);
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('users', 'default_unit_price');
    },
};
