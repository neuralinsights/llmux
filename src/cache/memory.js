/**
 * LLMux - Memory Cache Implementation
 * In-memory LRU cache with TTL support
 */

const { CacheAdapter } = require('./adapter');

/**
 * In-memory cache implementation with LRU eviction
 */
class MemoryCache extends CacheAdapter {
  constructor(options = {}) {
    super(options);
    this.cache = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {Promise<*|null>} Cached value or null
   */
  async get(key) {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    return entry.data;
  }

  /**
   * Set value in cache with LRU eviction
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} [ttl] - TTL in milliseconds (optional)
   */
  async set(key, value, ttl = this.ttl) {
    // LRU eviction: Remove oldest entry when capacity exceeded
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    // For LRU: delete and re-add to move to end
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    this.cache.set(key, {
      data: value,
      expiresAt: Date.now() + ttl,
      createdAt: Date.now(),
    });
  }

  /**
   * Delete value from cache
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} True if deleted
   */
  async delete(key) {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   * @returns {Promise<number>} Number of entries cleared
   */
  async clear() {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`[CACHE] Cleared ${size} cache entries`);
    return size;
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>}
   */
  async getStats() {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0
        ? ((this.hits / total) * 100).toFixed(2) + '%'
        : 'N/A',
    };
  }

  /**
   * Get cache size
   * @returns {Promise<number>}
   */
  async size() {
    return this.cache.size;
  }

  /**
   * Clean up expired entries (optional maintenance)
   * @returns {Promise<number>} Number of entries removed
   */
  async cleanup() {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`[CACHE] Cleanup removed ${removed} expired entries`);
    }

    return removed;
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.hits = 0;
    this.misses = 0;
  }
}

module.exports = { MemoryCache };
