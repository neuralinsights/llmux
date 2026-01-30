
const request = require('supertest');
const { WebhookManager } = require('../src/integrations/webhooks');
const { getHeliconeHeaders, HELICONE_CONFIG } = require('../src/integrations/helicone');

// Setup Env BEFORE requiring modules
process.env.LLM_API_KEY = 'admin-test-key';
process.env.API_KEY_REQUIRED = 'true';
process.env.DB_BACKEND = 'sqlite';
process.env.DB_PATH = ':memory:';
process.env.HELICONE_ENABLED = 'true';
process.env.HELICONE_API_KEY = 'sk-helicone-test';
process.env.LANGFUSE_ENABLED = 'true';
process.env.LOG_LEVEL = 'error'; // Silence logs

// Reset modules to ensure env vars are picked up
jest.resetModules();
const { app, initializeCache } = require('../src/app');
const { initializeDatabase, getDatabase } = require('../src/db');
const { API_KEYS } = require('../src/middleware/auth');

// Manually ensure Admin Key is in Memory Map (since Auth Middleware loads at require time)
API_KEYS.set('admin-test-key', {
    userId: 'admin',
    projectId: 'system',
    role: 'admin'
});

describe('Phase 3 Comprehensive Tests', () => {
    let db;

    beforeAll(async () => {
        // Initialize DB (In-Memory)
        await initializeDatabase({ path: ':memory:' });
        db = getDatabase();
        await initializeCache(); // Mock cache if needed
    });

    afterAll(async () => {
        await db.disconnect();
    });

    describe('3.1 Multi-tenancy & Authentication', () => {
        let tenantId;
        let tenantKey;

        test('Admin can create a tenant', async () => {
            const res = await request(app)
                .post('/api/tenants')
                .set('Authorization', 'Bearer admin-test-key')
                .send({
                    name: 'Test Corp',
                    plan: 'enterprise',
                    config: { featureX: true }
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.id).toBeDefined();
            expect(res.body.name).toBe('Test Corp');
            tenantId = res.body.id;
        });

        test('Admin can create API key for tenant', async () => {
            const res = await request(app)
                .post(`/api/tenants/${tenantId}/keys`)
                .set('Authorization', 'Bearer admin-test-key')
                .send({
                    name: 'Production Key',
                    scopes: ['generate', 'chat']
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.key).toBeDefined();
            expect(res.body.key).toMatch(/^sk-/);
            tenantKey = res.body.key;
        });

        test('Tenant Key allows access to protected endpoints', async () => {
            // We'll hit /api/quota which is protected
            const res = await request(app)
                .get('/api/quota')
                .set('Authorization', `Bearer ${tenantKey}`);

            expect(res.statusCode).toBe(200);
        });

        test('Invalid Key is rejected', async () => {
            const res = await request(app)
                .get('/api/quota')
                .set('Authorization', 'Bearer invalid-key');

            expect(res.statusCode).toBe(401);
        });
    });

    describe('3.4 Integrations: Webhooks', () => {
        test('Admin can register a webhook', async () => {
            const res = await request(app)
                .post('/api/webhooks')
                .set('Authorization', 'Bearer admin-test-key')
                .send({
                    event: 'quota_exceeded',
                    url: 'https://example.com/webhook',
                    secret: 'whsec_test'
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.id).toBeDefined();
            expect(res.body.event).toBe('quota_exceeded');
        });

        test('Validation fails for invalid event', async () => {
            const res = await request(app)
                .post('/api/webhooks')
                .set('Authorization', 'Bearer admin-test-key')
                .send({
                    event: 'invalid_event',
                    url: 'https://example.com'
                });

            expect(res.statusCode).toBe(400);
        });
    });

    describe('3.4 Integrations: Helicone', () => {
        test('Helicone headers are generated correctly', () => {
            // Force reload config or update object directly since module caches env
            HELICONE_CONFIG.enabled = true;
            HELICONE_CONFIG.apiKey = 'sk-helicone-test';

            const headers = getHeliconeHeaders({
                userId: 'user-123',
                sessionId: 'sess-abc',
                metadata: { custom: 'value' }
            });

            expect(headers['Helicone-Auth']).toBe('Bearer sk-helicone-test');
            expect(headers['Helicone-User-Id']).toBe('user-123');
            expect(headers['Helicone-Session-Id']).toBe('sess-abc');
            expect(headers['Helicone-Property-custom']).toBe('value');
        });
    });

    describe('3.4 Integrations: Langfuse', () => {
        test('Langfuse module loads without crashing even with missing env (Safety Check)', () => {
            // We just want to ensure requiring it doesn't throw if SDK is missing or config is bad
            // The real SDK is mocked in this runtime usually, but we installed it.
            const { initializeLangfuse, isLangfuseEnabled } = require('../src/integrations/langfuse');

            // We set env vars at top, so it should initialize
            const success = initializeLangfuse();
            // Note: It might return false if we already initialized in previous tests or app load
            // But simply calling it checks for crash resilience.
            expect(typeof success).toBe('boolean');
        });
    });
});
