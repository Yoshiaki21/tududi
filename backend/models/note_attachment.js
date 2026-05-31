const { DataTypes } = require('sequelize');
const { uid } = require('../utils/uid');

module.exports = (sequelize) => {
    const NoteAttachment = sequelize.define(
        'NoteAttachment',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            uid: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
                defaultValue: uid,
            },
            note_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'notes',
                    key: 'id',
                },
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
                },
            },
            original_filename: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            stored_filename: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            file_size: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            mime_type: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            file_path: {
                type: DataTypes.STRING,
                allowNull: false,
            },
        },
        {
            tableName: 'note_attachments',
            indexes: [
                { fields: ['note_id'] },
                { fields: ['user_id'] },
                { fields: ['uid'], unique: true },
            ],
        }
    );

    NoteAttachment.associate = function (models) {
        NoteAttachment.belongsTo(models.Note, {
            foreignKey: 'note_id',
            as: 'Note',
        });
        NoteAttachment.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'User',
        });
    };

    return NoteAttachment;
};
