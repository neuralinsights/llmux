const express = require('express');
const router = express.Router();
const { MemoryVectorStore } = require('../vector');
const embeddingsGenerator = require('../embeddings/generator');
const { requireAuth } = require('../middleware/auth'); // Check auth

// Singleton storeInstance (In-memory resets on restart)
// In real app, this should be initialized in app.js and passed down or managed via DI
const store = new MemoryVectorStore();

/**
 * Upsert Document
 * Body: { content: string, metadata: object }
 */
router.post('/upsert', async (req, res) => {
    try {
        const { content, metadata } = req.body;
        if (!content) return res.status(400).json({ error: 'Content is required' });

        const embedding = await embeddingsGenerator.embedQuery(content);

        await store.addDocuments([{
            content,
            metadata,
            embedding
        }]);

        res.json({ success: true, message: 'Document stored' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Search Documents
 * Body: { query: string, k: number }
 */
router.post('/search', async (req, res) => {
    try {
        const { query, k = 3 } = req.body;
        if (!query) return res.status(400).json({ error: 'Query is required' });

        const embedding = await embeddingsGenerator.embedQuery(query);
        const results = await store.similaritySearch(embedding, k);

        res.json({ results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
