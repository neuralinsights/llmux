/**
 * LLMux - Context Injector
 * Transparently augments prompts with relevant memory
 */

const conversationHistory = require('./history');
const inspector = require('../telemetry/inspector');

class ContextInjector {
    constructor() {
        this.enabled = process.env.CONTEXT_INJECTION_ENABLED !== 'false';
        this.maxChunks = parseInt(process.env.MAX_CONTEXT_CHUNKS || '3');
        this.relevanceThreshold = parseFloat(process.env.CONTEXT_RELEVANCE_THRESHOLD || '0.7');
    }

    /**
     * Augment a prompt with relevant context from memory
     * @param {string} prompt - Original user prompt
     * @param {string} requestId - Request ID for tracing
     * @param {Object} options - { disableMemory: boolean }
     * @returns {Promise<{ augmentedPrompt: string, injectedChunks: Array }>}
     */
    async augment(prompt, requestId, options = {}) {
        // Check if injection is disabled
        if (!this.enabled || options.disableMemory) {
            return { augmentedPrompt: prompt, injectedChunks: [] };
        }

        try {
            // Search for relevant past conversations
            const results = await conversationHistory.search(
                prompt,
                this.maxChunks,
                this.relevanceThreshold
            );

            // If no relevant context found, return original
            if (results.length === 0) {
                inspector.trace(requestId, 'CONTEXT_INJECTION', {
                    status: 'NO_RELEVANT_CONTEXT',
                    searched: conversationHistory.getCount()
                });
                return { augmentedPrompt: prompt, injectedChunks: [] };
            }

            // Format context
            const contextSection = this._formatContext(results);

            // Prepend context to prompt
            const augmentedPrompt = `${contextSection}\n\n[USER QUERY]\n${prompt}`;

            // Trace injection
            inspector.trace(requestId, 'CONTEXT_INJECTION', {
                status: 'INJECTED',
                chunks: results.length,
                avgRelevance: (results.reduce((sum, r) => sum + r.score, 0) / results.length).toFixed(2),
                addedTokens: contextSection.length
            });

            return {
                augmentedPrompt,
                injectedChunks: results.map(r => ({
                    content: r.content,
                    score: r.score,
                    timestamp: r.metadata.timestamp
                }))
            };

        } catch (err) {
            console.error('[Injector] Augmentation failed:', err.message);
            return { augmentedPrompt: prompt, injectedChunks: [] };
        }
    }

    /**
     * Format retrieved context for injection
     * @private
     */
    _formatContext(results) {
        const lines = ['[CONTEXT FROM MEMORY]'];

        results.forEach((result, idx) => {
            const date = new Date(result.metadata.timestamp).toISOString().split('T')[0];
            const preview = result.metadata.userPrompt?.slice(0, 100) || result.content.slice(0, 100);
            lines.push(`- [${date}] ${preview}... (relevance: ${(result.score * 100).toFixed(0)}%)`);
        });

        return lines.join('\n');
    }

    /**
     * Middleware factory for Express
     */
    middleware() {
        return async (req, res, next) => {
            // Only apply to /api/smart
            if (!req.path.includes('/api/smart')) {
                return next();
            }

            const originalPrompt = req.body.prompt;
            if (!originalPrompt) return next();

            const requestId = req.id || 'unknown';
            const { augmentedPrompt, injectedChunks } = await this.augment(
                originalPrompt,
                requestId,
                req.body.options || {}
            );

            // Replace prompt with augmented version
            req.body.prompt = augmentedPrompt;

            // Attach metadata for downstream use
            req.contextInjection = {
                original: originalPrompt,
                chunks: injectedChunks
            };

            next();
        };
    }
}

module.exports = new ContextInjector();
