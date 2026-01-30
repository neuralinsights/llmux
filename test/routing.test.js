/**
 * Dynamic Router Tests
 */

const { DynamicRouter, TASK_TYPE, PROVIDER_PROFILES } = require('../src/routing');

// Mock the providers module
jest.mock('../src/providers', () => ({
  getProvider: jest.fn((name) => ({
    name,
    isAvailable: () => true,
    config: { weight: 10 },
  })),
  getAvailableProviders: jest.fn(() => [
    { name: 'claude', isAvailable: () => true },
    { name: 'gemini', isAvailable: () => true },
    { name: 'ollama', isAvailable: () => true },
  ]),
}));

describe('Routing: DynamicRouter', () => {
  let router;

  beforeEach(() => {
    router = new DynamicRouter();
  });

  describe('task type detection', () => {
    it('should detect code tasks', () => {
      expect(router.detectTaskType('Write a function to sort an array')).toBe(TASK_TYPE.CODE);
      expect(router.detectTaskType('Debug this Python code')).toBe(TASK_TYPE.CODE);
      expect(router.detectTaskType('Implement a class for user authentication')).toBe(TASK_TYPE.CODE);
    });

    it('should detect analysis tasks', () => {
      expect(router.detectTaskType('Analyze this data pattern')).toBe(TASK_TYPE.ANALYSIS);
      expect(router.detectTaskType('Explain how this algorithm works')).toBe(TASK_TYPE.ANALYSIS);
    });

    it('should detect creative tasks', () => {
      expect(router.detectTaskType('Write a short story about space')).toBe(TASK_TYPE.CREATIVE);
      expect(router.detectTaskType('Compose a poem about nature')).toBe(TASK_TYPE.CREATIVE);
    });

    it('should detect translation tasks', () => {
      expect(router.detectTaskType('Translate this to Spanish')).toBe(TASK_TYPE.TRANSLATION);
    });

    it('should detect summarization tasks', () => {
      expect(router.detectTaskType('Summarize this article')).toBe(TASK_TYPE.SUMMARIZATION);
      expect(router.detectTaskType('Give me a TLDR of this')).toBe(TASK_TYPE.SUMMARIZATION);
    });

    it('should detect chat tasks', () => {
      expect(router.detectTaskType('Hello, how are you?')).toBe(TASK_TYPE.CHAT);
    });

    it('should use explicit task type from options', () => {
      expect(router.detectTaskType('random text', { taskType: TASK_TYPE.CODE })).toBe(TASK_TYPE.CODE);
    });

    it('should return general for unrecognized patterns', () => {
      expect(router.detectTaskType('calculate 2+2')).toBe(TASK_TYPE.GENERAL);
    });
  });

  describe('provider scoring', () => {
    it('should return scores for providers', () => {
      const score = router.getProviderScore('claude', TASK_TYPE.CODE);

      expect(score).toHaveProperty('total');
      expect(score).toHaveProperty('breakdown');
      expect(score.breakdown).toHaveProperty('quality');
      expect(score.breakdown).toHaveProperty('latency');
      expect(score.breakdown).toHaveProperty('cost');
    });

    it('should give higher quality score for matching strengths', () => {
      const codeScore = router.getProviderScore('claude', TASK_TYPE.CODE);
      const chatScore = router.getProviderScore('claude', TASK_TYPE.CHAT);

      // Claude's strength is CODE, so code score should be higher
      expect(codeScore.breakdown.quality).toBeGreaterThan(chatScore.breakdown.quality);
    });

    it('should return zero for unknown providers', () => {
      const score = router.getProviderScore('unknown', TASK_TYPE.GENERAL);
      expect(score.total).toBe(0);
    });
  });

  describe('provider selection', () => {
    it('should select a provider', () => {
      const result = router.selectProvider('Write a function');

      expect(result).toHaveProperty('provider');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('taskType');
      expect(result).toHaveProperty('alternatives');
    });

    it('should detect task type', () => {
      const result = router.selectProvider('Write a JavaScript function');
      expect(result.taskType).toBe(TASK_TYPE.CODE);
    });

    it('should provide alternatives', () => {
      const result = router.selectProvider('Hello');
      expect(result.alternatives).toBeDefined();
      expect(Array.isArray(result.alternatives)).toBe(true);
    });
  });

  describe('latency tracking', () => {
    it('should record latency', () => {
      router.recordLatency('claude', 1500);
      router.recordLatency('claude', 1700);

      const stats = router.getStats();
      expect(stats.latencyStats['claude']).toBeDefined();
      expect(stats.latencyStats['claude'].samples).toBe(2);
    });

    it('should calculate average latency', () => {
      router.recordLatency('gemini', 1000);
      router.recordLatency('gemini', 1200);
      router.recordLatency('gemini', 1400);

      const stats = router.getStats();
      expect(stats.latencyStats['gemini'].avg).toBeGreaterThan(0);
    });

    it('should reset latency history', () => {
      router.recordLatency('claude', 1500);
      router.resetLatencyHistory();

      const stats = router.getStats();
      expect(stats.latencyStats).toEqual({});
    });
  });

  describe('strategy configuration', () => {
    it('should use default balanced strategy', () => {
      expect(router.strategy).toBe('balanced');
    });

    it('should allow changing strategy', () => {
      router.setStrategy('latency');
      expect(router.strategy).toBe('latency');
    });

    it('should allow updating weights', () => {
      router.setWeights({ quality: 0.6, latency: 0.2, cost: 0.2 });
      expect(router.weights.quality).toBe(0.6);
    });
  });

  describe('profile management', () => {
    it('should update provider profiles', () => {
      router.updateProfile('claude', { avgLatency: 1000 });

      expect(router.profiles['claude'].avgLatency).toBe(1000);
    });
  });

  describe('getStats()', () => {
    it('should return router statistics', () => {
      const stats = router.getStats();

      expect(stats).toHaveProperty('strategy');
      expect(stats).toHaveProperty('weights');
      expect(stats).toHaveProperty('latencyStats');
      expect(stats).toHaveProperty('profiles');
    });
  });
});

describe('Routing: TASK_TYPE', () => {
  it('should have all task types', () => {
    expect(TASK_TYPE.CHAT).toBe('chat');
    expect(TASK_TYPE.CODE).toBe('code');
    expect(TASK_TYPE.ANALYSIS).toBe('analysis');
    expect(TASK_TYPE.CREATIVE).toBe('creative');
    expect(TASK_TYPE.TRANSLATION).toBe('translation');
    expect(TASK_TYPE.SUMMARIZATION).toBe('summarization');
    expect(TASK_TYPE.GENERAL).toBe('general');
  });
});

describe('Routing: PROVIDER_PROFILES', () => {
  it('should have profiles for main providers', () => {
    expect(PROVIDER_PROFILES).toHaveProperty('claude');
    expect(PROVIDER_PROFILES).toHaveProperty('gemini');
    expect(PROVIDER_PROFILES).toHaveProperty('codex');
    expect(PROVIDER_PROFILES).toHaveProperty('ollama');
  });

  it('should have required profile fields', () => {
    const profile = PROVIDER_PROFILES['claude'];

    expect(profile).toHaveProperty('strengths');
    expect(profile).toHaveProperty('avgLatency');
    expect(profile).toHaveProperty('costPerMToken');
    expect(profile).toHaveProperty('qualityScore');
    expect(profile).toHaveProperty('maxTokens');
  });
});
