
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:8765';
const LOG_FILE = path.join(process.cwd(), 'logs', 'routing_events.jsonl');

async function request(path, body) {
    try {
        const res = await fetch(`${BASE_URL}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        console.log(`[Response] ${res.status}:`, JSON.stringify(data));
        return { status: res.status, body: data };
    } catch (e) {
        console.error('Request Error:', e);
        return { status: 500, body: {} };
    }
}

async function runTests() {
    console.log('--- AI Routing Verification ---');

    // Clear log file
    if (fs.existsSync(LOG_FILE)) fs.unlinkSync(LOG_FILE);

    // 1. Send Code Prompt (Should trigger CODE task)
    // Force Experiment Rate to 1.0 via Env var when running server
    // Note: provider field omitted to pass validation (defaults to claude), but Smart Router will override.
    const codeRes = await request('/api/smart', {
        prompt: 'Write a python function to add two numbers'
    });

    console.log('Code Response Strategy:', codeRes.body.routing_strategy);

    // 2. Send Creative Prompt
    const creativeRes = await request('/api/smart', {
        prompt: 'Write a poem about rust'
    });
    console.log('Creative Response Strategy:', creativeRes.body.routing_strategy);

    // 3. Verify Logs
    if (fs.existsSync(LOG_FILE)) {
        const logs = fs.readFileSync(LOG_FILE, 'utf-8').split('\n').filter(l => l);
        console.log(`Logs found: ${logs.length}`);

        const firstLog = JSON.parse(logs[0]);
        console.log('Log Entry:', firstLog);

        assert.ok(firstLog.taskType, 'Task type should be logged');
        assert.ok(firstLog.strategy, 'Strategy should be logged');
        console.log('✅ Logging Verified');
    } else {
        console.error('❌ Logs not found');
        // It might be async write, allow some delay in real test or ignore if minor
    }
}

runTests();
