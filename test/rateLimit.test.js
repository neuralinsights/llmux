/**
 * Rate Limit Module Tests
 * Tests sliding window rate limiter implementation
 */

const { SlidingWindowCounter, createSlidingWindowLimiter } = require('../src/rateLimit');

describe('RateLimit: SlidingWindowCounter', () => {
  let counter;

  beforeEach(() => {
    counter = new SlidingWindowCounter({
      windowMs: 1000,
      limit: 5,
      precision: 100,
    });
  });

  afterEach(() => {
    counter.destroy();
  });

  describe('basic operations', () => {
    it('should allow requests within limit', () => {
      const result = counter.increment('test-key');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
      expect(result.limit).toBe(5);
    });

    it('should decrement remaining count', () => {
      counter.increment('test-key');
      counter.increment('test-key');
      const result = counter.increment('test-key');

      expect(result.remaining).toBe(2);
      expect(result.current).toBe(3);
    });

    it('should deny requests over limit', () => {
      for (let i = 0; i < 5; i++) {
        counter.increment('test-key');
      }

      const result = counter.increment('test-key');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should track separate keys independently', () => {
      counter.increment('key1');
      counter.increment('key1');
      counter.increment('key2');

      const check1 = counter.check('key1');
      const check2 = counter.check('key2');

      expect(check1.current).toBe(2);
      expect(check2.current).toBe(1);
    });
  });

  describe('sliding window behavior', () => {
    it('should reset after window expires', async () => {
      for (let i = 0; i < 5; i++) {
        counter.increment('test-key');
      }

      // Wait for window to expire
      await new Promise((r) => setTimeout(r, 1100));

      const result = counter.increment('test-key');
      expect(result.allowed).toBe(true);
      expect(result.current).toBe(1);
    });

    it('should include resetAt timestamp', () => {
      const before = Date.now();
      const result = counter.increment('test-key');

      expect(result.resetAt).toBeGreaterThan(before);
      expect(result.resetAt).toBeLessThanOrEqual(before + 1100);
    });
  });

  describe('custom key limits', () => {
    it('should allow setting per-key limits', () => {
      counter.setKeyLimit('premium-user', 100);
      const result = counter.check('premium-user');

      expect(result.limit).toBe(100);
    });

    it('should use default limit for unknown keys', () => {
      const result = counter.check('unknown-key');
      expect(result.limit).toBe(5);
    });

    it('should remove custom limits', () => {
      counter.setKeyLimit('user', 50);
      counter.removeKeyLimit('user');

      const result = counter.check('user');
      expect(result.limit).toBe(5);
    });
  });

  describe('weighted requests', () => {
    it('should support request weights', () => {
      counter.increment('test-key', 3);
      const result = counter.increment('test-key', 1);

      expect(result.current).toBe(4);
      expect(result.remaining).toBe(1);
    });

    it('should deny heavy requests that exceed limit', () => {
      counter.increment('test-key', 3);
      const result = counter.increment('test-key', 5);

      expect(result.allowed).toBe(false);
    });
  });

  describe('check() method', () => {
    it('should not increment counter', () => {
      counter.increment('test-key');
      const before = counter.check('test-key');
      const after = counter.check('test-key');

      expect(before.current).toBe(1);
      expect(after.current).toBe(1);
    });

    it('should return correct remaining', () => {
      counter.increment('test-key');
      counter.increment('test-key');

      const result = counter.check('test-key');
      expect(result.remaining).toBe(3);
    });
  });

  describe('reset() method', () => {
    it('should clear counter for key', () => {
      for (let i = 0; i < 5; i++) {
        counter.increment('test-key');
      }

      counter.reset('test-key');
      const result = counter.check('test-key');

      expect(result.current).toBe(0);
      expect(result.remaining).toBe(5);
    });
  });

  describe('getAll() method', () => {
    it('should return all keys with usage', () => {
      counter.increment('key1');
      counter.increment('key1');
      counter.increment('key2');

      const all = counter.getAll();

      expect(all).toHaveLength(2);
      expect(all.find((k) => k.key === 'key1').current).toBe(2);
      expect(all.find((k) => k.key === 'key2').current).toBe(1);
    });
  });

  describe('getStats() method', () => {
    it('should return statistics', () => {
      counter.increment('key1');
      counter.setKeyLimit('key2', 100);

      const stats = counter.getStats();

      expect(stats.keys).toBe(1);
      expect(stats.customLimits).toBe(1);
      expect(stats.windowMs).toBe(1000);
      expect(stats.defaultLimit).toBe(5);
    });
  });

  describe('cleanup()', () => {
    it('should remove stale entries', async () => {
      counter.increment('old-key');

      // Wait for entry to become stale
      await new Promise((r) => setTimeout(r, 2100));

      counter.cleanup();
      const stats = counter.getStats();

      expect(stats.keys).toBe(0);
    });
  });
});

describe('RateLimit: createSlidingWindowLimiter', () => {
  it('should return counter and middleware', () => {
    const { counter, middleware } = createSlidingWindowLimiter({
      windowMs: 1000,
      limit: 10,
    });

    expect(counter).toBeInstanceOf(SlidingWindowCounter);
    expect(typeof middleware).toBe('function');

    counter.destroy();
  });
});
