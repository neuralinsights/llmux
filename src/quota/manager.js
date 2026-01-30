/**
 * LLMux - Quota Manager
 * Manages per-key token budgets and cost tracking
 *
 * @module quota/manager
 */

const { EventEmitter } = require('events');
const { estimateCost } = require('../utils/tokenCounter');

/**
 * Quota period types
 */
const PERIOD = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
};

/**
 * Quota Manager for tracking and enforcing usage limits
 * @extends EventEmitter
 */
class QuotaManager extends EventEmitter {
  /**
   * @param {Object} options - Configuration options
   * @param {number} [options.defaultTokenLimit=1000000] - Default token limit per period
   * @param {number} [options.defaultCostLimit=100] - Default cost limit in USD per period
   * @param {string} [options.period='monthly'] - Quota period (daily, weekly, monthly)
   * @param {number} [options.warningThreshold=0.8] - Warning threshold (0-1)
   * @param {Function} [options.onWarning] - Callback when threshold reached
   * @param {Function} [options.onExceeded] - Callback when quota exceeded
   */
  constructor(options = {}) {
    super();

    this.defaultTokenLimit = options.defaultTokenLimit || 1_000_000;
    this.defaultCostLimit = options.defaultCostLimit || 100;
    this.period = options.period || PERIOD.MONTHLY;
    this.warningThreshold = options.warningThreshold || 0.8;
    this.onWarning = options.onWarning;
    this.onExceeded = options.onExceeded;

    // Store: apiKey -> QuotaEntry
    this.quotas = new Map();

    // Custom limits per key
    this.keyLimits = new Map();

    // Period reset scheduler
    this._scheduleReset();
  }

  /**
   * Get or create quota entry for a key
   * @param {string} apiKey - API key
   * @returns {Object} Quota entry
   */
  _getEntry(apiKey) {
    if (!this.quotas.has(apiKey)) {
      const limits = this.keyLimits.get(apiKey) || {};
      this.quotas.set(apiKey, {
        tokensUsed: 0,
        costUsed: 0,
        requestCount: 0,
        tokenLimit: limits.tokenLimit || this.defaultTokenLimit,
        costLimit: limits.costLimit || this.defaultCostLimit,
        periodStart: this._getPeriodStart(),
        lastUpdated: Date.now(),
        history: [],
      });
    }
    return this.quotas.get(apiKey);
  }

  /**
   * Get period start timestamp
   * @returns {number} Period start timestamp
   */
  _getPeriodStart() {
    const now = new Date();

    switch (this.period) {
      case PERIOD.DAILY:
        return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

      case PERIOD.WEEKLY: {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(now.getFullYear(), now.getMonth(), diff).getTime();
      }

      case PERIOD.MONTHLY:
      default:
        return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    }
  }

  /**
   * Get next reset timestamp
   * @returns {number} Next reset timestamp
   */
  _getNextReset() {
    const now = new Date();

    switch (this.period) {
      case PERIOD.DAILY:
        return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();

      case PERIOD.WEEKLY: {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1) + 7;
        return new Date(now.getFullYear(), now.getMonth(), diff).getTime();
      }

      case PERIOD.MONTHLY:
      default:
        return new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
    }
  }

  /**
   * Schedule periodic reset
   */
  _scheduleReset() {
    const nextReset = this._getNextReset();
    const delay = nextReset - Date.now();

    this.resetTimer = setTimeout(() => {
      this.resetAll();
      this._scheduleReset();
    }, delay);
  }

  /**
   * Set custom limits for an API key
   * @param {string} apiKey - API key
   * @param {Object} limits - Custom limits
   * @param {number} [limits.tokenLimit] - Token limit
   * @param {number} [limits.costLimit] - Cost limit in USD
   */
  setKeyLimits(apiKey, limits) {
    this.keyLimits.set(apiKey, limits);

    // Update existing entry if present
    if (this.quotas.has(apiKey)) {
      const entry = this.quotas.get(apiKey);
      if (limits.tokenLimit !== undefined) entry.tokenLimit = limits.tokenLimit;
      if (limits.costLimit !== undefined) entry.costLimit = limits.costLimit;
    }
  }

  /**
   * Get limits for an API key
   * @param {string} apiKey - API key
   * @returns {Object} Limits
   */
  getKeyLimits(apiKey) {
    const entry = this._getEntry(apiKey);
    return {
      tokenLimit: entry.tokenLimit,
      costLimit: entry.costLimit,
    };
  }

  /**
   * Record usage for an API key
   * @param {string} apiKey - API key
   * @param {Object} usage - Usage data
   * @param {number} usage.promptTokens - Prompt tokens used
   * @param {number} usage.completionTokens - Completion tokens used
   * @param {string} usage.model - Model used
   * @param {string} [usage.provider] - Provider used
   * @returns {{allowed: boolean, remaining: Object, usage: Object}}
   */
  recordUsage(apiKey, usage) {
    const entry = this._getEntry(apiKey);
    const { promptTokens = 0, completionTokens = 0, model = 'gpt-4', provider } = usage;

    const totalTokens = promptTokens + completionTokens;
    const cost = estimateCost(promptTokens, completionTokens, model);

    // Check if this would exceed limits
    const wouldExceedTokens = entry.tokensUsed + totalTokens > entry.tokenLimit;
    const wouldExceedCost = entry.costUsed + cost.totalCost > entry.costLimit;

    if (wouldExceedTokens || wouldExceedCost) {
      this.emit('exceeded', {
        apiKey,
        type: wouldExceedTokens ? 'tokens' : 'cost',
        current: wouldExceedTokens ? entry.tokensUsed : entry.costUsed,
        limit: wouldExceedTokens ? entry.tokenLimit : entry.costLimit,
        requested: wouldExceedTokens ? totalTokens : cost.totalCost,
      });

      if (this.onExceeded) {
        this.onExceeded(apiKey, {
          type: wouldExceedTokens ? 'tokens' : 'cost',
          current: wouldExceedTokens ? entry.tokensUsed : entry.costUsed,
          limit: wouldExceedTokens ? entry.tokenLimit : entry.costLimit,
        });
      }

      return {
        allowed: false,
        exceededType: wouldExceedTokens ? 'tokens' : 'cost',
        remaining: this._getRemaining(entry),
        usage: { tokensUsed: entry.tokensUsed, costUsed: entry.costUsed },
      };
    }

    // Record usage
    entry.tokensUsed += totalTokens;
    entry.costUsed += cost.totalCost;
    entry.requestCount += 1;
    entry.lastUpdated = Date.now();

    // Add to history
    entry.history.push({
      timestamp: Date.now(),
      promptTokens,
      completionTokens,
      cost: cost.totalCost,
      model,
      provider,
    });

    // Keep history limited
    if (entry.history.length > 1000) {
      entry.history = entry.history.slice(-500);
    }

    // Check warning threshold
    const tokenRatio = entry.tokensUsed / entry.tokenLimit;
    const costRatio = entry.costUsed / entry.costLimit;

    if (tokenRatio >= this.warningThreshold || costRatio >= this.warningThreshold) {
      this.emit('warning', {
        apiKey,
        tokenUsage: tokenRatio,
        costUsage: costRatio,
        remaining: this._getRemaining(entry),
      });

      if (this.onWarning) {
        this.onWarning(apiKey, { tokenRatio, costRatio });
      }
    }

    return {
      allowed: true,
      remaining: this._getRemaining(entry),
      usage: {
        tokensUsed: entry.tokensUsed,
        costUsed: entry.costUsed,
        requestCount: entry.requestCount,
      },
    };
  }

  /**
   * Get remaining quota
   * @param {Object} entry - Quota entry
   * @returns {Object} Remaining quota
   */
  _getRemaining(entry) {
    return {
      tokens: Math.max(0, entry.tokenLimit - entry.tokensUsed),
      cost: Math.max(0, entry.costLimit - entry.costUsed),
      tokenPercent: ((entry.tokenLimit - entry.tokensUsed) / entry.tokenLimit * 100).toFixed(2),
      costPercent: ((entry.costLimit - entry.costUsed) / entry.costLimit * 100).toFixed(2),
    };
  }

  /**
   * Check quota without recording usage
   * @param {string} apiKey - API key
   * @returns {Object} Quota status
   */
  check(apiKey) {
    const entry = this._getEntry(apiKey);

    return {
      tokensUsed: entry.tokensUsed,
      tokenLimit: entry.tokenLimit,
      costUsed: entry.costUsed,
      costLimit: entry.costLimit,
      requestCount: entry.requestCount,
      remaining: this._getRemaining(entry),
      periodStart: new Date(entry.periodStart).toISOString(),
      nextReset: new Date(this._getNextReset()).toISOString(),
      period: this.period,
    };
  }

  /**
   * Reset quota for an API key
   * @param {string} apiKey - API key
   */
  reset(apiKey) {
    const limits = this.keyLimits.get(apiKey) || {};
    this.quotas.set(apiKey, {
      tokensUsed: 0,
      costUsed: 0,
      requestCount: 0,
      tokenLimit: limits.tokenLimit || this.defaultTokenLimit,
      costLimit: limits.costLimit || this.defaultCostLimit,
      periodStart: this._getPeriodStart(),
      lastUpdated: Date.now(),
      history: [],
    });

    this.emit('reset', { apiKey });
  }

  /**
   * Reset all quotas
   */
  resetAll() {
    for (const apiKey of this.quotas.keys()) {
      this.reset(apiKey);
    }

    this.emit('resetAll');
  }

  /**
   * Get usage report for an API key
   * @param {string} apiKey - API key
   * @returns {Object} Usage report
   */
  getReport(apiKey) {
    const entry = this._getEntry(apiKey);

    // Aggregate by model
    const byModel = {};
    for (const record of entry.history) {
      if (!byModel[record.model]) {
        byModel[record.model] = { tokens: 0, cost: 0, requests: 0 };
      }
      byModel[record.model].tokens += record.promptTokens + record.completionTokens;
      byModel[record.model].cost += record.cost;
      byModel[record.model].requests += 1;
    }

    // Aggregate by provider
    const byProvider = {};
    for (const record of entry.history) {
      const provider = record.provider || 'unknown';
      if (!byProvider[provider]) {
        byProvider[provider] = { tokens: 0, cost: 0, requests: 0 };
      }
      byProvider[provider].tokens += record.promptTokens + record.completionTokens;
      byProvider[provider].cost += record.cost;
      byProvider[provider].requests += 1;
    }

    return {
      apiKey,
      period: this.period,
      periodStart: new Date(entry.periodStart).toISOString(),
      nextReset: new Date(this._getNextReset()).toISOString(),
      summary: {
        tokensUsed: entry.tokensUsed,
        tokenLimit: entry.tokenLimit,
        tokenUsagePercent: ((entry.tokensUsed / entry.tokenLimit) * 100).toFixed(2),
        costUsed: parseFloat(entry.costUsed.toFixed(4)),
        costLimit: entry.costLimit,
        costUsagePercent: ((entry.costUsed / entry.costLimit) * 100).toFixed(2),
        requestCount: entry.requestCount,
      },
      breakdown: {
        byModel,
        byProvider,
      },
      lastUpdated: new Date(entry.lastUpdated).toISOString(),
    };
  }

  /**
   * Get all quotas summary
   * @returns {Array} All quota summaries
   */
  getAll() {
    const result = [];

    for (const [apiKey, entry] of this.quotas) {
      result.push({
        apiKey: `${apiKey.slice(0, 8)}...`,
        tokensUsed: entry.tokensUsed,
        tokenLimit: entry.tokenLimit,
        costUsed: parseFloat(entry.costUsed.toFixed(4)),
        costLimit: entry.costLimit,
        requestCount: entry.requestCount,
      });
    }

    return result;
  }

  /**
   * Get statistics
   * @returns {Object} Statistics
   */
  getStats() {
    let totalTokens = 0;
    let totalCost = 0;
    let totalRequests = 0;

    for (const entry of this.quotas.values()) {
      totalTokens += entry.tokensUsed;
      totalCost += entry.costUsed;
      totalRequests += entry.requestCount;
    }

    return {
      activeKeys: this.quotas.size,
      customLimits: this.keyLimits.size,
      period: this.period,
      defaultTokenLimit: this.defaultTokenLimit,
      defaultCostLimit: this.defaultCostLimit,
      totals: {
        tokens: totalTokens,
        cost: parseFloat(totalCost.toFixed(4)),
        requests: totalRequests,
      },
      nextReset: new Date(this._getNextReset()).toISOString(),
    };
  }

  /**
   * Destroy the quota manager
   */
  destroy() {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }
    this.quotas.clear();
    this.keyLimits.clear();
    this.removeAllListeners();
  }
}

module.exports = {
  QuotaManager,
  PERIOD,
};
