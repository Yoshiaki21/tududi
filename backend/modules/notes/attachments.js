'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getConfig } = require('../../config/config');
const config = getConfig();
const { NoteAttachment, Note } = require('../../models');
const { uid } = require('../../utils/uid');
const { logError } = require('../../services/logService');
const {
    validateFileType,
    deleteFileFromDisk,
} = require('../../utils/attachment-utils');
const { getAuthenticatedUserId } = require('../../utils/request-utils');
const permissionsService = require('../../services/permissionsService');
const { createResourceLimiter } = require('../../middleware/rateLimiter');

const router = express.Router();

router.use((req, res, next) => {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    req.authUserId = userId;
    next();
});

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(config.uploadPath, 'notes');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, 'note-' + uniqueSuffix + path.extname(file.originalname));
    },
});

const upload = multer({
    storage,
    limits: { fileSize: config.fileUploadLimitMB * 1024 * 1024 },
    fileFilter: function (req, file, cb) {
        if (validateFileType(file.mimetype)) {
            return cb(null, true);
        }
        cb(new Error('File type not allowed'));
    },
});

// GET /note/:uid/attachments
router.get('/note/:uid/attachments', async (req, res) => {
    try {
        const { uid: noteUid } = req.params;
        const userId = req.authUserId;

        const note = await Note.findOne({ where: { uid: noteUid } });
        if (!note) {
            return res.status(404).json({ error: 'Note not found' });
        }

        const access = await permissionsService.getAccess(userId, 'note', noteUid);
        const LEVELS = { none: 0, ro: 1, rw: 2, admin: 3 };
        if (LEVELS[access] < LEVELS.ro) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const attachments = await NoteAttachment.findAll({
            where: { note_id: note.id },
            order: [['created_at', 'ASC']],
        });

        const result = attachments.map((att) => ({
            ...att.toJSON(),
            file_url: `/api/uploads/notes/${att.stored_filename}`,
        }));

        res.json(result);
    } catch (error) {
        logError('Error fetching note attachments:', error);
        res.status(500).json({ error: 'Failed to fetch attachments' });
    }
});

// POST /note/:uid/attachments
router.post(
    '/note/:uid/attachments',
    createResourceLimiter,
    upload.single('file'),
    async (req, res) => {
        try {
            const { uid: noteUid } = req.params;
            const userId = req.authUserId;

            const note = await Note.findOne({ where: { uid: noteUid } });
            if (!note) {
                if (req.file) await deleteFileFromDisk(req.file.path);
                return res.status(404).json({ error: 'Note not found' });
            }

            const access = await permissionsService.getAccess(userId, 'note', noteUid);
            const LEVELS = { none: 0, ro: 1, rw: 2, admin: 3 };
            if (LEVELS[access] < LEVELS.rw) {
                if (req.file) await deleteFileFromDisk(req.file.path);
                return res.status(403).json({ error: 'Not authorized' });
            }

            const attachmentCount = await NoteAttachment.count({
                where: { note_id: note.id },
            });
            if (attachmentCount >= 20) {
                if (req.file) await deleteFileFromDisk(req.file.path);
                return res.status(400).json({ error: 'Maximum 20 attachments allowed' });
            }

            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            const attachment = await NoteAttachment.create({
                uid: uid(),
                note_id: note.id,
                user_id: userId,
                original_filename: req.file.originalname,
                stored_filename: req.file.filename,
                file_size: req.file.size,
                mime_type: req.file.mimetype,
                file_path: `notes/${req.file.filename}`,
            });

            res.status(201).json({
                ...attachment.toJSON(),
                file_url: `/api/uploads/notes/${req.file.filename}`,
            });
        } catch (error) {
            logError('Error uploading note attachment:', error);
            if (req.file) await deleteFileFromDisk(req.file.path);
            res.status(500).json({ error: 'Failed to upload attachment' });
        }
    }
);

// DELETE /note/:uid/attachments/:attachmentUid
router.delete(
    '/note/:uid/attachments/:attachmentUid',
    createResourceLimiter,
    async (req, res) => {
        try {
            const { uid: noteUid, attachmentUid } = req.params;
            const userId = req.authUserId;

            const note = await Note.findOne({ where: { uid: noteUid } });
            if (!note) {
                return res.status(404).json({ error: 'Note not found' });
            }

            const access = await permissionsService.getAccess(userId, 'note', noteUid);
            const LEVELS = { none: 0, ro: 1, rw: 2, admin: 3 };
            if (LEVELS[access] < LEVELS.rw) {
                return res.status(403).json({ error: 'Not authorized' });
            }

            const attachment = await NoteAttachment.findOne({
                where: { uid: attachmentUid, note_id: note.id },
            });
            if (!attachment) {
                return res.status(404).json({ error: 'Attachment not found' });
            }

            const filePath = path.join(config.uploadPath, attachment.file_path);
            await deleteFileFromDisk(filePath);
            await attachment.destroy();

            res.json({ message: 'Attachment deleted successfully' });
        } catch (error) {
            logError('Error deleting note attachment:', error);
            res.status(500).json({ error: 'Failed to delete attachment' });
        }
    }
);

module.exports = router;
