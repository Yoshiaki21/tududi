'use strict';

const fs = require('fs');
const path = require('path');
const { MatrixClient, SimpleFsStorageProvider } = require('matrix-bot-sdk');

function createMatrixClient(homeserverUrl, accessToken, userId) {
    const storageDir = path.join(process.cwd(), 'data', 'matrix-store', String(userId));
    if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
    }

    const storage = new SimpleFsStorageProvider(path.join(storageDir, 'sync.json'));
    return new MatrixClient(homeserverUrl, accessToken, storage);
}

module.exports = { createMatrixClient };
