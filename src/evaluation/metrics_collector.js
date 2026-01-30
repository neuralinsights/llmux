/**
 * LLMux - Performance Metrics Collector
 * Aggregates evaluation data for weight optimization
 */

class MetricsCollector {
    constructor() {
        this.windowSize = parseInt(process.env.METRICS_WINDOW_SIZE || '1000');
        this.metrics = new Map(); // provider -> taskType -> metrics array
    }

    /**
     * Record an evaluation result
     * @param {Object} result - Evaluation result from judge
     */
    record(result) {
        const { primary, shadow, evaluation, taskType } = result;

        // Record for primary provider
        this._recordProvider(primary.provider, taskType, {
            opponent: shadow.provider,
            won: evaluation.winner === 'A',
            score: evaluation.scores.A?.total || 0,
            duration: primary.duration,
            timestamp: Date.now()
        });

        // Record for shadow provider
        this._recordProvider(shadow.provider, taskType, {
            opponent: primary.provider,
            won: evaluation.winner === 'B',
            score: evaluation.scores.B?.total || 0,
            duration: shadow.duration,
            timestamp: Date.now()
        });
    }

    /**
     * Record metrics for a provider
     * @private
     */
    _recordProvider(provider, taskType, data) {
        if (!this.metrics.has(provider)) {
            this.metrics.set(provider, new Map());
        }

        const providerMetrics = this.metrics.get(provider);
        if (!providerMetrics.has(taskType)) {
            providerMetrics.set(taskType, []);
        }

        const taskMetrics = providerMetrics.get(taskType);
        taskMetrics.push(data);

        // Keep only last N entries (rolling window)
        if (taskMetrics.length > this.windowSize) {
            taskMetrics.shift();
        }
    }

    /**
     * Get aggregated metrics for a provider
     * @param {string} provider - Provider name
     * @param {string} taskType - Task type (optional, defaults to 'ALL')
     * @returns {Object} - Aggregated metrics
     */
    getMetrics(provider, taskType = 'ALL') {
        if (!this.metrics.has(provider)) {
            return this._emptyMetrics();
        }

        const providerMetrics = this.metrics.get(provider);

        if (taskType === 'ALL') {
            // Aggregate across all task types
            const allData = [];
            for (const data of providerMetrics.values()) {
                allData.push(...data);
            }
            return this._aggregate(allData);
        } else {
            // Specific task type
            const data = providerMetrics.get(taskType) || [];
            return this._aggregate(data);
        }
    }

    /**
     * Get metrics for all providers
     * @returns {Object} - Map of provider -> metrics
     */
    getAllMetrics() {
        const result = {};

        for (const provider of this.metrics.keys()) {
            result[provider] = {
                overall: this.getMetrics(provider, 'ALL'),
                byTaskType: {}
            };

            // Add per-task-type breakdown
            const providerMetrics = this.metrics.get(provider);
            for (const taskType of providerMetrics.keys()) {
                result[provider].byTaskType[taskType] = this.getMetrics(provider, taskType);
            }
        }

        return result;
    }

    /**
     * Aggregate metrics from data points
     * @private
     */
    _aggregate(data) {
        if (data.length === 0) {
            return this._emptyMetrics();
        }

        const wins = data.filter(d => d.won).length;
        const totalScore = data.reduce((sum, d) => sum + d.score, 0);
        const durations = data.map(d => d.duration).sort((a, b) => a - b);

        return {
            count: data.length,
            winRate: wins / data.length,
            avgScore: totalScore / data.length,
            latency: {
                p50: this._percentile(durations, 0.5),
                p95: this._percentile(durations, 0.95),
                p99: this._percentile(durations, 0.99)
            },
            lastUpdated: data[data.length - 1]?.timestamp || Date.now()
        };
    }

    /**
     * Calculate percentile
     * @private
     */
    _percentile(sorted, p) {
        if (sorted.length === 0) return 0;
        const index = Math.ceil(sorted.length * p) - 1;
        return sorted[Math.max(0, index)];
    }

    /**
     * Empty metrics template
     * @private
     */
    _emptyMetrics() {
        return {
            count: 0,
            winRate: 0,
            avgScore: 0,
            latency: { p50: 0, p95: 0, p99: 0 },
            lastUpdated: Date.now()
        };
    }

    /**
     * Clear all metrics (for testing)
     */
    clear() {
        this.metrics.clear();
    }

    /**
     * Get total evaluations count
     */
    getTotalCount() {
        let total = 0;
        for (const providerMetrics of this.metrics.values()) {
            for (const data of providerMetrics.values()) {
                total += data.length;
            }
        }
        return total;
    }
}

// Export singleton
module.exports = new MetricsCollector();
