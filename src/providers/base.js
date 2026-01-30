/**
 * LLMux - Base Provider Class
 * Abstract base class for all AI providers
 */

const { PROVIDER_CONFIG } = require('../config/providers');

/**
 * Quota state for a provider
 */
class QuotaState {
  constructor(providerName) {
    this.providerName = providerName;
    this.available = true;
    this.lastError = null;
    this.cooldownUntil = null;
    this.requestCount = 0;
    this.lastReset = Date.now();
  }

  /**
   * Check if provider is available
   * @returns {boolean}
   */
  isAvailable() {
    // Check if in cooldown
    if (this.cooldownUntil && Date.now() < this.cooldownUntil) {
      return false;
    }

    // Cooldown expired, reset status
    if (this.cooldownUntil && Date.now() >= this.cooldownUntil) {
      this.available = true;
      this.cooldownUntil = null;
      this.lastError = null;
    }

    return this.available;
  }

  /**
   * Mark quota as exhausted and start cooldown
   * @param {string} error - Error message
   * @param {number} cooldownTime - Cooldown time in ms (default: 10 minutes)
   */
  markExhausted(error, cooldownTime = 600000) {
    this.available = false;
    this.lastError = error;
    this.cooldownUntil = Date.now() + cooldownTime;

    console.log(
      `[QUOTA] ${this.providerName} quota exhausted, cooldown until ${new Date(this.cooldownUntil).toISOString()}`
    );
  }

  /**
   * Reset quota state
   */
  reset() {
    this.available = true;
    this.cooldownUntil = null;
    this.lastError = null;
    this.requestCount = 0;
  }

  /**
   * Increment request count
   */
  incrementRequestCount() {
    this.requestCount++;
  }

  /**
   * Get state as JSON
   * @returns {Object}
   */
  toJSON() {
    return {
      available: this.isAvailable(),
      lastError: this.lastError,
      cooldownUntil: this.cooldownUntil,
      requestCount: this.requestCount,
      lastReset: this.lastReset,
    };
  }
}

/**
 * Abstract base class for AI providers
 * @abstract
 */
class BaseProvider {
  /**
   * @param {string} name - Provider name (claude, gemini, codex, ollama)
   */
  constructor(name) {
    if (!PROVIDER_CONFIG[name]) {
      throw new Error(`Unknown provider: ${name}`);
    }

    this.name = name;
    this.config = PROVIDER_CONFIG[name];
    this.quotaState = new QuotaState(name);
  }

  /**
   * Get default model for this provider
   * @returns {string}
   */
  getDefaultModel() {
    return this.config.defaultModel;
  }

  /**
   * Get timeout for this provider
   * @param {string} type - Timeout type (connect, firstByte, total)
   * @returns {number}
   */
  getTimeout(type = 'total') {
    return this.config.timeouts[type] || this.config.timeouts.total;
  }

  /**
   * Check if provider is available
   * @returns {boolean}
   */
  isAvailable() {
    return this.quotaState.isAvailable();
  }

  /**
   * Mark provider quota as exhausted
   * @param {string} error - Error message
   */
  markQuotaExhausted(error) {
    this.quotaState.markExhausted(error, this.config.cooldownTime);
  }

  /**
   * Reset provider quota state
   */
  resetQuota() {
    this.quotaState.reset();
    console.log(`[QUOTA] ${this.name} status manually reset`);
  }

  /**
   * Check if provider supports streaming
   * @returns {boolean}
   */
  supportsStreaming() {
    return this.config.supportsStream;
  }

  /**
   * Get Standard Request Headers (including Helicone if enabled)
   * @param {Object} options - Request options
   * @returns {Object} Headers
   */
  getRequestHeaders(options = {}) {
    const { getHeliconeHeaders } = require('../integrations/helicone');
    const baseHeaders = {
      'Content-Type': 'application/json',
    };

    const heliconeHeaders = getHeliconeHeaders({
      userId: options.userId,
      sessionId: options.sessionId,
      metadata: {
        provider: this.name,
        model: options.model || this.config.defaultModel,
        ...options.metadata
      }
    });

    return { ...baseHeaders, ...heliconeHeaders };
  }

  /**
   * Call the provider (non-streaming)
   * @abstract
   * @param {string} prompt - The prompt
   * @param {Object} options - Call options
   * @returns {Promise<{provider: string, model: string, response: string, duration: number}>}
   */
  async call(prompt, options = {}) {
    throw new Error('Method not implemented');
  }

  /**
   * Call the provider with streaming
   * @abstract
   * @param {string} prompt - The prompt
   * @param {Object} options - Call options
   * @param {Function} onData - Callback for data chunks
   * @param {Function} onEnd - Callback when complete
   * @param {Function} onError - Callback for errors
   * @returns {*} - Implementation-specific return value
   */
  callStream(prompt, options, onData, onEnd, onError) {
    throw new Error('Method not implemented');
  }

  /**
   * Get provider status for health check
   * @param {number|null} avgLatency - Average latency from metrics
   * @returns {Object}
   */
  getStatus(avgLatency = null) {
    return {
      available: this.isAvailable(),
      model: this.config.defaultModel,
      weight: this.config.weight,
      requestCount: this.quotaState.requestCount,
      cooldownUntil: this.quotaState.cooldownUntil,
      avgLatencyMs: avgLatency,
    };
  }

  /**
   * Get quota state as JSON
   * @returns {Object}
   */
  getQuotaState() {
    return {
      ...this.quotaState.toJSON(),
      cooldownTime: this.config.cooldownTime,
      priority: this.config.priority,
      weight: this.config.weight,
    };
  }
}

module.exports = {
  BaseProvider,
  QuotaState,
};
