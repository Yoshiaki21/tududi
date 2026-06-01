'use strict';

const path = require('path');
const { Op, literal } = require('sequelize');
const { TaskAttachment, ProjectAttachment, NoteAttachment } = require('../../models');
const { deleteFileFromDisk } = require('../../utils/attachment-utils');
const { getConfig } = require('../../config/config');
const { logError } = require('../../services/logService');

const config = getConfig();

async function cleanupOrphanedAttachments(userId) {
    let deletedCount = 0;
    let freedBytes = 0;

    const processOrphans = async (Model, foreignKey, entityTable) => {
        const orphans = await Model.findAll({
            where: {
                user_id: userId,
                [foreignKey]: {
                    [Op.notIn]: literal(`(SELECT id FROM ${entityTable})`),
                },
            },
        });

        for (const orphan of orphans) {
            try {
                freedBytes += orphan.file_size || 0;
                const filePath = path.join(config.uploadPath, orphan.file_path);
                await deleteFileFromDisk(filePath);
                await orphan.destroy();
                deletedCount++;
            } catch (err) {
                logError('Error cleaning up orphaned attachment:', err);
            }
        }
    };

    await processOrphans(TaskAttachment, 'task_id', 'tasks');
    await processOrphans(ProjectAttachment, 'project_id', 'projects');
    await processOrphans(NoteAttachment, 'note_id', 'notes');

    return { deletedCount, freedBytes };
}

module.exports = { cleanupOrphanedAttachments };
