/**
 * Quota Manager Tests
 */

const { QuotaManager, PERIOD } = require('../src/quota');

describe('Quota: QuotaManager', () => {
  let manager;

  beforeEach(() => {
    manager = new QuotaManager({
      defaultTokenLimit: 10000,
      defaultCostLimit: 10,
      period: PERIOD.MONTHLY,
      warningThreshold: 0.8,
    });
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('basic operations', () => {
    it('should allow usage within limits', () => {
      const result = manager.recordUsage('test-key', {
        promptTokens: 100,
        completionTokens: 50,
        model: 'gpt-4',
      });

      expect(result.allowed).toBe(true);
      expect(result.usage.tokensUsed).toBe(150);
    });

    it('should track cumulative usage', () => {
      manager.recordUsage('test-key', {
        promptTokens: 100,
        completionTokens: 50,
        model: 'gpt-4',
      });

      manager.recordUsage('test-key', {
        promptTokens: 200,
        completionTokens: 100,
        model: 'gpt-4',
      });

      const status = manager.check('test-key');
      expect(status.tokensUsed).toBe(450);
    });

    it('should deny usage exceeding token limit', () => {
      manager.recordUsage('test-key', {
        promptTokens: 9000,
        completionTokens: 500,
        model: 'gpt-4',
      });

      const result = manager.recordUsage('test-key', {
        promptTokens: 1000,
        completionTokens: 0,
        model: 'gpt-4',
      });

      expect(result.allowed).toBe(false);
      expect(result.exceededType).toBe('tokens');
    });

    it('should track request count', () => {
      manager.recordUsage('test-key', { promptTokens: 10, completionTokens: 5, model: 'gpt-4' });
      manager.recordUsage('test-key', { promptTokens: 10, completionTokens: 5, model: 'gpt-4' });
      manager.recordUsage('test-key', { promptTokens: 10, completionTokens: 5, model: 'gpt-4' });

      const status = manager.check('test-key');
      expect(status.requestCount).toBe(3);
    });
  });

  describe('custom limits', () => {
    it('should apply custom token limits', () => {
      manager.setKeyLimits('premium-key', { tokenLimit: 50000 });

      const status = manager.check('premium-key');
      expect(status.tokenLimit).toBe(50000);
    });

    it('should apply custom cost limits', () => {
      manager.setKeyLimits('premium-key', { costLimit: 500 });

      const status = manager.check('premium-key');
      expect(status.costLimit).toBe(500);
    });

    it('should get limits for a key', () => {
      manager.setKeyLimits('custom-key', { tokenLimit: 25000, costLimit: 50 });

      const limits = manager.getKeyLimits('custom-key');
      expect(limits.tokenLimit).toBe(25000);
      expect(limits.costLimit).toBe(50);
    });
  });

  describe('check() method', () => {
    it('should return quota status', () => {
      manager.recordUsage('test-key', {
        promptTokens: 1000,
        completionTokens: 500,
        model: 'gpt-4',
      });

      const status = manager.check('test-key');

      expect(status.tokensUsed).toBe(1500);
      expect(status.tokenLimit).toBe(10000);
      expect(status.remaining.tokens).toBe(8500);
      expect(status.period).toBe(PERIOD.MONTHLY);
      expect(status.periodStart).toBeDefined();
      expect(status.nextReset).toBeDefined();
    });
  });

  describe('reset() method', () => {
    it('should reset quota for a key', () => {
      manager.recordUsage('test-key', {
        promptTokens: 5000,
        completionTokens: 2000,
        model: 'gpt-4',
      });

      manager.reset('test-key');
      const status = manager.check('test-key');

      expect(status.tokensUsed).toBe(0);
      expect(status.costUsed).toBe(0);
      expect(status.requestCount).toBe(0);
    });

    it('should preserve custom limits after reset', () => {
      manager.setKeyLimits('test-key', { tokenLimit: 50000 });
      manager.recordUsage('test-key', {
        promptTokens: 1000,
        completionTokens: 0,
        model: 'gpt-4',
      });

      manager.reset('test-key');
      const status = manager.check('test-key');

      expect(status.tokenLimit).toBe(50000);
    });
  });

  describe('events', () => {
    it('should emit warning event at threshold', (done) => {
      manager.on('warning', (data) => {
        expect(data.apiKey).toBe('test-key');
        expect(data.tokenUsage).toBeGreaterThanOrEqual(0.8);
        done();
      });

      // Use 80% of tokens
      manager.recordUsage('test-key', {
        promptTokens: 8000,
        completionTokens: 0,
        model: 'gpt-4',
      });
    });

    it('should emit exceeded event when limit reached', (done) => {
      manager.on('exceeded', (data) => {
        expect(data.apiKey).toBe('test-key');
        expect(data.type).toBe('tokens');
        done();
      });

      manager.recordUsage('test-key', {
        promptTokens: 9500,
        completionTokens: 0,
        model: 'gpt-4',
      });

      manager.recordUsage('test-key', {
        promptTokens: 1000,
        completionTokens: 0,
        model: 'gpt-4',
      });
    });
  });

  describe('getReport() method', () => {
    it('should return usage report', () => {
      manager.recordUsage('test-key', {
        promptTokens: 100,
        completionTokens: 50,
        model: 'gpt-4',
        provider: 'claude',
      });

      manager.recordUsage('test-key', {
        promptTokens: 200,
        completionTokens: 100,
        model: 'gpt-3.5-turbo',
        provider: 'openai',
      });

      const report = manager.getReport('test-key');

      expect(report.apiKey).toBe('test-key');
      expect(report.summary.tokensUsed).toBe(450);
      expect(report.breakdown.byModel['gpt-4']).toBeDefined();
      expect(report.breakdown.byModel['gpt-3.5-turbo']).toBeDefined();
      expect(report.breakdown.byProvider['claude']).toBeDefined();
      expect(report.breakdown.byProvider['openai']).toBeDefined();
    });
  });

  describe('getAll() method', () => {
    it('should return all quotas summary', () => {
      manager.recordUsage('key1', { promptTokens: 100, completionTokens: 0, model: 'gpt-4' });
      manager.recordUsage('key2', { promptTokens: 200, completionTokens: 0, model: 'gpt-4' });

      const all = manager.getAll();

      expect(all).toHaveLength(2);
    });
  });

  describe('getStats() method', () => {
    it('should return statistics', () => {
      manager.recordUsage('key1', { promptTokens: 100, completionTokens: 0, model: 'gpt-4' });
      manager.setKeyLimits('key2', { tokenLimit: 50000 });

      const stats = manager.getStats();

      expect(stats.activeKeys).toBe(1);
      expect(stats.customLimits).toBe(1);
      expect(stats.period).toBe(PERIOD.MONTHLY);
      expect(stats.totals.tokens).toBe(100);
    });
  });
});

describe('Quota: PERIOD', () => {
  it('should have all period types', () => {
    expect(PERIOD.DAILY).toBe('daily');
    expect(PERIOD.WEEKLY).toBe('weekly');
    expect(PERIOD.MONTHLY).toBe('monthly');
  });
});
