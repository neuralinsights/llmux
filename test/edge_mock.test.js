
// Mock Fetch API globally for the worker context
global.fetch = jest.fn();
global.Response = class Response {
    constructor(body, init) {
        this.body = body;
        this.status = init?.status || 200;
        this.headers = init?.headers || {};
    }
};
global.URL = require('url').URL; // Node's URL implementation matches standard usually
// TransformStream needs polyfill in Node < 18 or mock
global.TransformStream = class TransformStream {
    constructor() {
        this.readable = 'readable-stream';
        this.writable = 'writable-stream';
    }
};

// We need to use ESM import or require with transformation if using 'export default' in worker.
// Since our project is CommonJS based mostly but worker is ESM, testing might be tricky without Babel/Jest config changes.
// Or we can write the test to dynamically import().

describe('Phase 5.2: Edge Deployment Verification', () => {

    let worker;

    beforeAll(async () => {
        // Dynamic import of ESM module
        // Jest natively supports ESM if configured, or we can use generic require if file is transpiled.
        // Given current setup, let's try dynamic import.
        worker = (await import('../src/edge/worker.mjs')).default;
    });

    test('Health check returns 200', async () => {
        const req = { url: 'https://worker.dev/health', method: 'GET' };
        const env = {};

        const res = await worker.fetch(req, env);
        expect(res.status).toBe(200);

        // Handle body if string or stream
        // Our mock Response stores body directly
        const data = JSON.parse(res.body);
        expect(data.status).toBe('ok');
    });

    test('Generate Endpoint proxies to upstream', async () => {
        const req = {
            url: 'https://worker.dev/v1/chat/completions',
            method: 'POST',
            json: async () => ({
                provider: 'claude',
                messages: [{ role: 'user', content: 'hi' }]
            })
        };
        const env = {
            ANTHROPIC_API_KEY: 'sk-ant-test'
        };

        // Mock upstream fetch success
        global.fetch.mockResolvedValueOnce({
            status: 200,
            headers: {},
            body: { pipeTo: jest.fn() }
        });

        const res = await worker.fetch(req, env);

        expect(global.fetch).toHaveBeenCalled();
        const callArgs = global.fetch.mock.calls[0];

        // Verify URL
        expect(callArgs[0]).toContain('anthropic');
        // Verify Header injection
        expect(callArgs[1].headers['x-api-key']).toBe('sk-ant-test');

        expect(res.status).toBe(200);
    });

    test('Missing API Key returns 500', async () => {
        const req = {
            url: 'https://worker.dev/v1/chat/completions',
            method: 'POST',
            json: async () => ({ provider: 'claude' })
        };
        const env = {}; // No keys

        const res = await worker.fetch(req, env);
        expect(res.status).toBe(500);
        const data = JSON.parse(res.body);
        expect(data.error).toMatch(/Missing configuration/);
    });
});
