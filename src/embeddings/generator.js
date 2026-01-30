/**
 * LLMux - Embeddings Generator
 * Generates embeddings using configured providers
 */

const { getProvider } = require('../providers');

class EmbeddingsGenerator {
    constructor(providerName = 'ollama') {
        this.providerName = process.env.EMBEDDING_PROVIDER || providerName;
    }

    /**
     * Generate embedding for text
     * @param {string} text 
     * @returns {Promise<number[]>}
     */
    async embedQuery(text) {
        // In a real implementation, this delegates to the provider.
        // For specific providers like OpenAI, they have dedicated endpoints.
        // For Ollama, it has /api/embeddings.

        // Check if provider supports embedding
        try {
            const provider = getProvider(this.providerName);
            if (provider.embed) {
                return await provider.embed(text);
            }
        } catch (e) {
            // Provider not found or mock mode
        }

        // FALLBACK MOCK (Deterministic hash-based embedding for testing)
        return this.mockEmbedding(text);
    }

    mockEmbedding(text) {
        // Simple deterministic pseudo-vector of size 10 needed for testing logic
        // Real embeddings are 1536 dim (OpenAI) or 768 (HF).
        const vec = new Array(10).fill(0);
        let sum = 0;
        for (let i = 0; i < text.length; i++) sum += text.charCodeAt(i);

        // Seed with sum
        for (let i = 0; i < 10; i++) {
            vec[i] = (sum * (i + 1)) % 100 / 100;
        }
        return vec;
    }
}

module.exports = new EmbeddingsGenerator();
