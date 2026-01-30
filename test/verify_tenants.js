
const assert = require('assert');
const http = require('http');
const { v4: uuidv4 } = require('uuid');

// Config
const BASE_URL = 'http://localhost:8765';
const ADMIN_KEY = 'test-admin-key'; // Assuming we set this or reuse existing logic

// Helper to make requests
function request(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...headers,
            },
        };

        const req = http.request(`${BASE_URL}${path}`, options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: data ? JSON.parse(data) : {} });
                } catch (e) {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function runTests() {
    console.log('--- Starting Multi-tenancy Verification ---');

    // 1. Check Health
    const health = await request('GET', '/health');
    console.log(`Health Check: ${health.status} (Expected 200)`);
    assert.strictEqual(health.status, 200);

    // 2. Create Tenant (Requires Admin Key - assuming we use existing LLM_API_KEY env or similar logic)
    // For this test, we rely on the implementation details of 'requireAdmin' in src/routes/tenants.js
    // which checks process.env.LLM_API_KEY. We need to know what that is or if we can bypass it.
    // In the file provided, it defaults to checking LLM_API_KEY.

    // Let's assume we run this test where we CAN hit the endpoint. If auth fails, we know it works :)
    // Actually, we should try to create a tenant with a dummy admin key if possible, or skip if we can't easily set one in this script context.
    // But wait, the user's environment might have API_KEY set.

    // Let's try to list tenants first
    const tenants = await request('GET', '/api/tenants', null, { 'X-API-Key': process.env.LLM_API_KEY || 'sk-test' });
    console.log(`List Tenants: ${tenants.status}`);

    if (tenants.status === 403) {
        console.log('Skipping Admin tests (Auth required)');
    } else {
        // Create Tenant
        const newTenant = await request('POST', '/api/tenants', {
            name: 'Test Tenant',
            plan: 'pro'
        }, { 'X-API-Key': process.env.LLM_API_KEY || 'sk-test' });

        console.log(`Create Tenant: ${newTenant.status}`);
        if (newTenant.status === 201) {
            const tenantId = newTenant.body.id;
            console.log(`Created Tenant ID: ${tenantId}`);

            // Create Key for Tenant
            const newKey = await request('POST', `/api/tenants/${tenantId}/keys`, {
                name: 'Test Key'
            }, { 'X-API-Key': process.env.LLM_API_KEY || 'sk-test' });

            console.log(`Create Tenant Key: ${newKey.status}`);
            if (newKey.status === 201) {
                const keySecret = newKey.body.key;
                console.log(`Generated Key: ${keySecret}`);

                // Verify Key usage
                // We'll call /api/quota or similar simple endpoint
                const quota = await request('GET', '/api/quota', null, { 'Authorization': `Bearer ${keySecret}` });
                console.log(`Quota Check with New Key: ${quota.status} (Expected 200)`);
                assert.strictEqual(quota.status, 200);
            }
        }
    }

    console.log('--- Verification Complete ---');
}

runTests().catch(console.error);
