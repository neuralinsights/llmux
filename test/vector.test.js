
const request = require('supertest');
const { app } = require('../src/app'); // Import app to test routes
const { initializeDatabase, getDatabase } = require('../src/db');

// Note: In integration test, calling require('../src/app') reloads it?
// Usually yes if we reset modules, but strict singleton might be tricky.
// We should check if app is exported correctly.

describe('Phase 4.3: Vector Database Support', () => {

    beforeAll(async () => {
        // Init logic if needed
        await initializeDatabase();
    });

    afterAll(async () => {
        const db = getDatabase();
        if (db) await db.disconnect();
    });

    test('Should upsert a document', async () => {
        const res = await request(app)
            .post('/api/vector/upsert')
            .send({
                content: 'Apple is a tasty red fruit',
                metadata: { category: 'food' }
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    test('Should upsert another document', async () => {
        const res = await request(app)
            .post('/api/vector/upsert')
            .send({
                content: 'Tesla Model S is an electric car',
                metadata: { category: 'vehicle' }
            });
        expect(res.status).toBe(200);
    });

    test('Should search and find relevant document', async () => {
        // Note: Our Mock Embeddings are simple hash-based.
        // Similarity might be random-ish but deterministic.
        // We just verify it returns results.

        const res = await request(app)
            .post('/api/vector/search')
            .send({
                query: 'fruit',
                k: 1
            });

        expect(res.status).toBe(200);
        expect(res.body.results).toBeDefined();
        expect(res.body.results.length).toBeGreaterThan(0);

        // Log result to see logic
        console.log('Search Result:', res.body.results[0]);
    });
});
