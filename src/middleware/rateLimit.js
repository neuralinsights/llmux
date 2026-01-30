/**
 * LLMux - Rate Limiting Middleware
 * Configurable rate limiting with multiple strategies
 */

const rateLimit = require('express-rate-limit');

/**
 * Default rate limit configuration
 */
const DEFAULT_CONFIG = {
  windowMs: 60000,           // 1 minute window
  limit: 100,                 // 100 requests per window
  standardHeaders: 'draft-7', // Return rate limit info in headers
  legacyHeaders: false,       // Disable X-RateLimit-* headers
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
};

/**
 * Key generator for rate limiting
 * Uses API key if present, otherwise falls back to default IP-based key
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @returns {string} Rate limit key
 */
function keyGenerator(req, res) {
  // Check for API key first (provides per-key rate limiting)
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  if (apiKey) {
    return `key:${apiKey.slice(0, 20)}`; // Use first 20 chars of API key
  }

  // Fall back to default IP-based key generator (handles IPv6 correctly)
  // Return undefined to use express-rate-limit's default behavior
  return undefined;
}

/**
 * Create error response for rate limit exceeded
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
function rateLimitHandler(req, res) {
  const isOpenAI = req.path.startsWith('/v1/');

  if (isOpenAI) {
    return res.status(429).json({
      error: {
        message: 'Rate limit exceeded. Please slow down your requests.',
        type: 'rate_limit_error',
        code: 'rate_limit_exceeded',
      },
    });
  }

  return res.status(429).json({
    error: 'Rate limit exceeded. Please slow down your requests.',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: res.getHeader('Retry-After'),
  });
}

/**
 * Skip function for rate limiting
 * Allows certain paths to bypass rate limiting
 * @param {Object} req - Express request
 * @returns {boolean} Whether to skip rate limiting
 */
function skipHandler(req) {
  // Skip rate limiting for health checks and metrics
  const skipPaths = ['/health', '/metrics'];
  return skipPaths.some(path => req.path === path);
}

/**
 * Create standard API rate limiter
 * @param {Object} config - Rate limit configuration
 * @returns {Function} Express middleware
 */
function createApiLimiter(config = {}) {
  return rateLimit({
    ...DEFAULT_CONFIG,
    ...config,
    keyGenerator,
    handler: rateLimitHandler,
    skip: skipHandler,
    message: 'Rate limit exceeded',
    validate: { xForwardedForHeader: false }, // Disable IPv6 validation warning
  });
}

/**
 * Create strict rate limiter for authentication endpoints
 * @param {Object} config - Rate limit configuration
 * @returns {Function} Express middleware
 */
function createAuthLimiter(config = {}) {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 10,                  // 10 attempts per window
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator,
    validate: { xForwardedForHeader: false },
    handler: (req, res) => {
      res.status(429).json({
        error: 'Too many authentication attempts. Please try again later.',
        code: 'AUTH_RATE_LIMIT_EXCEEDED',
        retryAfter: res.getHeader('Retry-After'),
      });
    },
    ...config,
  });
}

/**
 * Create burst rate limiter for high-traffic endpoints
 * Uses sliding window algorithm
 * @param {Object} config - Rate limit configuration
 * @returns {Function} Express middleware
 */
function createBurstLimiter(config = {}) {
  return rateLimit({
    windowMs: 1000,    // 1 second window
    limit: 10,          // 10 requests per second
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator,
    validate: { xForwardedForHeader: false },
    handler: rateLimitHandler,
    skip: skipHandler,
    ...config,
  });
}

/**
 * Create tiered rate limiter based on API key tier
 * @param {Object} tiers - Tier configuration { default, basic, pro, enterprise }
 * @returns {Function} Express middleware
 */
function createTieredLimiter(tiers = {}) {
  const tierLimits = {
    default: { windowMs: 60000, limit: 60 },
    basic: { windowMs: 60000, limit: 100 },
    pro: { windowMs: 60000, limit: 500 },
    enterprise: { windowMs: 60000, limit: 2000 },
    ...tiers,
  };

  // Create limiters for each tier
  const limiters = {};
  for (const [tier, config] of Object.entries(tierLimits)) {
    limiters[tier] = rateLimit({
      ...DEFAULT_CONFIG,
      ...config,
      keyGenerator,
      validate: { xForwardedForHeader: false },
      handler: rateLimitHandler,
      skip: skipHandler,
    });
  }

  return (req, res, next) => {
    // Determine tier from request (could be from API key metadata)
    const tier = req.apiKeyTier || 'default';
    const limiter = limiters[tier] || limiters.default;
    return limiter(req, res, next);
  };
}

/**
 * Rate limit configuration from environment
 */
function createFromEnv() {
  const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
  const limit = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10);

  return createApiLimiter({ windowMs, limit });
}

/**
 * Default API rate limiter instance
 */
const apiLimiter = createFromEnv();

module.exports = {
  // Factory functions
  createApiLimiter,
  createAuthLimiter,
  createBurstLimiter,
  createTieredLimiter,
  createFromEnv,

  // Default instances
  apiLimiter,

  // Utilities
  keyGenerator,
  rateLimitHandler,
  skipHandler,

  // Configuration
  DEFAULT_CONFIG,
};
