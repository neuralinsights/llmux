/**
 * LLMux - Vector Store
 * Abstract Base Class and Memory Implementation
 */

class VectorStore {
    async addDocuments(documents) { throw new Error('Not implemented'); }
    async similaritySearch(queryEmbedding, k) { throw new Error('Not implemented'); }
}

class MemoryVectorStore extends VectorStore {
    constructor() {
        super();
        this.vectors = []; // { id, content, metadata, embedding }
    }

    async addDocuments(documents) {
        for (const doc of documents) {
            this.vectors.push({
                id: doc.id || Math.random().toString(36).substring(7),
                content: doc.content,
                metadata: doc.metadata || {},
                embedding: doc.embedding
            });
        }
        return true;
    }

    async similaritySearch(queryEmbedding, k = 3) {
        // Naive Cosine Similarity
        const scores = this.vectors.map(doc => {
            const similarity = this.cosineSimilarity(queryEmbedding, doc.embedding);
            return { ...doc, score: similarity };
        });

        // Sort descending and take top k
        return scores
            .sort((a, b) => b.score - a.score)
            .slice(0, k);
    }

    cosineSimilarity(vecA, vecB) {
        if (vecA.length !== vecB.length) return 0;

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
    }
}

module.exports = { VectorStore, MemoryVectorStore };
