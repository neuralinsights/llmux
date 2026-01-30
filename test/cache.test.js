/**
 * Cache Module Unit Tests
 */

const { MemoryCache, CacheAdapter, createCache } = require('../src/cache');

describe('Cache: MemoryCache', () => {
  let cache;

  beforeEach(() => {
    cache = new MemoryCache({ ttl: 1000, maxSize: 10 });
  });

  afterEach(() => {
    cache.clear();
  });

  describe('basic operations', () => {
    it('should store and retrieve values', async () => {
      await cache.set('key1', 'value1');
      const result = await cache.get('key1');
      expect(result).toBe('value1');
    });

    it('should return null for missing keys', async () => {
      const result = await cache.get('nonexistent');
      expect(result).toBeNull();
    });

    it('should check key existence', async () => {
      await cache.set('key1', 'value1');
      expect(await cache.has('key1')).toBe(true);
      expect(await cache.has('nonexistent')).toBe(false);
    });

    it('should delete keys', async () => {
      await cache.set('key1', 'value1');
      await cache.delete('key1');
      expect(await cache.get('key1')).toBeNull();
    });

    it('should clear all entries', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      cache.clear();
      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toBeNull();
    });
  });

  describe('TTL expiration', () => {
    it('should return value within TTL', async () => {
      const shortCache = new MemoryCache({ ttl: 500 });
      await shortCache.set('key', 'value');
      const result = await shortCache.get('key');
      expect(result).toBe('value');
    });

    it('should return null after TTL expires', async () => {
      const shortCache = new MemoryCache({ ttl: 50 });
      await shortCache.set('key', 'value');
      await new Promise(r => setTimeout(r, 100));
      const result = await shortCache.get('key');
      expect(result).toBeNull();
    });
  });

  describe('LRU eviction', () => {
    it('should evict oldest entries when maxSize reached', async () => {
      const smallCache = new MemoryCache({ ttl: 10000, maxSize: 3 });
      await smallCache.set('a', '1');
      await smallCache.set('b', '2');
      await smallCache.set('c', '3');
      await smallCache.set('d', '4'); // Should evict 'a'

      expect(await smallCache.get('a')).toBeNull();
      expect(await smallCache.get('b')).toBe('2');
      expect(await smallCache.get('c')).toBe('3');
      expect(await smallCache.get('d')).toBe('4');
    });

    it('should evict oldest by insertion order', async () => {
      // Note: Current implementation uses Map insertion order for LRU,
      // get() does not update access order (only set() re-inserts)
      const smallCache = new MemoryCache({ ttl: 10000, maxSize: 3 });
      await smallCache.set('a', '1');
      await smallCache.set('b', '2');
      await smallCache.set('c', '3');
      await smallCache.set('d', '4'); // Should evict 'a' (oldest insertion)

      expect(await smallCache.get('a')).toBeNull();
      expect(await smallCache.get('b')).toBe('2');
      expect(await smallCache.get('c')).toBe('3');
      expect(await smallCache.get('d')).toBe('4');
    });
  });

  describe('statistics', () => {
    it('should track hits and misses', async () => {
      const statsCache = new MemoryCache({ ttl: 1000 });
      await statsCache.set('key', 'value');

      await statsCache.get('key');       // hit
      await statsCache.get('key');       // hit
      await statsCache.get('missing');   // miss

      const stats = await statsCache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
    });

    it('should report size correctly', async () => {
      await cache.set('a', '1');
      await cache.set('b', '2');
      const stats = await cache.getStats();
      expect(stats.size).toBe(2);
    });

    it('should calculate hit rate', async () => {
      const statsCache = new MemoryCache({ ttl: 1000 });
      await statsCache.set('key', 'value');

      await statsCache.get('key');       // hit
      await statsCache.get('missing');   // miss

      const stats = await statsCache.getStats();
      expect(stats.hitRate).toBe('50.00%');
    });
  });

  describe('complex values', () => {
    it('should handle object values', async () => {
      const obj = { nested: { data: [1, 2, 3] } };
      await cache.set('obj', obj);
      const result = await cache.get('obj');
      expect(result).toEqual(obj);
    });

    it('should handle array values', async () => {
      const arr = [1, 'two', { three: 3 }];
      await cache.set('arr', arr);
      const result = await cache.get('arr');
      expect(result).toEqual(arr);
    });
  });
});

describe('Cache: CacheAdapter', () => {
  it('should be instantiable as base class', () => {
    // CacheAdapter is a base class, not abstract in JavaScript
    const adapter = new CacheAdapter();
    expect(adapter).toBeInstanceOf(CacheAdapter);
  });

  it('should have default TTL and maxSize', () => {
    const adapter = new CacheAdapter();
    expect(adapter.ttl).toBeDefined();
    expect(adapter.maxSize).toBeDefined();
  });
});

describe('Cache: createCache', () => {
  it('should create memory cache by default', async () => {
    const cache = await createCache();
    expect(cache).toBeInstanceOf(MemoryCache);
  });

  it('should create memory cache with options', async () => {
    const cache = await createCache({ ttl: 5000, maxSize: 500 });
    expect(cache).toBeInstanceOf(MemoryCache);
  });

  it('should fall back to memory for unknown backend', async () => {
    const cache = await createCache({ backend: 'redis' });
    expect(cache).toBeInstanceOf(MemoryCache);
  });

  it('should throw for invalid backend', async () => {
    await expect(createCache({ backend: 'invalid_xyz' }))
      .rejects.toThrow('Unknown cache backend');
  });
});
