/**
 * LLMux - Routing Module Index
 * Exports routing strategies and utilities
 */

const { selectProviderWeighted, getWeightedStats } = require('./weighted');
const { executeWithFallback, executeStreamWithFallback, estimateTokens } = require('./priority');

module.exports = {
  // Weighted selection
  selectProviderWeighted,
  getWeightedStats,

  // Priority-based fallback
  executeWithFallback,
  executeStreamWithFallback,

  // Utilities
  estimateTokens,
};
