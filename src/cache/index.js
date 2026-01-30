/**
 * LLMux - Cache Module Index
 * Factory function for creating cache instances
 */

const { CacheAdapter } = require('./adapter');
const { MemoryCache } = require('./memory');

/**
 * Create a cache instance based on configuration
 * @param {Object} options - Cache options
 * @param {string} [options.backend='memory'] - Cache backend (memory | redis)
 * @param {number} [options.ttl] - TTL in milliseconds
 * @param {number} [options.maxSize] - Maximum cache entries
 * @param {string} [options.redisUrl] - Redis connection URL (for redis backend)
 * @returns {Promise<CacheAdapter>} Cache instance
 */
async function createCache(options = {}) {
  const { backend = 'memory', ttl, maxSize, redisUrl } = options;

  switch (backend.toLowerCase()) {
    case 'memory':
      return new MemoryCache({ ttl, maxSize });

    case 'redis':
      // Redis implementation will be added in Phase 2
      // For now, fall back to memory cache with warning
      console.warn('[CACHE] Redis backend not yet implemented, using memory cache');
      return new MemoryCache({ ttl, maxSize });

    default:
      throw new Error(`Unknown cache backend: ${backend}`);
  }
}

module.exports = {
  CacheAdapter,
  MemoryCache,
  createCache,
};
