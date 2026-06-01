'use strict';

const express = require('express');
const router = express.Router();
const { cleanupOrphanedAttachments } = require('./service');
const { getAuthenticatedUserId } = require('../../utils/request-utils');
const { logError } = require('../../services/logService');

router.post('/cleanup/orphaned-attachments', async (req, res) => {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const result = await cleanupOrphanedAttachments(userId);
        res.json(result);
    } catch (error) {
        logError('Error running orphaned attachment cleanup:', error);
        res.status(500).json({ error: 'Cleanup failed', details: error.message });
    }
});

module.exports = router;
