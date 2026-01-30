/**
 * LLMux - Dynamic Router
 * Intelligent routing based on task type, latency, and cost
 *
 * @module routing/dynamic
 */

const { getProvider, getAvailableProviders } = require('../providers');

/**
 * Task types for routing
 */
const TASK_TYPE = {
  CHAT: 'chat',
  CODE: 'code',
  ANALYSIS: 'analysis',
  CREATIVE: 'creative',
  TRANSLATION: 'translation',
  SUMMARIZATION: 'summarization',
  EMBEDDING: 'embedding',
  GENERAL: 'general',
};

/**
 * Provider capabilities and characteristics
 */
const PROVIDER_PROFILES = {
  claude: {
    strengths: [TASK_TYPE.CODE, TASK_TYPE.ANALYSIS, TASK_TYPE.CREATIVE],
    avgLatency: 2000,
    costPerMToken: { input: 3.0, output: 15.0 },
    qualityScore: 0.95,
    maxTokens: 200000,
  },
  gemini: {
    strengths: [TASK_TYPE.CHAT, TASK_TYPE.TRANSLATION, TASK_TYPE.SUMMARIZATION],
    avgLatency: 1500,
    costPerMToken: { input: 0.075, output: 0.30 },
    qualityScore: 0.88,
    maxTokens: 128000,
  },
  codex: {
    strengths: [TASK_TYPE.CODE, TASK_TYPE.ANALYSIS],
    avgLatency: 3000,
    costPerMToken: { input: 10.0, output: 30.0 },
    qualityScore: 0.92,
    maxTokens: 128000,
  },
  ollama: {
    strengths: [TASK_TYPE.CHAT, TASK_TYPE.GENERAL],
    avgLatency: 500,
    costPerMToken: { input: 0, output: 0 },
    qualityScore: 0.75,
    maxTokens: 32000,
  },
};

/**
 * Dynamic Router for intelligent provider selection
 */
class DynamicRouter {
  /**
   * @param {Object} options - Router options
   * @param {string} [options.strategy='balanced'] - Routing strategy (latency, cost, quality, balanced)
   * @param {Object} [options.weights] - Weight configuration for balanced strategy
   */
  constructor(options = {}) {
    this.strategy = options.strategy || 'balanced';
    this.weights = options.weights || {
      latency: 0.3,
      cost: 0.3,
      quality: 0.4,
    };

    // Latency tracking (sliding window)
    this.latencyHistory = new Map();
    this.maxHistorySize = 100;

    // Load custom profiles from environment
    this.profiles = { ...PROVIDER_PROFILES };
  }

  /**
   * Detect task type from prompt
   * @param {string} prompt - Input prompt
   * @param {Object} [options] - Additional options
   * @returns {string} Detected task type
   */
  detectTaskType(prompt, options = {}) {
    // Explicit task type from options
    if (options.taskType) {
      return options.taskType;
    }

    const lowerPrompt = prompt.toLowerCase();

    // Code-related patterns
    if (
      /\b(code|function|class|implement|debug|fix|refactor|programming|javascript|python|typescript|rust|go)\b/.test(
        lowerPrompt
      )
    ) {
      return TASK_TYPE.CODE;
    }

    // Analysis patterns
    if (/\b(analyze|analysis|explain|understand|examine|review|evaluate)\b/.test(lowerPrompt)) {
      return TASK_TYPE.ANALYSIS;
    }

    // Creative patterns
    if (/\b(write|story|poem|creative|imagine|create|compose|design)\b/.test(lowerPrompt)) {
      return TASK_TYPE.CREATIVE;
    }

    // Translation patterns
    if (/\b(translate|translation|convert|to\s+\w+\s+language)\b/.test(lowerPrompt)) {
      return TASK_TYPE.TRANSLATION;
    }

    // Summarization patterns
    if (/\b(summarize|summary|tldr|brief|condense|shorten)\b/.test(lowerPrompt)) {
      return TASK_TYPE.SUMMARIZATION;
    }

    // Chat patterns
    if (/\b(hello|hi|hey|chat|conversation|talk)\b/.test(lowerPrompt)) {
      return TASK_TYPE.CHAT;
    }

    return TASK_TYPE.GENERAL;
  }

  /**
   * Get provider score for a task
   * @param {string} providerName - Provider name
   * @param {string} taskType - Task type
   * @returns {Object} Score breakdown
   */
  getProviderScore(providerName, taskType) {
    const profile = this.profiles[providerName];
    if (!profile) {
      return { total: 0, breakdown: {} };
    }

    // Quality score (higher for matching strengths)
    let qualityScore = profile.qualityScore;
    if (profile.strengths.includes(taskType)) {
      qualityScore += 0.05; // Bonus for matching task type
    }

    // Latency score (lower is better, normalized to 0-1)
    const avgLatency = this._getAverageLatency(providerName) || profile.avgLatency;
    const latencyScore = Math.max(0, 1 - avgLatency / 5000); // 5s as max reference

    // Cost score (lower is better, normalized to 0-1)
    const avgCost = (profile.costPerMToken.input + profile.costPerMToken.output) / 2;
    const costScore = Math.max(0, 1 - avgCost / 50); // $50/M as max reference

    // Calculate weighted score
    const total =
      this.weights.quality * qualityScore +
      this.weights.latency * latencyScore +
      this.weights.cost * costScore;

    return {
      total,
      breakdown: {
        quality: qualityScore,
        latency: latencyScore,
        cost: costScore,
        weights: this.weights,
      },
    };
  }

  /**
   * Select best provider for a request
   * @param {string} prompt - Input prompt
   * @param {Object} [options] - Request options
   * @returns {{provider: string, score: Object, taskType: string, alternatives: Array}}
   */
  selectProvider(prompt, options = {}) {
    const taskType = this.detectTaskType(prompt, options);
    const availableProviders = getAvailableProviders();

    if (availableProviders.length === 0) {
      throw new Error('No providers available');
    }

    // Score all providers
    const scored = availableProviders
      .map((p) => ({
        name: p.name,
        ...this.getProviderScore(p.name, taskType),
      }))
      .sort((a, b) => b.total - a.total);

    // Apply strategy-specific selection
    let selectedIndex = 0;

    switch (this.strategy) {
      case 'latency':
        // Sort by latency only
        scored.sort((a, b) => b.breakdown.latency - a.breakdown.latency);
        break;

      case 'cost':
        // Sort by cost only
        scored.sort((a, b) => b.breakdown.cost - a.breakdown.cost);
        break;

      case 'quality':
        // Sort by quality only
        scored.sort((a, b) => b.breakdown.quality - a.breakdown.quality);
        break;

      case 'round-robin':
        // Simple round-robin
        this._rrIndex = ((this._rrIndex || 0) + 1) % scored.length;
        selectedIndex = this._rrIndex;
        break;

      case 'random':
        // Weighted random based on scores
        const totalScore = scored.reduce((sum, p) => sum + p.total, 0);
        let random = Math.random() * totalScore;
        for (let i = 0; i < scored.length; i++) {
          random -= scored[i].total;
          if (random <= 0) {
            selectedIndex = i;
            break;
          }
        }
        break;

      case 'balanced':
      default:
        // Already sorted by balanced score
        break;
    }

    const selected = scored[selectedIndex];

    return {
      provider: selected.name,
      score: selected,
      taskType,
      alternatives: scored.slice(1, 4), // Top 3 alternatives
      strategy: this.strategy,
    };
  }

  /**
   * Record latency for a provider
   * @param {string} providerName - Provider name
   * @param {number} latency - Latency in milliseconds
   */
  recordLatency(providerName, latency) {
    if (!this.latencyHistory.has(providerName)) {
      this.latencyHistory.set(providerName, []);
    }

    const history = this.latencyHistory.get(providerName);
    history.push({ timestamp: Date.now(), latency });

    // Keep history limited
    if (history.length > this.maxHistorySize) {
      history.shift();
    }
  }

  /**
   * Get average latency for a provider
   * @param {string} providerName - Provider name
   * @returns {number|null} Average latency or null
   */
  _getAverageLatency(providerName) {
    const history = this.latencyHistory.get(providerName);
    if (!history || history.length === 0) {
      return null;
    }

    // Use exponential moving average for recent bias
    const alpha = 0.3;
    let ema = history[0].latency;

    for (let i = 1; i < history.length; i++) {
      ema = alpha * history[i].latency + (1 - alpha) * ema;
    }

    return Math.round(ema);
  }

  /**
   * Set routing strategy
   * @param {string} strategy - Routing strategy
   */
  setStrategy(strategy) {
    this.strategy = strategy;
  }

  /**
   * Set weight configuration
   * @param {Object} weights - Weight configuration
   */
  setWeights(weights) {
    this.weights = { ...this.weights, ...weights };
  }

  /**
   * Update provider profile
   * @param {string} providerName - Provider name
   * @param {Object} profile - Profile updates
   */
  updateProfile(providerName, profile) {
    this.profiles[providerName] = {
      ...this.profiles[providerName],
      ...profile,
    };
  }

  /**
   * Get routing statistics
   * @returns {Object} Router statistics
   */
  getStats() {
    const latencyStats = {};

    for (const [provider, history] of this.latencyHistory) {
      if (history.length > 0) {
        const latencies = history.map((h) => h.latency);
        latencyStats[provider] = {
          avg: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
          min: Math.min(...latencies),
          max: Math.max(...latencies),
          samples: history.length,
        };
      }
    }

    return {
      strategy: this.strategy,
      weights: this.weights,
      latencyStats,
      profiles: Object.keys(this.profiles),
    };
  }

  /**
   * Reset latency history
   */
  resetLatencyHistory() {
    this.latencyHistory.clear();
  }
}

module.exports = {
  DynamicRouter,
  TASK_TYPE,
  PROVIDER_PROFILES,
};
