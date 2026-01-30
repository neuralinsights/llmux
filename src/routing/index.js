/**
 * LLMux - Routing Module Index
 * Exports routing strategies and utilities
 */

const { selectProviderWeighted, getWeightedStats } = require('./weighted');
const { executeWithFallback, executeStreamWithFallback, estimateTokens } = require('./priority');
const { DynamicRouter, TASK_TYPE, PROVIDER_PROFILES } = require('./dynamic');

module.exports = {
  // Weighted selection
  selectProviderWeighted,
  getWeightedStats,

  // Priority-based fallback
  executeWithFallback,
  executeStreamWithFallback,

  // Dynamic routing
  DynamicRouter,
  TASK_TYPE,
  PROVIDER_PROFILES,

  // Utilities
  estimateTokens,
};
