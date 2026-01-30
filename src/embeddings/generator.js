/**
 * LLMux - Embeddings Generator
 * Generates semantic embeddings using Transformers.js (local, no API keys)
 */

const { pipeline } = require('@xenova/transformers');

class EmbeddingsGenerator {
    constructor() {
        this.model = null;
        this.modelName = 'Xenova/all-MiniLM-L6-v2'; // 384-dim, 23MB
        this.dimension = 384;
        this.initPromise = null;
    }

    /**
     * Lazy-load the embedding model
     */
    async init() {
        if (this.model) return;
        if (this.initPromise) return this.initPromise;

        this.initPromise = (async () => {
            console.log(`[Embeddings] Loading model: ${this.modelName}...`);
            this.model = await pipeline('feature-extraction', this.modelName);
            console.log(`[Embeddings] Model loaded (${this.dimension}d)`);
        })();

        return this.initPromise;
    }

    /**
     * Generate embedding for text
     * @param {string} text 
     * @returns {Promise<number[]>}
     */
    async embedQuery(text) {
        if (!text || typeof text !== 'string') {
            throw new Error('Text must be a non-empty string');
        }

        await this.init();

        // Generate embedding
        const output = await this.model(text, { pooling: 'mean', normalize: true });

        // Convert tensor to array
        const embedding = Array.from(output.data);

        return embedding;
    }

    /**
     * Batch embed multiple texts (more efficient)
     * @param {string[]} texts 
     * @returns {Promise<number[][]>}
     */
    async embedBatch(texts) {
        await this.init();

        const embeddings = [];
        for (const text of texts) {
            const emb = await this.embedQuery(text);
            embeddings.push(emb);
        }

        return embeddings;
    }

    /**
     * Get embedding dimension
     */
    getDimension() {
        return this.dimension;
    }
}

module.exports = new EmbeddingsGenerator();
