process.env.TUDUDI_SESSION_SECRET =
    process.env.TUDUDI_SESSION_SECRET || 'matrix-cross-signing-test-secret';

const request = require('supertest');
const app = require('../../app');
const { User } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

const login = async (user) => {
    const agent = request.agent(app);
    await agent
        .post('/api/login')
        .send({ email: user.email, password: 'password123' });
    return agent;
};

describe('Matrix recovery key and cross-signing routes', () => {
    let user, agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: `matrix_cs_${Date.now()}_${Math.random()}@example.com`,
        });
        agent = await login(user);
    });

    it('requires a session', async () => {
        const res = await request(app).get('/api/matrix/cross-signing');
        expect(res.status).toBe(401);
    });

    it('starts without a recovery key and without a running client', async () => {
        const res = await agent.get('/api/matrix/cross-signing');
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
            running: false,
            recoveryKeySet: false,
            deviceVerified: null,
        });
    });

    it('stores the recovery key encrypted and never returns it', async () => {
        const res = await agent
            .put('/api/matrix/recovery-key')
            .send({ recovery_key: 'EsTc abcd efgh ijkl' });
        expect(res.status).toBe(200);
        expect(res.body.recoveryKeySet).toBe(true);
        expect(JSON.stringify(res.body)).not.toContain('EsTc');

        const stored = await User.findByPk(user.id);
        expect(stored.matrix_recovery_key).toMatch(/^enc:v1:/);

        const settings = await agent.get('/api/matrix/settings');
        expect(settings.body.recovery_key_set).toBe(true);
        expect(JSON.stringify(settings.body)).not.toContain('EsTc');
    });

    it('rejects an empty recovery key', async () => {
        const res = await agent
            .put('/api/matrix/recovery-key')
            .send({ recovery_key: '   ' });
        expect(res.status).toBe(400);
    });

    it('removes the recovery key', async () => {
        await agent
            .put('/api/matrix/recovery-key')
            .send({ recovery_key: 'EsTc abcd' });
        const res = await agent.delete('/api/matrix/recovery-key');
        expect(res.status).toBe(200);
        expect(res.body.recoveryKeySet).toBe(false);
        const stored = await User.findByPk(user.id);
        expect(stored.matrix_recovery_key).toBeNull();
    });

    it('asks to start polling before verifying or creating', async () => {
        const verify = await agent.post('/api/matrix/cross-signing/verify');
        expect(verify.status).toBe(400);
        const create = await agent.post('/api/matrix/cross-signing/create');
        expect(create.status).toBe(400);
    });
});
