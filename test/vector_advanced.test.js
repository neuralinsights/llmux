
const request = require('supertest');
const { app } = require('../src/app');
const { initializeDatabase, getDatabase } = require('../src/db');

describe('Phase 4.3: Advanced Vector System Verification', () => {

    beforeAll(async () => {
        await initializeDatabase();
    });

    afterAll(async () => {
        const db = getDatabase();
        if (db) await db.disconnect();
    });

    // 1. Embedding Logic Verification (Black-box via API)
    // We expect "Apple" and "elppA" to have identical embeddings due to simple sum-hash mock logic.
    test('Mock Embeddings should be character-sum invariant (Deterministic)', async () => {
        // Upsert 'Apple'
        await request(app).post('/api/vector/upsert').send({ content: 'Apple', metadata: { id: 1 } });

        // Search 'elppA' -> Should match 'Apple' effectively perfectly if logic holds
        // (Assuming mock logic: sum += text.charCodeAt(i))
        const res = await request(app)
            .post('/api/vector/search')
            .send({ query: 'elppA', k: 1 });

        const topResult = res.body.results[0];
        // Score might not be 1.0 strictly due to floating point, but extremely close
        expect(topResult.content).toBe('Apple');
        expect(topResult.score).toBeGreaterThan(0.999);
    });

    // 2. Semantic Distinction (Mock level)
    // "A" (65) vs "B" (66) -> Close.
    // "A" (65) vs "z" (122) -> Farther.
    test('Should distinguish between distinct concepts (Mock Limit)', async () => {
        // Clear logic not exposed, but we can rely on isolation if we assume memory store persists?
        // Note: MemoryStore is singleton in app module, so 'Apple' from prev test exists.

        await request(app).post('/api/vector/upsert').send({ content: 'Zen', metadata: { id: 2 } });

        // Query closer to 'Zen' than 'Apple'?
        // 'Apple' sum ~ 500. 'Zen' sum ~ 300. 
        // Query 'Zoom' (sum ~ 450). Might be closer to Apple?
        // Let's rely on simple exact match vs noise.

        const res = await request(app)
            .post('/api/vector/search')
            .send({ query: 'Zen', k: 1 });

        expect(res.body.results[0].content).toBe('Zen');
        expect(res.body.results[0].score).toBeGreaterThan(0.99); // Self-match
    });

    // 3. Input Validation
    test('Should reject empty content upsert', async () => {
        const res = await request(app).post('/api/vector/upsert').send({ metadata: {} });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Required/i);
    });

    test('Should reject empty query search', async () => {
        const res = await request(app).post('/api/vector/search').send({ k: 5 });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Required/i);
    });

    // 4. Batch Operations (Load)
    test('Should handle batch upserts gracefully', async () => {
        const docs = Array.from({ length: 50 }, (_, i) => ({
            content: `Item ${i}`,
            metadata: { index: i }
        }));

        // Sequential upserts via Promise.all
        // Note: API is single upsert only in my implementation!
        const promises = docs.map(doc =>
            request(app).post('/api/vector/upsert').send(doc)
        );

        const results = await Promise.all(promises);
        const failures = results.filter(r => r.status !== 200);
        expect(failures.length).toBe(0);

        // Search for specific one
        const searchRes = await request(app)
            .post('/api/vector/search')
            .send({ query: 'Item 25', k: 5 });

        const found = searchRes.body.results.find(r => r.content === 'Item 25');
        expect(found).toBeDefined();
    });

    // 5. Metadata Preservation
    test('Should preserve metadata', async () => {
        const meta = { author: 'James', year: 2026, tags: ['test', 'vector'] };
        await request(app)
            .post('/api/vector/upsert')
            .send({ content: 'Metadata Test', metadata: meta });

        const res = await request(app)
            .post('/api/vector/search')
            .send({ query: 'Metadata Test', k: 1 });

        expect(res.body.results[0].metadata).toEqual(expect.objectContaining(meta));
    });
});
