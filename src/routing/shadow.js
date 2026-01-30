/**
 * LLMux - Shadow Router
 * Duplicates requests to multiple providers for A/B testing
 */

const { getProvider, getAvailableProviders } = require('../providers');
const inspector = require('../telemetry/inspector');

class ShadowRouter {
    constructor() {
        this.enabled = process.env.ENABLE_SHADOW === 'true';
        this.rate = parseFloat(process.env.SHADOW_RATE || '0.05'); // 5% default
        this.maxConcurrent = parseInt(process.env.SHADOW_MAX_CONCURRENT || '2');
        this.excludeProviders = (process.env.SHADOW_EXCLUDE || 'ollama').split(',');
        this.comparisonQueue = []; // Store for judge processing
    }

    /**
     * Determine if this request should be shadowed
     */
    shouldShadow() {
        if (!this.enabled) return false;
        return Math.random() < this.rate;
    }

    /**
     * Execute shadow requests in parallel (async, non-blocking)
     * @param {string} prompt - Original prompt
     * @param {Object} options - Request options
     * @param {string} primaryProvider - Provider used for primary response
     * @param {string} primaryResponse - Primary response text
     * @param {string} requestId - Request ID for tracing
     */
    async executeShadow({ prompt, options, primaryProvider, primaryResponse, requestId }) {
        if (!this.shouldShadow()) return;

        try {
            // Get available providers excluding primary and excluded list
            const available = getAvailableProviders()
                .filter(p => p.name !== primaryProvider)
                .filter(p => !this.excludeProviders.includes(p.name));

            if (available.length === 0) {
                inspector.trace(requestId, 'SHADOW_SKIP', { reason: 'NO_ALTERNATIVES' });
                return;
            }

            // Select up to maxConcurrent providers
            const shadowProviders = available
                .sort(() => Math.random() - 0.5) // Shuffle
                .slice(0, this.maxConcurrent);

            inspector.trace(requestId, 'SHADOW_START', {
                primary: primaryProvider,
                shadows: shadowProviders.map(p => p.name),
                rate: this.rate
            });

            // Execute shadow requests in parallel (don't await)
            const shadowPromises = shadowProviders.map(async (providerInfo) => {
                const startTime = Date.now();
                try {
                    const provider = getProvider(providerInfo.name);
                    const result = await provider.call(prompt, {
                        ...options,
                        timeout: options.timeout || 30000
                    });

                    const duration = Date.now() - startTime;

                    // Store comparison for judge
                    this.comparisonQueue.push({
                        requestId,
                        prompt,
                        primary: {
                            provider: primaryProvider,
                            response: primaryResponse,
                            duration: options.primaryDuration || 0
                        },
                        shadow: {
                            provider: providerInfo.name,
                            response: result.response,
                            duration
                        },
                        timestamp: Date.now(),
                        taskType: options.taskType || 'UNKNOWN'
                    });

                    inspector.trace(requestId, 'SHADOW_COMPLETE', {
                        provider: providerInfo.name,
                        duration,
                        queueSize: this.comparisonQueue.length
                    });

                } catch (err) {
                    inspector.trace(requestId, 'SHADOW_ERROR', {
                        provider: providerInfo.name,
                        error: err.message
                    });
                }
            });

            // Don't block - let shadows complete in background
            Promise.all(shadowPromises).catch(err => {
                console.error('[Shadow] Background execution failed:', err.message);
            });

        } catch (err) {
            console.error('[Shadow] Failed to execute:', err.message);
        }
    }

    /**
     * Get pending comparisons for judge processing
     * @param {number} limit - Max comparisons to return
     */
    getComparisons(limit = 10) {
        const batch = this.comparisonQueue.splice(0, limit);
        return batch;
    }

    /**
     * Get queue size
     */
    getQueueSize() {
        return this.comparisonQueue.length;
    }

    /**
     * Clear queue (for testing)
     */
    clearQueue() {
        this.comparisonQueue = [];
    }
}

// Export singleton
module.exports = new ShadowRouter();
