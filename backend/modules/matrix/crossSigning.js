'use strict';

// Bot デバイスのクロス署名（セルフ検証）。
//
// Element で「所有者が検証していないデバイスで暗号化されています」と出るのは、
// bot のデバイスが bot 自身のクロス署名鍵で署名されていないため。リカバリー
// キー（Element の Security Key）でシークレットストレージからクロス署名鍵を
// 取り出し、自分のデバイスに署名する。

const secretCipher = require('../../shared/crypto/secretCipher');

// userId -> { state, message, at }
const lastResults = new Map();

const STATES = {
    VERIFIED: 'verified', // デバイスはクロス署名済み
    NO_KEY: 'no_key', // リカバリーキー未設定
    NO_RECOVERY: 'no_recovery', // アカウントにリカバリー（シークレットストレージ）が無い
    KEY_UNREADABLE: 'key_unreadable', // 保存済みキーを復号できない（暗号化キー変更など）
    FAILED: 'failed', // 検証を試みたが失敗（キー違いなど）
    UNAVAILABLE: 'unavailable', // E2EE クライアントが動いていない
};

function encryptRecoveryKey(recoveryKey) {
    return secretCipher.encrypt(recoveryKey.trim());
}

function decryptRecoveryKey(stored) {
    if (!stored) return null;
    try {
        return secretCipher.decrypt(stored) || null;
    } catch {
        return null;
    }
}

function record(userId, state, message = null) {
    const result = { state, message, at: new Date().toISOString() };
    if (userId != null) lastResults.set(Number(userId), result);
    return result;
}

function getLastResult(userId) {
    return lastResults.get(Number(userId)) || null;
}

function clearLastResult(userId) {
    lastResults.delete(Number(userId));
}

// null: E2EE 未使用、true/false: 自分のデバイスがクロス署名で信頼されているか
async function isOwnDeviceVerified(client) {
    const machine = client?.crypto?.engine?.machine;
    if (!machine) return null;
    const device = await machine.getDevice(machine.userId, machine.deviceId);
    return device ? device.isCrossSigningTrusted() : false;
}

async function isRecoveryAvailable(client) {
    if (!client?.crypto) return false;
    return client.crypto.isRecoveryAvailable();
}

/**
 * 保存済みのリカバリーキーで bot のデバイスをクロス署名する。
 * 失敗しても例外は投げず、結果（state）を返す。クライアントの起動は止めない。
 */
async function confirmIdentity(client, user) {
    const userId = user?.id;
    try {
        if (!client?.crypto) return record(userId, STATES.UNAVAILABLE);
        if (await isOwnDeviceVerified(client)) {
            return record(userId, STATES.VERIFIED);
        }
        if (!user.matrix_recovery_key) return record(userId, STATES.NO_KEY);

        const key = decryptRecoveryKey(user.matrix_recovery_key);
        if (!key) return record(userId, STATES.KEY_UNREADABLE);

        if (!(await isRecoveryAvailable(client))) {
            return record(userId, STATES.NO_RECOVERY);
        }

        await client.crypto.confirmIdentityWithRecoveryKey(key);
        if (await isOwnDeviceVerified(client)) {
            console.log(`Matrix: bot device cross-signed for user ${userId}`);
            return record(userId, STATES.VERIFIED);
        }
        return record(
            userId,
            STATES.FAILED,
            'Device is still not trusted after confirming the identity'
        );
    } catch (error) {
        console.warn(
            `Matrix: cross-signing failed for user ${userId}: ${error.message}`
        );
        return record(userId, STATES.FAILED, error.message);
    }
}

/**
 * クロス署名の鍵がまだ無い bot アカウントに、新しい鍵とリカバリーキーを作る。
 * 作ったリカバリーキー（base58）を返す。既にリカバリーがある場合は作らない
 * （既存の鍵を上書きしないため）。
 */
async function createIdentity(client, user) {
    if (!client?.crypto) {
        throw new Error('Matrix E2EE client is not running');
    }
    if (await isRecoveryAvailable(client)) {
        throw new Error(
            'Recovery is already set up for this account. Enter its recovery key instead.'
        );
    }
    const recoveryKey = await client.crypto.createIdentity();
    record(user?.id, STATES.VERIFIED);
    return recoveryKey;
}

async function getStatus(client, user) {
    const running = !!client;
    let deviceVerified = null;
    let recoveryAvailable = null;
    if (client?.crypto) {
        try {
            deviceVerified = await isOwnDeviceVerified(client);
            recoveryAvailable = await isRecoveryAvailable(client);
        } catch (error) {
            console.warn(
                `Matrix: could not read cross-signing status: ${error.message}`
            );
        }
    }
    return {
        running,
        recoveryKeySet: !!user?.matrix_recovery_key,
        deviceVerified,
        recoveryAvailable,
        lastResult: getLastResult(user?.id),
    };
}

module.exports = {
    STATES,
    encryptRecoveryKey,
    decryptRecoveryKey,
    confirmIdentity,
    createIdentity,
    getStatus,
    getLastResult,
    clearLastResult,
    isOwnDeviceVerified,
};
