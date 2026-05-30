'use strict';

const express = require('express');
const router = express.Router();
const matrixController = require('./controller');

router.get('/matrix/settings', matrixController.getSettings);
router.post('/matrix/settings', matrixController.saveSettings);
router.post('/matrix/start-polling', matrixController.startPolling);
router.post('/matrix/stop-polling', matrixController.stopPolling);
router.get('/matrix/polling-status', matrixController.getPollingStatus);
router.post('/matrix/test-summary', matrixController.testSummary);
router.post('/matrix/test-connection', matrixController.testConnection);

module.exports = router;
