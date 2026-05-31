'use strict';

const { safeCreateTable, safeAddIndex } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeCreateTable(queryInterface, 'note_attachments', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            uid: {
                type: Sequelize.STRING,
                allowNull: false,
                unique: true,
            },
            note_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'notes',
                    key: 'id',
                },
                onDelete: 'CASCADE',
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
                },
            },
            original_filename: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            stored_filename: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            file_size: {
                type: Sequelize.INTEGER,
                allowNull: false,
            },
            mime_type: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            file_path: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
        });

        await safeAddIndex(queryInterface, 'note_attachments', ['note_id'], {
            name: 'note_attachments_note_id',
        });
        await safeAddIndex(queryInterface, 'note_attachments', ['user_id'], {
            name: 'note_attachments_user_id',
        });
        await safeAddIndex(queryInterface, 'note_attachments', ['uid'], {
            name: 'note_attachments_uid',
            unique: true,
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('note_attachments');
    },
};
