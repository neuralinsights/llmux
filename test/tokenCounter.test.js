/**
 * Token Counter Module Tests
 *
 * Tests accurate token counting using tiktoken
 */

const {
  countTokens,
  countChatTokens,
  estimateTokens,
  estimateCost,
  truncateToTokenLimit,
  MODEL_ENCODINGS,
} = require('../src/utils/tokenCounter');

describe('Token Counter', () => {
  describe('countTokens()', () => {
    it('should return 0 for empty or null input', () => {
      expect(countTokens('')).toBe(0);
      expect(countTokens(null)).toBe(0);
      expect(countTokens(undefined)).toBe(0);
    });

    it('should count tokens for simple text', () => {
      const text = 'Hello, world!';
      const tokens = countTokens(text);
      // tiktoken should give accurate count (~4 tokens for "Hello, world!")
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(10);
    });

    it('should count tokens for longer text', () => {
      const text = 'The quick brown fox jumps over the lazy dog. This is a test sentence.';
      const tokens = countTokens(text);
      expect(tokens).toBeGreaterThan(10);
      expect(tokens).toBeLessThan(30);
    });

    it('should handle different models', () => {
      const text = 'Hello, world!';
      const gpt4Tokens = countTokens(text, 'gpt-4');
      const gpt35Tokens = countTokens(text, 'gpt-3.5-turbo');
      // Both should give reasonable results
      expect(gpt4Tokens).toBeGreaterThan(0);
      expect(gpt35Tokens).toBeGreaterThan(0);
    });

    it('should handle code text', () => {
      const code = `function hello() {
  console.log("Hello, world!");
}`;
      const tokens = countTokens(code);
      expect(tokens).toBeGreaterThan(5);
      expect(tokens).toBeLessThan(50);
    });

    it('should handle unicode text', () => {
      const unicode = '你好世界 👋 🌍';
      const tokens = countTokens(unicode);
      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe('countChatTokens()', () => {
    it('should return 0 for invalid input', () => {
      expect(countChatTokens(null)).toBe(0);
      expect(countChatTokens(undefined)).toBe(0);
      expect(countChatTokens('not an array')).toBe(0);
    });

    it('should count tokens for chat messages', () => {
      const messages = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello!' },
      ];
      const tokens = countChatTokens(messages);
      expect(tokens).toBeGreaterThan(10);
    });

    it('should include message overhead', () => {
      const simpleMessage = [{ role: 'user', content: 'Hi' }];
      const tokens = countChatTokens(simpleMessage);
      // Should have overhead (at least 6 tokens: role tokens + content + message tokens + reply priming)
      expect(tokens).toBeGreaterThanOrEqual(6);
    });

    it('should handle messages with names', () => {
      const messages = [{ role: 'user', name: 'Alice', content: 'Hello!' }];
      const tokens = countChatTokens(messages);
      expect(tokens).toBeGreaterThan(5);
    });
  });

  describe('estimateTokens()', () => {
    it('should return prompt and completion counts', () => {
      const result = estimateTokens('Hello', 'Hi there!');
      expect(result).toHaveProperty('prompt');
      expect(result).toHaveProperty('completion');
      expect(result).toHaveProperty('total');
      expect(result.total).toBe(result.prompt + result.completion);
    });

    it('should handle empty inputs', () => {
      const result = estimateTokens('', '');
      expect(result.prompt).toBe(0);
      expect(result.completion).toBe(0);
      expect(result.total).toBe(0);
    });

    it('should be more accurate than crude estimate', () => {
      const longPrompt = 'This is a longer prompt that should demonstrate the difference in accuracy.';
      const result = estimateTokens(longPrompt, '');
      const crudeEstimate = Math.ceil(longPrompt.length / 4);

      // tiktoken should give a more accurate (typically smaller) count
      expect(result.prompt).toBeLessThanOrEqual(crudeEstimate + 5); // Allow some margin
    });
  });

  describe('estimateCost()', () => {
    it('should calculate cost for GPT-4', () => {
      const cost = estimateCost(1000, 500, 'gpt-4');
      expect(cost).toHaveProperty('promptCost');
      expect(cost).toHaveProperty('completionCost');
      expect(cost).toHaveProperty('totalCost');
      expect(cost).toHaveProperty('currency', 'USD');
      expect(cost.totalCost).toBe(cost.promptCost + cost.completionCost);
    });

    it('should have different pricing for different models', () => {
      const gpt4Cost = estimateCost(1000000, 500000, 'gpt-4');
      const gpt35Cost = estimateCost(1000000, 500000, 'gpt-3.5-turbo');

      // GPT-4 should be more expensive
      expect(gpt4Cost.totalCost).toBeGreaterThan(gpt35Cost.totalCost);
    });

    it('should handle Claude models', () => {
      const cost = estimateCost(1000, 500, 'claude-3-opus');
      expect(cost.totalCost).toBeGreaterThan(0);
    });

    it('should use default pricing for unknown models', () => {
      const cost = estimateCost(1000, 500, 'unknown-model');
      expect(cost.totalCost).toBeGreaterThan(0);
    });
  });

  describe('truncateToTokenLimit()', () => {
    it('should not truncate if within limit', () => {
      const text = 'Short text';
      const result = truncateToTokenLimit(text, 100);
      expect(result.truncated).toBe(false);
      expect(result.text).toBe(text);
    });

    it('should truncate if over limit', () => {
      const longText =
        'This is a very long text that should exceed the token limit when we set it to a small value. '.repeat(
          10
        );
      const result = truncateToTokenLimit(longText, 10);
      expect(result.truncated).toBe(true);
      expect(result.finalTokens).toBeLessThanOrEqual(10);
      expect(result.originalTokens).toBeGreaterThan(10);
    });

    it('should handle empty input', () => {
      const result = truncateToTokenLimit('', 100);
      expect(result.truncated).toBe(false);
      expect(result.text).toBe('');
      expect(result.originalTokens).toBe(0);
    });
  });

  describe('MODEL_ENCODINGS', () => {
    it('should have default encoding', () => {
      expect(MODEL_ENCODINGS.default).toBe('cl100k_base');
    });

    it('should have GPT-4 encoding', () => {
      expect(MODEL_ENCODINGS['gpt-4']).toBe('cl100k_base');
    });

    it('should have Claude encoding', () => {
      expect(MODEL_ENCODINGS['claude-3']).toBe('cl100k_base');
    });
  });
});
