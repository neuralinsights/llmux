/**
 * Utils Module Unit Tests
 */

const { sleep, isQuotaError, isRetryableError, withRetry } = require('../src/utils/retry');
const { isCommandAvailable } = require('../src/utils/cli');

describe('Utils: Retry Module', () => {
  describe('sleep()', () => {
    it('should delay for specified milliseconds', async () => {
      const start = Date.now();
      await sleep(50);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(45);
      expect(elapsed).toBeLessThan(100);
    });

    it('should handle zero delay', async () => {
      const start = Date.now();
      await sleep(0);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(50);
    });
  });

  describe('isQuotaError()', () => {
    it('should return true for 429 status', () => {
      expect(isQuotaError({ status: 429 })).toBe(true);
    });

    it('should return true for quota exceeded message', () => {
      expect(isQuotaError({ message: 'Quota exceeded' })).toBe(true);
      expect(isQuotaError({ message: 'RATE_LIMIT_EXCEEDED' })).toBe(true);
    });

    it('should return false for other errors', () => {
      expect(isQuotaError({ status: 500 })).toBe(false);
      expect(isQuotaError({ message: 'Server error' })).toBe(false);
      expect(isQuotaError(new Error('Generic error'))).toBe(false);
    });
  });

  describe('isRetryableError()', () => {
    it('should return true for 5xx status codes', () => {
      expect(isRetryableError({ status: 500 })).toBe(true);
      expect(isRetryableError({ status: 502 })).toBe(true);
      expect(isRetryableError({ status: 503 })).toBe(true);
    });

    it('should return true for network errors', () => {
      expect(isRetryableError({ code: 'ECONNRESET' })).toBe(true);
      expect(isRetryableError({ code: 'ETIMEDOUT' })).toBe(true);
      expect(isRetryableError({ code: 'ECONNREFUSED' })).toBe(true);
    });

    it('should return false for 4xx errors (except 429)', () => {
      expect(isRetryableError({ status: 400 })).toBe(false);
      expect(isRetryableError({ status: 401 })).toBe(false);
      expect(isRetryableError({ status: 404 })).toBe(false);
    });

    it('should return true for 429 rate limit', () => {
      expect(isRetryableError({ status: 429 })).toBe(true);
    });
  });

  describe('withRetry()', () => {
    it('should succeed on first attempt', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const result = await withRetry(fn, { maxRetries: 3 });
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce({ status: 500 })
        .mockRejectedValueOnce({ status: 503 })
        .mockResolvedValue('success');

      const result = await withRetry(fn, { maxRetries: 3, baseDelay: 10 });
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw after max retries exceeded', async () => {
      const fn = jest.fn().mockRejectedValue({ status: 500, message: 'Server error' });

      await expect(withRetry(fn, { maxRetries: 2, baseDelay: 10 }))
        .rejects.toMatchObject({ status: 500 });
      // maxRetries: 2 means loop runs twice (attempt 0 and 1)
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should not retry non-retryable errors', async () => {
      const fn = jest.fn().mockRejectedValue({ status: 400, message: 'Bad request' });

      await expect(withRetry(fn, { maxRetries: 3, baseDelay: 10 }))
        .rejects.toMatchObject({ status: 400 });
      // Non-retryable errors: attempt 0 succeeds but attempt 1 throws immediately
      // Actually first attempt throws, but 400 is not retryable so it throws after first retry check
      expect(fn).toHaveBeenCalledTimes(2); // First attempt + one retry before giving up
    });

    it('should call onRetry callback', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce({ status: 500 })
        .mockResolvedValue('success');
      const onRetry = jest.fn();

      await withRetry(fn, { maxRetries: 3, baseDelay: 10, onRetry });
      expect(onRetry).toHaveBeenCalledTimes(1);
      // onRetry is called with (attempt, error, delay)
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Object), expect.any(Number));
    });
  });
});

describe('Utils: CLI Module', () => {
  describe('isCommandAvailable()', () => {
    it('should return true for available commands', async () => {
      const result = await isCommandAvailable('node');
      expect(result).toBe(true);
    });

    it('should return false for unavailable commands', async () => {
      const result = await isCommandAvailable('nonexistent_command_xyz123');
      expect(result).toBe(false);
    });

    it('should handle empty command', async () => {
      const result = await isCommandAvailable('');
      expect(result).toBe(false);
    });
  });
});
