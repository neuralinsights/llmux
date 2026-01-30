/**
 * LLMux - Conversation History Storage
 * Captures and stores request/response pairs in vector DB
 */

const embeddingsGenerator = require('../embeddings/generator');
const { MemoryVectorStore } = require('../vector');
const inspector = require('../telemetry/inspector');

class ConversationHistory {
    constructor() {
        this.vectorStore = new MemoryVectorStore(); // Renamed from 'store' to avoid method name collision
        this.enabled = process.env.ENABLE_MEMORY !== 'false';
    }

    /**
     * Store a conversation turn
     * @param {Object} params
     * @param {string} params.requestId
     * @param {string} params.userPrompt
     * @param {string} params.assistantResponse
     * @param {Object} params.metadata - Additional context (provider, model, etc.)
     */
    async store({ requestId, userPrompt, assistantResponse, metadata = {} }) {
        if (!this.enabled) return;

        try {
            // Combine prompt and response for embedding
            const combinedText = `User: ${userPrompt}\nAssistant: ${assistantResponse}`;

            // Generate embedding
            const embedding = await embeddingsGenerator.embedQuery(combinedText);

            // Store in vector DB
            await this.vectorStore.addDocuments([{
                id: requestId,
                content: combinedText,
                metadata: {
                    ...metadata,
                    userPrompt,
                    assistantResponse,
                    timestamp: Date.now(),
                    type: 'conversation'
                },
                embedding
            }]);

            // Trace event
            inspector.trace(requestId, 'MEMORY_STORED', {
                promptLength: userPrompt.length,
                responseLength: assistantResponse.length,
                embeddingDim: embedding.length
            });

        } catch (err) {
            console.error('[History] Failed to store conversation:', err.message);
        }
    }

    /**
     * Search for relevant past conversations
     * @param {string} query
     * @param {number} k - Number of results
     * @param {number} threshold - Minimum similarity score (0-1)
     * @returns {Promise<Array>}
     */
    async search(query, k = 3, threshold = 0.7) {
        if (!this.enabled) return [];

        try {
            const embedding = await embeddingsGenerator.embedQuery(query);
            const results = await this.vectorStore.similaritySearch(embedding, k);

            // Filter by threshold
            return results
                .filter(r => r.score >= threshold)
                .map(r => ({
                    content: r.content,
                    metadata: r.metadata,
                    score: r.score
                }));
        } catch (err) {
            console.error('[History] Search failed:', err.message);
            return [];
        }
    }

    /**
     * Get total stored conversations
     */
    getCount() {
        return this.vectorStore.vectors.length;
    }

    /**
     * Clear all history
     */
    clear() {
        this.vectorStore.vectors = [];
    }
}

// Export singleton instance
const instance = new ConversationHistory();
module.exports = instance;
