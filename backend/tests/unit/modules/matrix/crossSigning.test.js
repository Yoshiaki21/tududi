process.env.TUDUDI_SESSION_SECRET =
    process.env.TUDUDI_SESSION_SECRET || 'cross-signing-test-session-secret';

const crossSigning = require('../../../../modules/matrix/crossSigning');

const { STATES } = crossSigning;

// A MatrixClient stand-in: just enough of client.crypto for crossSigning.js
function makeClient({
    trusted = false,
    trustedAfterConfirm = true,
    recoveryAvailable = true,
    confirmError = null,
    createdKey = 'EsTc newly created key',
} = {}) {
    let isTrusted = trusted;
    const machine = {
        userId: '@bot:example.com',
        deviceId: 'DEVICE',
        getDevice: jest.fn(async () => ({
            isCrossSigningTrusted: () => isTrusted,
        })),
    };
    const crypto = {
        engine: { machine },
        isRecoveryAvailable: jest.fn(async () => recoveryAvailable),
        confirmIdentityWithRecoveryKey: jest.fn(async () => {
            if (confirmError) throw new Error(confirmError);
            isTrusted = trustedAfterConfirm;
        }),
        createIdentity: jest.fn(async () => {
            isTrusted = true;
            return createdKey;
        }),
    };
    return { crypto };
}

const userWithKey = (key, id = 1) => ({
    id,
    matrix_recovery_key: key ? crossSigning.encryptRecoveryKey(key) : null,
});

describe('matrix crossSigning', () => {
    afterEach(() => crossSigning.clearLastResult(1));

    it('stores the recovery key encrypted and reads it back trimmed', () => {
        const stored = crossSigning.encryptRecoveryKey('  EsTc abcd efgh  ');
        expect(stored).not.toContain('EsTc');
        expect(stored.startsWith('enc:v1:')).toBe(true);
        expect(crossSigning.decryptRecoveryKey(stored)).toBe('EsTc abcd efgh');
    });

    it('returns null for a key it cannot decrypt', () => {
        expect(crossSigning.decryptRecoveryKey('enc:v1:bad:data:here')).toBe(
            null
        );
        expect(crossSigning.decryptRecoveryKey(null)).toBe(null);
    });

    it('confirms the identity with the stored recovery key', async () => {
        const client = makeClient();
        const result = await crossSigning.confirmIdentity(
            client,
            userWithKey('EsTc key')
        );
        expect(result.state).toBe(STATES.VERIFIED);
        expect(
            client.crypto.confirmIdentityWithRecoveryKey
        ).toHaveBeenCalledWith('EsTc key');
        expect(crossSigning.getLastResult(1).state).toBe(STATES.VERIFIED);
    });

    it('does nothing when the device is already verified', async () => {
        const client = makeClient({ trusted: true });
        const result = await crossSigning.confirmIdentity(
            client,
            userWithKey('EsTc key')
        );
        expect(result.state).toBe(STATES.VERIFIED);
        expect(
            client.crypto.confirmIdentityWithRecoveryKey
        ).not.toHaveBeenCalled();
    });

    it('reports a missing recovery key', async () => {
        const result = await crossSigning.confirmIdentity(
            makeClient(),
            userWithKey(null)
        );
        expect(result.state).toBe(STATES.NO_KEY);
    });

    it('reports an account without recovery', async () => {
        const client = makeClient({ recoveryAvailable: false });
        const result = await crossSigning.confirmIdentity(
            client,
            userWithKey('EsTc key')
        );
        expect(result.state).toBe(STATES.NO_RECOVERY);
        expect(
            client.crypto.confirmIdentityWithRecoveryKey
        ).not.toHaveBeenCalled();
    });

    it('reports a wrong key as failed without throwing', async () => {
        const client = makeClient({ confirmError: 'MAC mismatch' });
        const result = await crossSigning.confirmIdentity(
            client,
            userWithKey('EsTc wrong')
        );
        expect(result).toMatchObject({
            state: STATES.FAILED,
            message: 'MAC mismatch',
        });
    });

    it('reports an unreadable stored key', async () => {
        const result = await crossSigning.confirmIdentity(makeClient(), {
            id: 1,
            matrix_recovery_key: 'enc:v1:bad:data:here',
        });
        expect(result.state).toBe(STATES.KEY_UNREADABLE);
    });

    it('reports when E2EE is not running', async () => {
        const result = await crossSigning.confirmIdentity(
            {},
            userWithKey('EsTc key')
        );
        expect(result.state).toBe(STATES.UNAVAILABLE);
    });

    it('creates an identity only when the account has no recovery', async () => {
        const fresh = makeClient({ recoveryAvailable: false });
        await expect(
            crossSigning.createIdentity(fresh, { id: 1 })
        ).resolves.toBe('EsTc newly created key');

        const existing = makeClient({ recoveryAvailable: true });
        await expect(
            crossSigning.createIdentity(existing, { id: 1 })
        ).rejects.toThrow(/already set up/);
        expect(existing.crypto.createIdentity).not.toHaveBeenCalled();
    });

    it('summarises the status', async () => {
        const status = await crossSigning.getStatus(
            makeClient({ trusted: true }),
            userWithKey('EsTc key')
        );
        expect(status).toMatchObject({
            running: true,
            recoveryKeySet: true,
            deviceVerified: true,
            recoveryAvailable: true,
        });

        const stopped = await crossSigning.getStatus(null, userWithKey(null));
        expect(stopped).toMatchObject({
            running: false,
            recoveryKeySet: false,
            deviceVerified: null,
            recoveryAvailable: null,
        });
    });
});
