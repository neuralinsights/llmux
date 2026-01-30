
const request = require('supertest');
const registry = require('../src/plugins/registry');
const { createPluginContext } = require('../src/plugins/context');
const { initializeDatabase, getDatabase } = require('../src/db');

// We need to reset modules to ensure app uses the same registry instance or we import the singleton
// In Node.js, requiring the same file returns the same instance if case matches.
// So `require('../src/plugins/registry')` here and in `app.js` should be same object.

describe('Phase 4.1: Plugin System Architecture', () => {
    let app;
    let db;

    beforeAll(async () => {
        // Enforce safe env
        process.env.DB_BACKEND = 'sqlite';
        process.env.DB_PATH = ':memory:';
        process.env.API_KEY_REQUIRED = 'false'; // simplify auth for plugin testing
        process.env.LOG_LEVEL = 'error';

        // Init DB
        await initializeDatabase();
        db = getDatabase();

        // Load App
        const appModule = require('../src/app');
        app = appModule.app;
    });

    afterAll(async () => {
        if (db) await db.disconnect();
    });

    afterEach(() => {
        // Clear hooks after each test to prevent pollution
        registry.hooks.onRequest = [];
        registry.hooks.onPrompt = [];
        registry.hooks.onResponse = [];
        registry.hooks.onError = [];
    });

    test('Registry can register a plugin manually', () => {
        const plugin = {
            hooks: { onRequest: jest.fn() }
        };
        registry.register(plugin, { name: 'manual-test', version: '1.0' });

        expect(registry.hooks.onRequest.length).toBe(1);
        expect(registry.hooks.onRequest[0].pluginName).toBe('manual-test');
    });

    test('onRequest hook can modify response (headers)', async () => {
        const headerPlugin = {
            hooks: {
                onRequest: async ({ res }) => {
                    res.setHeader('X-Plugin-Test', 'Pass');
                }
            }
        };
        registry.register(headerPlugin, { name: 'header-plugin', version: '1.0' });

        const res = await request(app).get('/health');
        expect(res.headers['x-plugin-test']).toBe('Pass');
        expect(res.status).toBe(200);
    });

    test('onPrompt hook receives prompt and options', async () => {
        const spy = jest.fn();
        const promptPlugin = {
            hooks: {
                // Must be async
                onPrompt: async ({ prompt, options }) => {
                    spy(prompt, options);
                }
            }
        };
        registry.register(promptPlugin, { name: 'prompt-plugin', version: '1.0' });

        // Trigger via generation endpoint
        // using 'claude' which should exist in config (even if call fails due to no API key, hook runs first)
        const res = await request(app)
            .post('/api/generate')
            .send({
                prompt: 'Hello Plugin',
                provider: 'claude'
            });

        if (res.status === 400 && res.body.error) {
            console.log('Validation Error:', res.body.error);
        }

        // Even if route fails later, hook should have run
        expect(spy).toHaveBeenCalled();
        expect(spy).toHaveBeenCalledWith('Hello Plugin', expect.objectContaining({}));
    });

    test('Faulty hook does not crash application', async () => {
        const errorPlugin = {
            hooks: {
                onRequest: async () => {
                    throw new Error('Explosion inside plugin');
                }
            }
        };
        // Also register a good one to ensure chain continues? 
        // Our registry implementation: "We generally continue executing other hooks"
        const goodPlugin = {
            hooks: {
                onRequest: async ({ res }) => {
                    res.setHeader('X-Survivor', 'True');
                }
            }
        };

        registry.register(errorPlugin, { name: 'bad-plugin', version: '1.0' });
        registry.register(goodPlugin, { name: 'good-plugin', version: '1.0' });

        // Suppress console.error for this test
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

        const res = await request(app).get('/health');

        expect(res.status).toBe(200); // App survived
        expect(res.headers['x-survivor']).toBe('True'); // Chain continued

        consoleSpy.mockRestore();
    });

    test('Plugin Context Factory creates isolated logger', () => {
        const ctx = createPluginContext('my-plugin');
        expect(ctx.logger).toBeDefined();
        expect(ctx.logger.info).toBeDefined();
        expect(ctx.db).toBeDefined();
    });
});
