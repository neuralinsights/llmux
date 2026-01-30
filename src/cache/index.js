/**
 * LLMux - Cache Module Index
 * Factory function for creating cache instances
 */

const { CacheAdapter } = require('./adapter');
const { MemoryCache } = require('./memory');
const { RedisCache } = require('./redis');

/**
 * Create a cache instance based on configuration
 * @param {Object} options - Cache options
 * @param {string} [options.backend='memory'] - Cache backend (memory | redis)
 * @param {number} [options.ttl] - TTL in milliseconds
 * @param {number} [options.maxSize] - Maximum cache entries
 * @param {string} [options.url] - Redis connection URL (for redis backend)
 * @param {string} [options.keyPrefix] - Key prefix for Redis namespacing
 * @returns {Promise<CacheAdapter>} Cache instance
 */
async function createCache(options = {}) {
  const { backend = 'memory', ttl, maxSize, url, keyPrefix } = options;

  switch (backend.toLowerCase()) {
    case 'memory':
      return new MemoryCache({ ttl, maxSize });

    case 'redis': {
      const cache = new RedisCache({ ttl, maxSize, url, keyPrefix });
      try {
        await cache.connect();
        console.log('[CACHE] Redis cache initialized');
        return cache;
      } catch (error) {
        console.warn(`[CACHE] Redis connection failed: ${error.message}, falling back to memory cache`);
        return new MemoryCache({ ttl, maxSize });
      }
    }

    default:
      throw new Error(`Unknown cache backend: ${backend}`);
  }
}

module.exports = {
  CacheAdapter,
  MemoryCache,
  RedisCache,
  createCache,
};
