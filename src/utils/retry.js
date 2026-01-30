/**
 * LLMux - Retry Utilities
 * Exponential backoff retry logic with error classification
 */

/**
 * Delay function
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if error is a quota/rate limit error
 * @param {Error|string} error - Error to check
 * @returns {boolean}
 */
function isQuotaError(error) {
  const msg = (error.message || error || '').toLowerCase();
  return (
    msg.includes('rate limit') ||
    msg.includes('quota') ||
    msg.includes('too many requests') ||
    msg.includes('429') ||
    msg.includes('capacity') ||
    msg.includes('exceeded')
  );
}

/**
 * Check if error is retryable (transient)
 * @param {Error|string} error - Error to check
 * @returns {boolean}
 */
function isRetryableError(error) {
  const msg = (error.message || error || '').toLowerCase();
  return (
    msg.includes('timeout') ||
    msg.includes('econnreset') ||
    msg.includes('econnrefused') ||
    msg.includes('network') ||
    msg.includes('500') ||
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('504')
  );
}

/**
 * Execute function with exponential backoff retry
 * @param {Function} fn - Async function to execute
 * @param {Object} options - Retry options
 * @param {number} [options.maxRetries=3] - Maximum retry attempts
 * @param {number} [options.baseDelay=1000] - Base delay in ms
 * @param {number} [options.maxDelay=10000] - Maximum delay in ms
 * @param {Function} [options.onRetry] - Callback on retry (attempt, error, delay)
 * @returns {Promise<*>} - Result of the function
 */
async function withRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    onRetry = null,
  } = options;

  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry quota errors - should failover to next provider
      if (isQuotaError(error)) {
        throw error;
      }

      // Don't retry non-retryable errors after first attempt
      if (!isRetryableError(error) && attempt > 0) {
        throw error;
      }

      if (attempt < maxRetries - 1) {
        // Exponential backoff with jitter
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        const jitter = delay * 0.1 * Math.random();
        const totalDelay = Math.round(delay + jitter);

        if (onRetry) {
          onRetry(attempt + 1, error, totalDelay);
        } else {
          console.log(
            `[RETRY] Attempt ${attempt + 1}/${maxRetries}, waiting ${totalDelay}ms`
          );
        }

        await sleep(totalDelay);
      }
    }
  }

  throw lastError;
}

/**
 * Create a retry wrapper with preset options
 * @param {Object} defaultOptions - Default retry options
 * @returns {Function} - Configured retry function
 */
function createRetryWrapper(defaultOptions) {
  return (fn, options = {}) => withRetry(fn, { ...defaultOptions, ...options });
}

module.exports = {
  sleep,
  isQuotaError,
  isRetryableError,
  withRetry,
  createRetryWrapper,
};
