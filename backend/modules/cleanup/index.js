'use strict';

const routes = require('./routes');
const { cleanupOrphanedAttachments } = require('./service');

module.exports = { routes, cleanupOrphanedAttachments };
