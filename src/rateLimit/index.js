/**
 * LLMux - Rate Limit Module Index
 * Exports all rate limiting functionality
 */

const {
  SlidingWindowCounter,
  createMiddleware,
  createSlidingWindowLimiter,
} = require('./slidingWindow');

// Re-export from middleware for backward compatibility
const {
  createApiLimiter,
  createAuthLimiter,
  createBurstLimiter,
  createTieredLimiter,
  createFromEnv,
  apiLimiter,
  keyGenerator,
  rateLimitHandler,
  skipHandler,
  DEFAULT_CONFIG,
} = require('../middleware/rateLimit');

module.exports = {
  // Sliding window implementation
  SlidingWindowCounter,
  createMiddleware,
  createSlidingWindowLimiter,

  // Express-rate-limit based implementation
  createApiLimiter,
  createAuthLimiter,
  createBurstLimiter,
  createTieredLimiter,
  createFromEnv,
  apiLimiter,

  // Utilities
  keyGenerator,
  rateLimitHandler,
  skipHandler,

  // Configuration
  DEFAULT_CONFIG,
};
