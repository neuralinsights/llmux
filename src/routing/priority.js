/**
 * LLMux - Priority-based Fallback Router
 * Executes requests with automatic failover to lower-priority providers
 */

const { getProvider, getProvidersByPriorityOrder } = require('../providers');
const { isQuotaError, estimateTokens: tokenEstimate } = require('../utils');
const { metrics } = require('../telemetry/metrics');

/**
 * Execute a request with priority-based fallback
 * @param {string} prompt - The prompt to send
 * @param {Object} options - Request options
 * @param {Object} cache - Cache instance (optional)
 * @returns {Promise<Object>} Result from successful provider
 */
async function executeWithFallback(prompt, options = {}, cache = null) {
  // Check cache first if provided
  if (cache && options.useCache !== false) {
    const cacheKey = cache.generateKey(prompt, options.model || 'default', 'any');
    const cached = await cache.get(cacheKey);
    if (cached) {
      console.log('[CACHE] Cache hit');
      metrics.record('cache', { type: 'hit' });
      return { ...cached, cached: true };
    }
    metrics.record('cache', { type: 'miss' });
  }

  const providers = getProvidersByPriorityOrder().filter((p) => p.isAvailable());

  if (providers.length === 0) {
    throw new Error('All provider quotas exhausted, please try again later');
  }

  const errors = [];

  for (const provider of providers) {
    try {
      console.log(`[SMART] Trying ${provider.name}...`);
      const startTime = Date.now();

      const result = await provider.call(prompt, options);
      const duration = Date.now() - startTime;

      // Record metrics
      metrics.record('request', { provider: provider.name, model: result.model, status: 'success' });
      metrics.record('latency', { provider: provider.name }, duration);

      // Estimate and record tokens
      const estimatedTokens = estimateTokens(prompt, result.response);
      metrics.record('tokens', { provider: provider.name, type: 'prompt' }, estimatedTokens.prompt);
      metrics.record('tokens', { provider: provider.name, type: 'completion' }, estimatedTokens.completion);

      // Cache result if cache provided
      if (cache && options.useCache !== false) {
        const cacheKey = cache.generateKey(prompt, options.model || 'default', 'any');
        await cache.set(cacheKey, result);
        console.log('[CACHE] Response cached');
      }

      return result;
    } catch (error) {
      errors.push({ provider: provider.name, error: error.message });

      // Record error metric
      metrics.record('error', { provider: provider.name, type: error.name || 'Error' });

      // Handle quota exhaustion
      if (isQuotaError(error)) {
        provider.markQuotaExhausted(error.message);
        console.log(`[SMART] ${provider.name} quota error, switching to next...`);
        continue;
      }

      console.log(`[SMART] ${provider.name} failed: ${error.message}, trying next...`);
    }
  }

  throw new Error(`All providers failed: ${JSON.stringify(errors)}`);
}

/**
 * Execute a streaming request with fallback
 * @param {string} prompt - The prompt to send
 * @param {Object} options - Request options
 * @param {Function} onData - Callback for data chunks
 * @param {Function} onEnd - Callback when complete
 * @param {Function} onError - Callback for errors
 * @param {string} preferredProvider - Optional preferred provider name
 */
function executeStreamWithFallback(prompt, options, onData, onEnd, onError, preferredProvider = null) {
  // Get available streaming providers
  const providers = getProvidersByPriorityOrder()
    .filter((p) => p.isAvailable() && p.supportsStreaming());

  if (providers.length === 0) {
    onError(new Error('No streaming-capable providers available'));
    return;
  }

  // If preferred provider specified and available, use it first
  let orderedProviders = providers;
  if (preferredProvider) {
    const preferred = providers.find((p) => p.name === preferredProvider);
    if (preferred) {
      orderedProviders = [preferred, ...providers.filter((p) => p.name !== preferredProvider)];
    }
  }

  // Try first available streaming provider
  const provider = orderedProviders[0];
  console.log(`[STREAM] Using ${provider.name} for streaming`);

  const wrappedOnEnd = (duration) => {
    metrics.record('request', { provider: provider.name, model: options.model || 'default', status: 'success' });
    metrics.record('latency', { provider: provider.name }, duration);
    onEnd(duration);
  };

  const wrappedOnError = (error) => {
    metrics.record('error', { provider: provider.name, type: error.name || 'Error' });

    if (isQuotaError(error)) {
      provider.markQuotaExhausted(error.message);
    }

    // Try next provider
    const nextProviders = orderedProviders.slice(1);
    if (nextProviders.length > 0) {
      console.log(`[STREAM] ${provider.name} failed, trying ${nextProviders[0].name}...`);
      executeStreamWithFallback(prompt, options, onData, onEnd, onError, nextProviders[0].name);
    } else {
      onError(error);
    }
  };

  provider.callStream(prompt, options, onData, wrappedOnEnd, wrappedOnError);
}

/**
 * Estimate token count using tiktoken (accurate) with fallback to crude estimate
 * @param {string} prompt - Input prompt
 * @param {string} response - Output response
 * @param {string} [model='gpt-4'] - Model name for encoding selection
 * @returns {{prompt: number, completion: number, total: number}}
 */
function estimateTokens(prompt, response, model = 'gpt-4') {
  return tokenEstimate(prompt, response, model);
}

module.exports = {
  executeWithFallback,
  executeStreamWithFallback,
  estimateTokens,
};
