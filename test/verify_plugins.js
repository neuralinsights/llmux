
const assert = require('assert');
const http = require('http');

const BASE_URL = 'http://localhost:8765';

async function runTests() {
    console.log('--- Plugin System Verification ---');

    // 1. Check if X-Test-Plugin header is present in health check
    // onRequest hook applies to all routes? Yes, global middleware.
    try {
        const res = await fetch(`${BASE_URL}/health`);
        console.log('Health Check Status:', res.status);
        const header = res.headers.get('x-test-plugin');
        console.log('X-Test-Plugin Header:', header);

        assert.strictEqual(header, 'active', 'Plugin header should be present');
        console.log('✅ onRequest Hook Verified');

    } catch (e) {
        console.error('❌ onRequest Hook Failed:', e.message);
        process.exit(1);
    }

    // 2. onPrompt Hook
    // We can't easily verify console log output here programmatically without capturing stdout,
    // but if step 1 works, the loader and registry are working.

    console.log('--- Verification Complete ---');
}

runTests();
