'use strict';

const fs = require('fs');
const path = require('path');
const {
    MatrixClient,
    SimpleFsStorageProvider,
    RustSdkCryptoStorageProvider,
} = require('matrix-bot-sdk');

function createMatrixClient(homeserverUrl, accessToken, userId) {
    const storageDir = path.join(process.cwd(), 'data', 'matrix-store', String(userId));
    if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
    }

    const storage = new SimpleFsStorageProvider(path.join(storageDir, 'sync.json'));

    const cryptoDir = path.join(storageDir, 'crypto');
    if (!fs.existsSync(cryptoDir)) {
        fs.mkdirSync(cryptoDir, { recursive: true });
    }
    const cryptoStorage = new RustSdkCryptoStorageProvider(cryptoDir);

    return new MatrixClient(homeserverUrl, accessToken, storage, cryptoStorage);
}

module.exports = { createMatrixClient };
