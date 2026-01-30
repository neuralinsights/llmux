/**
 * LLMux - Prometheus Metrics
 * Metrics collection and Prometheus format export
 */

/**
 * Metrics collector for LLMux
 */
class MetricsCollector {
  constructor() {
    this.requestsTotal = new Map();    // provider:model:status -> count
    this.latencySum = new Map();       // provider -> total ms
    this.latencyCount = new Map();     // provider -> count
    this.tokensTotal = new Map();      // provider:type -> count
    this.errorsTotal = new Map();      // provider:errorType -> count
    this.activeRequests = 0;
    this.startTime = Date.now();

    // Cache metrics (linked to cache instance)
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Record a metric
   * @param {string} type - Metric type (request, latency, tokens, error, cache_hit, cache_miss)
   * @param {Object} labels - Metric labels
   * @param {number} [value=1] - Metric value
   */
  record(type, labels = {}, value = 1) {
    const key = Object.values(labels).join(':');

    switch (type) {
      case 'request':
        this.requestsTotal.set(key, (this.requestsTotal.get(key) || 0) + value);
        break;

      case 'latency':
        this.latencySum.set(labels.provider, (this.latencySum.get(labels.provider) || 0) + value);
        this.latencyCount.set(labels.provider, (this.latencyCount.get(labels.provider) || 0) + 1);
        break;

      case 'tokens':
        this.tokensTotal.set(key, (this.tokensTotal.get(key) || 0) + value);
        break;

      case 'error':
        this.errorsTotal.set(key, (this.errorsTotal.get(key) || 0) + value);
        break;

      case 'cache_hit':
        this.cacheHits += value;
        break;

      case 'cache_miss':
        this.cacheMisses += value;
        break;
    }
  }

  /**
   * Increment active request count
   */
  incrementActiveRequests() {
    this.activeRequests++;
  }

  /**
   * Decrement active request count
   */
  decrementActiveRequests() {
    this.activeRequests--;
  }

  /**
   * Get average latency for a provider
   * @param {string} provider - Provider name
   * @returns {number|null} Average latency in ms
   */
  getAverageLatency(provider) {
    const sum = this.latencySum.get(provider);
    const count = this.latencyCount.get(provider);
    return count ? Math.round(sum / count) : null;
  }

  /**
   * Get uptime in seconds
   * @returns {number}
   */
  getUptime() {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  /**
   * Export metrics in Prometheus text format
   * @returns {string}
   */
  toPrometheusFormat() {
    const lines = [];

    // Request count
    lines.push('# HELP llmux_requests_total Total number of requests');
    lines.push('# TYPE llmux_requests_total counter');
    for (const [key, value] of this.requestsTotal) {
      const [provider, model, status] = key.split(':');
      lines.push(
        `llmux_requests_total{provider="${provider}",model="${model}",status="${status}"} ${value}`
      );
    }

    // Latency
    lines.push('# HELP llmux_latency_seconds Request latency in seconds');
    lines.push('# TYPE llmux_latency_seconds summary');
    for (const [provider, sum] of this.latencySum) {
      const count = this.latencyCount.get(provider) || 1;
      lines.push(`llmux_latency_seconds_sum{provider="${provider}"} ${sum / 1000}`);
      lines.push(`llmux_latency_seconds_count{provider="${provider}"} ${count}`);
    }

    // Token count
    lines.push('# HELP llmux_tokens_total Total tokens processed');
    lines.push('# TYPE llmux_tokens_total counter');
    for (const [key, value] of this.tokensTotal) {
      const [provider, type] = key.split(':');
      lines.push(`llmux_tokens_total{provider="${provider}",type="${type}"} ${value}`);
    }

    // Cache
    lines.push('# HELP llmux_cache_hits_total Cache hits');
    lines.push('# TYPE llmux_cache_hits_total counter');
    lines.push(`llmux_cache_hits_total ${this.cacheHits}`);

    lines.push('# HELP llmux_cache_misses_total Cache misses');
    lines.push('# TYPE llmux_cache_misses_total counter');
    lines.push(`llmux_cache_misses_total ${this.cacheMisses}`);

    // Errors
    lines.push('# HELP llmux_errors_total Total errors');
    lines.push('# TYPE llmux_errors_total counter');
    for (const [key, value] of this.errorsTotal) {
      const [provider, type] = key.split(':');
      lines.push(`llmux_errors_total{provider="${provider}",type="${type}"} ${value}`);
    }

    // Active requests
    lines.push('# HELP llmux_active_requests Current active requests');
    lines.push('# TYPE llmux_active_requests gauge');
    lines.push(`llmux_active_requests ${this.activeRequests}`);

    // Uptime
    lines.push('# HELP llmux_uptime_seconds Server uptime');
    lines.push('# TYPE llmux_uptime_seconds gauge');
    lines.push(`llmux_uptime_seconds ${this.getUptime()}`);

    return lines.join('\n');
  }

  /**
   * Get summary statistics
   * @returns {Object}
   */
  getSummary() {
    const totalRequests = Array.from(this.requestsTotal.values()).reduce((a, b) => a + b, 0);
    const totalErrors = Array.from(this.errorsTotal.values()).reduce((a, b) => a + b, 0);
    const cacheTotal = this.cacheHits + this.cacheMisses;

    return {
      totalRequests,
      totalErrors,
      errorRate: totalRequests > 0 ? ((totalErrors / totalRequests) * 100).toFixed(2) + '%' : '0%',
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      cacheHitRate: cacheTotal > 0 ? ((this.cacheHits / cacheTotal) * 100).toFixed(2) + '%' : 'N/A',
      activeRequests: this.activeRequests,
      uptimeSeconds: this.getUptime(),
    };
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.requestsTotal.clear();
    this.latencySum.clear();
    this.latencyCount.clear();
    this.tokensTotal.clear();
    this.errorsTotal.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    // Don't reset activeRequests or startTime
  }
}

// Singleton instance
const metrics = new MetricsCollector();

module.exports = {
  MetricsCollector,
  metrics,
};
