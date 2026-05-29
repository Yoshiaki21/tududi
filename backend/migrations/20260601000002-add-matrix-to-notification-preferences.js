'use strict';

const { safeChangeColumn } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        const [users] = await queryInterface.sequelize.query(
            'SELECT id, notification_preferences FROM users WHERE notification_preferences IS NOT NULL'
        );

        for (const user of users) {
            let prefs = user.notification_preferences;
            while (typeof prefs === 'string') {
                prefs = JSON.parse(prefs);
            }

            if (prefs.dueTasks) {
                prefs.dueTasks.matrix = false;
            }
            if (prefs.overdueTasks) {
                prefs.overdueTasks.matrix = false;
            }
            if (prefs.dueProjects) {
                prefs.dueProjects.matrix = false;
            }
            if (prefs.overdueProjects) {
                prefs.overdueProjects.matrix = false;
            }
            if (prefs.deferUntil) {
                prefs.deferUntil.matrix = false;
            }

            await queryInterface.sequelize.query(
                'UPDATE users SET notification_preferences = :prefs WHERE id = :id',
                {
                    replacements: {
                        prefs: JSON.stringify(prefs),
                        id: user.id,
                    },
                }
            );
        }

        await safeChangeColumn(
            queryInterface,
            'users',
            'notification_preferences',
            {
                type: Sequelize.JSON,
                allowNull: true,
                defaultValue: {
                    dueTasks: {
                        inApp: true,
                        email: false,
                        push: false,
                        telegram: false,
                        matrix: false,
                    },
                    overdueTasks: {
                        inApp: true,
                        email: false,
                        push: false,
                        telegram: false,
                        matrix: false,
                    },
                    dueProjects: {
                        inApp: true,
                        email: false,
                        push: false,
                        telegram: false,
                        matrix: false,
                    },
                    overdueProjects: {
                        inApp: true,
                        email: false,
                        push: false,
                        telegram: false,
                        matrix: false,
                    },
                    deferUntil: {
                        inApp: true,
                        email: false,
                        push: false,
                        telegram: false,
                        matrix: false,
                    },
                },
                comment:
                    'User notification channel preferences for different notification types',
            }
        );
    },

    async down(queryInterface, Sequelize) {
        const [users] = await queryInterface.sequelize.query(
            'SELECT id, notification_preferences FROM users WHERE notification_preferences IS NOT NULL'
        );

        for (const user of users) {
            let prefs = user.notification_preferences;
            while (typeof prefs === 'string') {
                prefs = JSON.parse(prefs);
            }

            if (prefs.dueTasks) {
                delete prefs.dueTasks.matrix;
            }
            if (prefs.overdueTasks) {
                delete prefs.overdueTasks.matrix;
            }
            if (prefs.dueProjects) {
                delete prefs.dueProjects.matrix;
            }
            if (prefs.overdueProjects) {
                delete prefs.overdueProjects.matrix;
            }
            if (prefs.deferUntil) {
                delete prefs.deferUntil.matrix;
            }

            await queryInterface.sequelize.query(
                'UPDATE users SET notification_preferences = :prefs WHERE id = :id',
                {
                    replacements: {
                        prefs: JSON.stringify(prefs),
                        id: user.id,
                    },
                }
            );
        }

        await safeChangeColumn(
            queryInterface,
            'users',
            'notification_preferences',
            {
                type: Sequelize.JSON,
                allowNull: true,
                defaultValue: {
                    dueTasks: {
                        inApp: true,
                        email: false,
                        push: false,
                        telegram: false,
                    },
                    overdueTasks: {
                        inApp: true,
                        email: false,
                        push: false,
                        telegram: false,
                    },
                    dueProjects: {
                        inApp: true,
                        email: false,
                        push: false,
                        telegram: false,
                    },
                    overdueProjects: {
                        inApp: true,
                        email: false,
                        push: false,
                        telegram: false,
                    },
                    deferUntil: {
                        inApp: true,
                        email: false,
                        push: false,
                        telegram: false,
                    },
                },
                comment:
                    'User notification channel preferences for different notification types',
            }
        );
    },
};
