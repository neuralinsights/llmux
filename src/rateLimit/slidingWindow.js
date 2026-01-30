/**
 * LLMux - Sliding Window Rate Limiter
 * Provides accurate per-key rate limiting with sliding window algorithm
 *
 * @module rateLimit/slidingWindow
 */

/**
 * Sliding window counter for accurate rate limiting
 */
class SlidingWindowCounter {
  /**
   * @param {Object} options - Configuration options
   * @param {number} [options.windowMs=60000] - Window size in milliseconds
   * @param {number} [options.limit=100] - Default request limit per window
   * @param {number} [options.precision=1000] - Time precision in ms (sub-windows)
   */
  constructor(options = {}) {
    this.windowMs = options.windowMs || 60000;
    this.limit = options.limit || 100;
    this.precision = options.precision || 1000;

    // Number of sub-windows for sliding window
    this.numBuckets = Math.ceil(this.windowMs / this.precision);

    // Store: key -> { buckets: Map<bucketId, count>, total: number, lastUpdated: number }
    this.store = new Map();

    // Custom limits per key
    this.keyLimits = new Map();

    // Cleanup interval (every minute)
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Set custom limit for a specific key
   * @param {string} key - Rate limit key
   * @param {number} limit - Custom limit
   */
  setKeyLimit(key, limit) {
    this.keyLimits.set(key, limit);
  }

  /**
   * Get limit for a key
   * @param {string} key - Rate limit key
   * @returns {number} Rate limit
   */
  getKeyLimit(key) {
    return this.keyLimits.get(key) || this.limit;
  }

  /**
   * Remove custom limit for a key
   * @param {string} key - Rate limit key
   */
  removeKeyLimit(key) {
    this.keyLimits.delete(key);
  }

  /**
   * Get current bucket ID based on timestamp
   * @param {number} [now] - Current timestamp
   * @returns {number} Bucket ID
   */
  _getBucketId(now = Date.now()) {
    return Math.floor(now / this.precision);
  }

  /**
   * Get or create entry for a key
   * @param {string} key - Rate limit key
   * @returns {Object} Entry object
   */
  _getEntry(key) {
    if (!this.store.has(key)) {
      this.store.set(key, {
        buckets: new Map(),
        total: 0,
        lastUpdated: Date.now(),
      });
    }
    return this.store.get(key);
  }

  /**
   * Clean up old buckets for an entry
   * @param {Object} entry - Entry object
   * @param {number} now - Current timestamp
   */
  _cleanupEntry(entry, now) {
    const minBucketId = this._getBucketId(now) - this.numBuckets;

    for (const [bucketId, count] of entry.buckets) {
      if (bucketId < minBucketId) {
        entry.total -= count;
        entry.buckets.delete(bucketId);
      }
    }

    entry.lastUpdated = now;
  }

  /**
   * Increment counter and check if limit exceeded
   * @param {string} key - Rate limit key
   * @param {number} [weight=1] - Request weight (for weighted rate limiting)
   * @returns {{allowed: boolean, remaining: number, resetAt: number, limit: number}}
   */
  increment(key, weight = 1) {
    const now = Date.now();
    const entry = this._getEntry(key);
    const bucketId = this._getBucketId(now);
    const limit = this.getKeyLimit(key);

    // Cleanup old buckets
    this._cleanupEntry(entry, now);

    // Check if adding this request would exceed limit
    if (entry.total + weight > limit) {
      return {
        allowed: false,
        remaining: Math.max(0, limit - entry.total),
        resetAt: now + this.windowMs,
        limit,
        current: entry.total,
      };
    }

    // Increment counter
    const currentCount = entry.buckets.get(bucketId) || 0;
    entry.buckets.set(bucketId, currentCount + weight);
    entry.total += weight;

    return {
      allowed: true,
      remaining: Math.max(0, limit - entry.total),
      resetAt: now + this.windowMs,
      limit,
      current: entry.total,
    };
  }

  /**
   * Check current usage without incrementing
   * @param {string} key - Rate limit key
   * @returns {{remaining: number, resetAt: number, limit: number, current: number}}
   */
  check(key) {
    const now = Date.now();
    const entry = this._getEntry(key);
    const limit = this.getKeyLimit(key);

    // Cleanup old buckets
    this._cleanupEntry(entry, now);

    return {
      remaining: Math.max(0, limit - entry.total),
      resetAt: now + this.windowMs,
      limit,
      current: entry.total,
    };
  }

  /**
   * Reset counter for a key
   * @param {string} key - Rate limit key
   */
  reset(key) {
    this.store.delete(key);
  }

  /**
   * Get all keys with their current usage
   * @returns {Array<{key: string, current: number, limit: number, remaining: number}>}
   */
  getAll() {
    const now = Date.now();
    const result = [];

    for (const [key, entry] of this.store) {
      this._cleanupEntry(entry, now);
      const limit = this.getKeyLimit(key);
      result.push({
        key,
        current: entry.total,
        limit,
        remaining: Math.max(0, limit - entry.total),
      });
    }

    return result;
  }

  /**
   * Cleanup stale entries
   */
  cleanup() {
    const now = Date.now();
    const staleThreshold = now - this.windowMs * 2;

    for (const [key, entry] of this.store) {
      if (entry.lastUpdated < staleThreshold) {
        this.store.delete(key);
      } else {
        this._cleanupEntry(entry, now);
      }
    }
  }

  /**
   * Get statistics
   * @returns {{keys: number, customLimits: number, windowMs: number, defaultLimit: number}}
   */
  getStats() {
    return {
      keys: this.store.size,
      customLimits: this.keyLimits.size,
      windowMs: this.windowMs,
      defaultLimit: this.limit,
    };
  }

  /**
   * Destroy the rate limiter
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
    this.keyLimits.clear();
  }
}

/**
 * Create Express middleware from sliding window counter
 * @param {SlidingWindowCounter} counter - Sliding window counter instance
 * @param {Object} options - Middleware options
 * @param {Function} [options.keyGenerator] - Function to generate key from request
 * @param {Function} [options.onLimitReached] - Callback when limit reached
 * @param {Function} [options.skip] - Function to skip rate limiting
 * @returns {Function} Express middleware
 */
function createMiddleware(counter, options = {}) {
  const {
    keyGenerator = (req) => {
      const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
      return apiKey ? `key:${apiKey.slice(0, 20)}` : `ip:${req.ip}`;
    },
    onLimitReached,
    skip = () => false,
  } = options;

  return (req, res, next) => {
    // Check if should skip
    if (skip(req)) {
      return next();
    }

    const key = keyGenerator(req, res);
    const result = counter.increment(key);

    // Set rate limit headers (draft-7 standard)
    res.setHeader('RateLimit-Limit', result.limit);
    res.setHeader('RateLimit-Remaining', result.remaining);
    res.setHeader('RateLimit-Reset', Math.ceil(result.resetAt / 1000));
    res.setHeader('RateLimit-Policy', `${result.limit};w=${counter.windowMs / 1000}`);

    if (!result.allowed) {
      // Set Retry-After header
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
      res.setHeader('Retry-After', retryAfter);

      if (onLimitReached) {
        onLimitReached(req, res, key, result);
      }

      return res.status(429).json({
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        limit: result.limit,
        current: result.current,
        retryAfter,
      });
    }

    // Store result for access in handler
    req.rateLimit = result;
    next();
  };
}

/**
 * Create sliding window rate limiter with middleware
 * @param {Object} options - Options
 * @returns {{counter: SlidingWindowCounter, middleware: Function}}
 */
function createSlidingWindowLimiter(options = {}) {
  const counter = new SlidingWindowCounter(options);
  const middleware = createMiddleware(counter, options);

  return { counter, middleware };
}

module.exports = {
  SlidingWindowCounter,
  createMiddleware,
  createSlidingWindowLimiter,
};
