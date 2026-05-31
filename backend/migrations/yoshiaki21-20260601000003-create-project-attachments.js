'use strict';

const { safeCreateTable, safeAddIndex } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeCreateTable(queryInterface, 'project_attachments', {
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
            project_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'projects',
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

        await safeAddIndex(queryInterface, 'project_attachments', ['project_id'], {
            name: 'project_attachments_project_id',
        });
        await safeAddIndex(queryInterface, 'project_attachments', ['user_id'], {
            name: 'project_attachments_user_id',
        });
        await safeAddIndex(queryInterface, 'project_attachments', ['uid'], {
            name: 'project_attachments_uid',
            unique: true,
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('project_attachments');
    },
};
