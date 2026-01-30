/**
 * LLMux - Redis Cache Implementation
 * Redis-backed cache with TTL support for persistent caching across restarts
 */

const Redis = require('ioredis');
const { CacheAdapter } = require('./adapter');

/**
 * Redis cache implementation
 */
class RedisCache extends CacheAdapter {
  /**
   * @param {Object} options - Cache options
   * @param {string} [options.url='redis://localhost:6379'] - Redis connection URL
   * @param {number} [options.ttl=3600000] - Default TTL in milliseconds
   * @param {number} [options.maxSize=10000] - Maximum cache entries (soft limit, Redis manages memory)
   * @param {string} [options.keyPrefix='llmux:cache:'] - Key prefix for namespacing
   * @param {Object} [options.redis] - Additional ioredis options
   */
  constructor(options = {}) {
    super(options);

    this.url = options.url || process.env.REDIS_URL || 'redis://localhost:6379';
    this.keyPrefix = options.keyPrefix || 'llmux:cache:';
    this.connected = false;

    // Statistics (local counters, synced periodically)
    this.localHits = 0;
    this.localMisses = 0;

    // Create Redis client
    this.client = new Redis(this.url, {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      lazyConnect: true,
      ...options.redis,
    });

    // Event handlers
    this.client.on('connect', () => {
      this.connected = true;
      console.log('[CACHE:REDIS] Connected to Redis');
    });

    this.client.on('error', (err) => {
      console.error('[CACHE:REDIS] Redis error:', err.message);
    });

    this.client.on('close', () => {
      this.connected = false;
      console.log('[CACHE:REDIS] Redis connection closed');
    });
  }

  /**
   * Connect to Redis
   * @returns {Promise<void>}
   */
  async connect() {
    if (!this.connected) {
      await this.client.connect();
    }
  }

  /**
   * Build full key with prefix
   * @param {string} key - Raw key
   * @returns {string} Prefixed key
   */
  _buildKey(key) {
    return `${this.keyPrefix}${key}`;
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {Promise<*|null>} Cached value or null
   */
  async get(key) {
    try {
      const data = await this.client.get(this._buildKey(key));

      if (!data) {
        this.localMisses++;
        return null;
      }

      this.localHits++;
      return JSON.parse(data);
    } catch (error) {
      console.error('[CACHE:REDIS] Get error:', error.message);
      this.localMisses++;
      return null;
    }
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} [ttl] - TTL in milliseconds (optional)
   */
  async set(key, value, ttl = this.ttl) {
    try {
      const serialized = JSON.stringify(value);
      const ttlSeconds = Math.ceil(ttl / 1000);

      await this.client.setex(this._buildKey(key), ttlSeconds, serialized);
    } catch (error) {
      console.error('[CACHE:REDIS] Set error:', error.message);
    }
  }

  /**
   * Delete value from cache
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} True if deleted
   */
  async delete(key) {
    try {
      const result = await this.client.del(this._buildKey(key));
      return result > 0;
    } catch (error) {
      console.error('[CACHE:REDIS] Delete error:', error.message);
      return false;
    }
  }

  /**
   * Clear all cache entries with this prefix
   * @returns {Promise<number>} Number of entries cleared
   */
  async clear() {
    try {
      let cursor = '0';
      let deleted = 0;
      const pattern = `${this.keyPrefix}*`;

      do {
        const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;

        if (keys.length > 0) {
          await this.client.del(...keys);
          deleted += keys.length;
        }
      } while (cursor !== '0');

      console.log(`[CACHE:REDIS] Cleared ${deleted} cache entries`);
      return deleted;
    } catch (error) {
      console.error('[CACHE:REDIS] Clear error:', error.message);
      return 0;
    }
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>}
   */
  async getStats() {
    try {
      const size = await this.size();
      const total = this.localHits + this.localMisses;

      // Get Redis info for additional stats
      const info = await this.client.info('stats');
      const memoryInfo = await this.client.info('memory');

      // Parse memory used
      const memMatch = memoryInfo.match(/used_memory_human:(\S+)/);
      const usedMemory = memMatch ? memMatch[1] : 'unknown';

      return {
        backend: 'redis',
        connected: this.connected,
        size,
        maxSize: this.maxSize,
        ttl: this.ttl,
        hits: this.localHits,
        misses: this.localMisses,
        hitRate: total > 0 ? ((this.localHits / total) * 100).toFixed(2) + '%' : 'N/A',
        redisUrl: this.url.replace(/\/\/[^:]+:[^@]+@/, '//*****:*****@'), // Mask password
        usedMemory,
      };
    } catch (error) {
      console.error('[CACHE:REDIS] Stats error:', error.message);
      return {
        backend: 'redis',
        connected: this.connected,
        error: error.message,
        hits: this.localHits,
        misses: this.localMisses,
      };
    }
  }

  /**
   * Get cache size (number of keys with prefix)
   * @returns {Promise<number>}
   */
  async size() {
    try {
      let cursor = '0';
      let count = 0;
      const pattern = `${this.keyPrefix}*`;

      do {
        const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        count += keys.length;
      } while (cursor !== '0');

      return count;
    } catch (error) {
      console.error('[CACHE:REDIS] Size error:', error.message);
      return 0;
    }
  }

  /**
   * Check if key exists
   * @param {string} key - Cache key
   * @returns {Promise<boolean>}
   */
  async has(key) {
    try {
      const exists = await this.client.exists(this._buildKey(key));
      return exists === 1;
    } catch (error) {
      console.error('[CACHE:REDIS] Has error:', error.message);
      return false;
    }
  }

  /**
   * Get TTL for a key (in seconds)
   * @param {string} key - Cache key
   * @returns {Promise<number>} TTL in seconds, -1 if no TTL, -2 if key doesn't exist
   */
  async getTTL(key) {
    try {
      return await this.client.ttl(this._buildKey(key));
    } catch (error) {
      console.error('[CACHE:REDIS] TTL error:', error.message);
      return -2;
    }
  }

  /**
   * Set multiple values at once
   * @param {Array<{key: string, value: *, ttl?: number}>} entries - Entries to set
   * @returns {Promise<void>}
   */
  async setMany(entries) {
    try {
      const pipeline = this.client.pipeline();

      for (const { key, value, ttl = this.ttl } of entries) {
        const serialized = JSON.stringify(value);
        const ttlSeconds = Math.ceil(ttl / 1000);
        pipeline.setex(this._buildKey(key), ttlSeconds, serialized);
      }

      await pipeline.exec();
    } catch (error) {
      console.error('[CACHE:REDIS] SetMany error:', error.message);
    }
  }

  /**
   * Get multiple values at once
   * @param {string[]} keys - Cache keys
   * @returns {Promise<Array<*|null>>} Array of values (null for missing keys)
   */
  async getMany(keys) {
    try {
      const fullKeys = keys.map((k) => this._buildKey(k));
      const results = await this.client.mget(...fullKeys);

      return results.map((data) => {
        if (data) {
          this.localHits++;
          return JSON.parse(data);
        }
        this.localMisses++;
        return null;
      });
    } catch (error) {
      console.error('[CACHE:REDIS] GetMany error:', error.message);
      return keys.map(() => null);
    }
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.localHits = 0;
    this.localMisses = 0;
  }

  /**
   * Close Redis connection
   * @returns {Promise<void>}
   */
  async close() {
    if (this.client) {
      await this.client.quit();
      this.connected = false;
      console.log('[CACHE:REDIS] Connection closed');
    }
  }

  /**
   * Check if Redis is healthy
   * @returns {Promise<boolean>}
   */
  async isHealthy() {
    try {
      const pong = await this.client.ping();
      return pong === 'PONG';
    } catch (error) {
      return false;
    }
  }
}

module.exports = { RedisCache };
