/**
 * LLMux - Dynamic Weight Optimizer
 * Automatically adjusts provider weights based on performance
 */

const metricsCollector = require('../evaluation/metrics_collector');
const { PROVIDER_CONFIG } = require('../config/providers');
const inspector = require('../telemetry/inspector');

class WeightOptimizer {
    constructor() {
        this.enabled = process.env.ENABLE_WEIGHT_OPTIMIZER !== 'false';
        this.updateInterval = parseInt(process.env.WEIGHT_UPDATE_INTERVAL || '86400000'); // 24h
        this.minComparisons = parseInt(process.env.MIN_COMPARISONS_FOR_UPDATE || '50');
        this.learningRate = parseFloat(process.env.WEIGHT_LEARNING_RATE || '0.2');
        this.minWeight = 5; // Minimum 5%
        this.maxWeight = 70; // Maximum 70%
        this.maxChange = 10; // Max ±10% per update

        this.dynamicWeights = new Map(); // provider -> weight
        this.intervalId = null;
        this.lastUpdate = null;

        // Initialize with config weights
        this._initializeWeights();
    }

    /**
     * Initialize dynamic weights from config
     * @private
     */
    _initializeWeights() {
        for (const [provider, config] of Object.entries(PROVIDER_CONFIG)) {
            this.dynamicWeights.set(provider, config.weight);
        }
    }

    /**
     * Get current dynamic weight for a provider
     * @param {string} provider - Provider name
     * @returns {number} - Current weight
     */
    getWeight(provider) {
        return this.dynamicWeights.get(provider) || PROVIDER_CONFIG[provider]?.weight || 0;
    }

    /**
     * Get all current weights
     * @returns {Object} - Map of provider -> weight
     */
    getWeights() {
        const weights = {};
        for (const [provider, weight] of this.dynamicWeights.entries()) {
            weights[provider] = weight;
        }
        return weights;
    }

    /**
     * Update weights based on performance metrics
     */
    async updateWeights() {
        if (!this.enabled) {
            console.log('[WeightOptimizer] Disabled, skipping update');
            return;
        }

        try {
            const allMetrics = metricsCollector.getAllMetrics();
            const updates = [];

            for (const [provider, metrics] of Object.entries(allMetrics)) {
                const overall = metrics.overall;

                // Skip if insufficient data
                if (overall.count < this.minComparisons) {
                    console.log(`[WeightOptimizer] ${provider}: Insufficient data (${overall.count}/${this.minComparisons})`);
                    continue;
                }

                const currentWeight = this.getWeight(provider);
                const winRate = overall.winRate;

                // Calculate new weight using simplified multi-armed bandit
                // newWeight = currentWeight * (1 + learningRate * (winRate - 0.5))
                const adjustment = this.learningRate * (winRate - 0.5);
                let newWeight = currentWeight * (1 + adjustment);

                // Apply constraints
                newWeight = Math.max(this.minWeight, Math.min(this.maxWeight, newWeight));

                // Limit change per update
                const maxDelta = this.maxChange;
                if (newWeight > currentWeight + maxDelta) {
                    newWeight = currentWeight + maxDelta;
                } else if (newWeight < currentWeight - maxDelta) {
                    newWeight = currentWeight - maxDelta;
                }

                // Round to 1 decimal
                newWeight = Math.round(newWeight * 10) / 10;

                if (Math.abs(newWeight - currentWeight) >= 0.5) {
                    updates.push({
                        provider,
                        oldWeight: currentWeight,
                        newWeight,
                        winRate,
                        count: overall.count,
                        avgScore: overall.avgScore
                    });

                    this.dynamicWeights.set(provider, newWeight);
                }
            }

            // Normalize weights to sum to 100
            this._normalizeWeights();

            if (updates.length > 0) {
                console.log('[WeightOptimizer] Updated weights:', updates);
                inspector.trace('optimizer', 'WEIGHT_UPDATE', {
                    updates,
                    timestamp: Date.now()
                });
            } else {
                console.log('[WeightOptimizer] No significant changes');
            }

            this.lastUpdate = Date.now();

        } catch (err) {
            console.error('[WeightOptimizer] Update failed:', err.message);
        }
    }

    /**
     * Normalize weights to sum to 100
     * @private
     */
    _normalizeWeights() {
        const total = Array.from(this.dynamicWeights.values()).reduce((sum, w) => sum + w, 0);

        if (total === 0) return;

        for (const [provider, weight] of this.dynamicWeights.entries()) {
            const normalized = (weight / total) * 100;
            this.dynamicWeights.set(provider, Math.round(normalized * 10) / 10);
        }
    }

    /**
     * Reset weights to config defaults
     */
    resetWeights() {
        this._initializeWeights();
        console.log('[WeightOptimizer] Reset to config defaults');
        inspector.trace('optimizer', 'WEIGHT_RESET', {
            weights: this.getWeights()
        });
    }

    /**
     * Start automatic weight updates
     */
    start() {
        if (!this.enabled) {
            console.log('[WeightOptimizer] Disabled');
            return;
        }

        if (this.intervalId) {
            console.log('[WeightOptimizer] Already running');
            return;
        }

        console.log(`[WeightOptimizer] Started (interval: ${this.updateInterval}ms)`);

        // Run immediately on start
        this.updateWeights();

        // Schedule periodic updates
        this.intervalId = setInterval(() => {
            this.updateWeights();
        }, this.updateInterval);
    }

    /**
     * Stop automatic updates
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('[WeightOptimizer] Stopped');
        }
    }

    /**
     * Get optimizer status
     */
    getStatus() {
        return {
            enabled: this.enabled,
            running: this.intervalId !== null,
            lastUpdate: this.lastUpdate,
            nextUpdate: this.lastUpdate ? this.lastUpdate + this.updateInterval : null,
            weights: this.getWeights(),
            totalEvaluations: metricsCollector.getTotalCount()
        };
    }
}

// Export singleton
module.exports = new WeightOptimizer();
