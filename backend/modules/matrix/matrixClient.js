'use strict';

const fs = require('fs');
const path = require('path');
const {
    MatrixClient,
    SimpleFsStorageProvider,
    RustSdkCryptoStorageProvider,
} = require('matrix-bot-sdk');
const { StoreType } = require('@matrix-org/matrix-sdk-crypto-nodejs');

// Resolve to backend root (modules/matrix → modules → backend)
const BACKEND_ROOT = path.join(__dirname, '..', '..');

// Use the same db/ directory as the SQLite database — this directory is a
// Docker volume so the crypto store survives container recreation.
function getStorageDir(userId) {
    const dbDir = process.env.DB_FILE
        ? path.dirname(path.resolve(BACKEND_ROOT, process.env.DB_FILE))
        : path.join(BACKEND_ROOT, 'db');
    return path.join(dbDir, 'matrix-store', String(userId));
}

// Migrate existing store from old data/matrix-store/ path to new db/matrix-store/ path.
// Uses copy+delete instead of rename to handle cross-filesystem Docker volume boundaries.
function migrateStoreIfNeeded(userId) {
    const oldBase = path.join(BACKEND_ROOT, 'data', 'matrix-store', String(userId));
    const newDir = getStorageDir(userId);
    if (!fs.existsSync(oldBase) || fs.existsSync(newDir)) return;
    try {
        fs.mkdirSync(path.dirname(newDir), { recursive: true });
        fs.cpSync(oldBase, newDir, { recursive: true });
        fs.rmSync(oldBase, { recursive: true, force: true });
        console.log(`Matrix: migrated crypto store for user ${userId} to ${newDir}`);
    } catch (e) {
        console.warn(`Matrix: could not migrate old crypto store for user ${userId}: ${e.message}`);
    }
}

function createMatrixClient(homeserverUrl, accessToken, userId) {
    migrateStoreIfNeeded(userId);
    const storageDir = getStorageDir(userId);
    if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
    }

    const storage = new SimpleFsStorageProvider(path.join(storageDir, 'sync.json'));

    const cryptoDir = path.join(storageDir, 'crypto');
    if (!fs.existsSync(cryptoDir)) {
        fs.mkdirSync(cryptoDir, { recursive: true });
    }
    // Explicit StoreType.Sqlite avoids a Rust panic in the NAPI Tokio runtime
    // shutdown path that occurs when storeType is undefined.
    const cryptoStorage = new RustSdkCryptoStorageProvider(cryptoDir, StoreType.Sqlite);

    return new MatrixClient(homeserverUrl, accessToken, storage, cryptoStorage);
}

module.exports = { createMatrixClient };
