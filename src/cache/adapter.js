/**
 * LLMux - Cache Adapter Interface
 * Defines the interface for cache implementations (Memory, Redis, etc.)
 */

const crypto = require('crypto');

/**
 * Abstract base class for cache adapters
 * @abstract
 */
class CacheAdapter {
  /**
   * @param {Object} options - Cache options
   * @param {number} options.ttl - Default TTL in milliseconds
   * @param {number} options.maxSize - Maximum cache entries
   */
  constructor(options = {}) {
    this.ttl = options.ttl || 3600000; // 1 hour default
    this.maxSize = options.maxSize || 1000;
  }

  /**
   * Generate cache key from prompt, model, and provider
   * @param {string} prompt - The prompt text
   * @param {string} model - Model name
   * @param {string} provider - Provider name (use 'any' for cross-provider caching)
   * @returns {string} SHA256 hash key
   */
  generateKey(prompt, model, provider) {
    return crypto
      .createHash('sha256')
      .update(`${provider}:${model}:${prompt}`)
      .digest('hex');
  }

  /**
   * Get value from cache
   * @abstract
   * @param {string} key - Cache key
   * @returns {Promise<*|null>} Cached value or null
   */
  async get(key) {
    throw new Error('Method not implemented');
  }

  /**
   * Set value in cache
   * @abstract
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} [ttl] - TTL in milliseconds (optional, uses default)
   * @returns {Promise<void>}
   */
  async set(key, value, ttl) {
    throw new Error('Method not implemented');
  }

  /**
   * Delete value from cache
   * @abstract
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} True if deleted
   */
  async delete(key) {
    throw new Error('Method not implemented');
  }

  /**
   * Clear all cache entries
   * @abstract
   * @returns {Promise<number>} Number of entries cleared
   */
  async clear() {
    throw new Error('Method not implemented');
  }

  /**
   * Get cache statistics
   * @abstract
   * @returns {Promise<{size: number, maxSize: number, ttl: number, hits: number, misses: number, hitRate: string}>}
   */
  async getStats() {
    throw new Error('Method not implemented');
  }

  /**
   * Check if cache has key
   * @param {string} key - Cache key
   * @returns {Promise<boolean>}
   */
  async has(key) {
    const value = await this.get(key);
    return value !== null;
  }

  /**
   * Get cache size
   * @abstract
   * @returns {Promise<number>}
   */
  async size() {
    throw new Error('Method not implemented');
  }

  /**
   * Close the cache connection (for Redis, etc.)
   * @returns {Promise<void>}
   */
  async close() {
    // Default: no-op
  }
}

module.exports = { CacheAdapter };
