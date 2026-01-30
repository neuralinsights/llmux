/**
 * LLMux v3.0.0 - Express Application Configuration
 * Configures middleware, routes, and error handling
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const { env, PROVIDER_CONFIG } = require('./config');
const { metrics } = require('./telemetry');
const { createCache } = require('./cache');
const { authMiddleware, adminAuthMiddleware, generateApiKey, listApiKeys, deleteApiKey } = require('./middleware/auth');
const { validateGenerateRequest, validateChatCompletionRequest } = require('./middleware/validation');
const { getProvider, getAvailableProviders, getAllProviderStats } = require('./providers');
const { executeWithFallback, executeStreamWithFallback, selectProviderWeighted, estimateTokens } = require('./routing');

const app = express();

// ============ Logging Setup ============
const LOG_DIR = path.join(process.cwd(), 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// ============ Middleware ============
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(
  morgan('combined', {
    stream: fs.createWriteStream(path.join(LOG_DIR, 'access.log'), {
      flags: 'a',
    }),
  })
);

// Authentication middleware
app.use(authMiddleware);

// Request counting middleware
app.use((req, res, next) => {
  metrics.incrementActiveRequests();
  res.on('finish', () => {
    metrics.decrementActiveRequests();
  });
  next();
});

// ============ Cache Instance ============
let cache = null;

/**
 * Initialize cache (async)
 */
async function initializeCache() {
  cache = await createCache({
    backend: env.CACHE_BACKEND,
    ttl: env.CACHE_TTL,
    maxSize: env.CACHE_MAX_SIZE,
    redisUrl: env.REDIS_URL,
  });
  return cache;
}

// ============ API Routes ============

/**
 * Prometheus metrics endpoint
 */
app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain; version=0.0.4');
  res.send(metrics.toPrometheusFormat());
});

/**
 * Health check endpoint
 */
app.get('/health', async (req, res) => {
  const deep = req.query.deep === 'true';
  const availableProviders = getAvailableProviders();

  const cacheStats = cache ? await cache.getStats() : { size: 0, maxSize: 0 };

  const healthData = {
    status: availableProviders.length > 0 ? 'healthy' : 'degraded',
    version: '3.0.0',
    timestamp: new Date().toISOString(),
    uptime: metrics.getUptime(),
    providers: getAllProviderStats(),
    cache: {
      size: cacheStats.size,
      maxSize: cacheStats.maxSize,
      hitRate: cacheStats.hitRate || 'N/A',
    },
    activeRequests: metrics.activeRequests,
    availableProviders: availableProviders.map((p) => p.name),
    defaultProvider: env.DEFAULT_PROVIDER,
  };

  // Deep check: verify Ollama connectivity
  if (deep) {
    healthData.deepCheck = {};
    try {
      const ollamaProvider = getProvider('ollama');
      healthData.deepCheck.ollama = await ollamaProvider.healthCheck();
    } catch (err) {
      healthData.deepCheck.ollama = { status: 'error', error: err.message };
    }
  }

  res.status(healthData.status === 'healthy' ? 200 : 503).json(healthData);
});

/**
 * Unified generation endpoint
 */
app.post('/api/generate', validateGenerateRequest, async (req, res) => {
  const startTime = Date.now();
  const requestId = uuidv4().slice(0, 8);

  try {
    const {
      provider = env.DEFAULT_PROVIDER,
      prompt,
      model,
      options = {},
      stream = false,
    } = req.body;

    console.log(
      `[${requestId}] Request: provider=${provider}, stream=${stream}, prompt=${prompt.slice(0, 50)}...`
    );

    // Get provider instance
    const providerInstance = getProvider(provider);

    // Streaming response
    if (stream) {
      if (!providerInstance.supportsStreaming()) {
        return res.status(400).json({
          error: `Provider ${provider} does not support streaming`,
        });
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Request-ID', requestId);

      const sendEvent = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      const onData = (chunk) => {
        sendEvent({ content: chunk, done: false });
      };

      const onEnd = (duration) => {
        sendEvent({ content: '', done: true, duration });
        res.write('data: [DONE]\n\n');
        res.end();
      };

      const onError = (err) => {
        sendEvent({ error: err.message, done: true });
        res.end();
      };

      providerInstance.callStream(prompt, { ...options, model }, onData, onEnd, onError);
      return;
    }

    // Non-streaming response
    const result = await providerInstance.call(prompt, {
      ...options,
      model,
      timeout: options.timeout || env.REQUEST_TIMEOUT,
    });

    // Record metrics
    metrics.record('request', { provider, model: result.model, status: 'success' });
    metrics.record('latency', { provider }, result.duration);

    res.json({
      model: result.model,
      created_at: new Date().toISOString(),
      response: result.response,
      done: true,
      context: [],
      total_duration: (Date.now() - startTime) * 1000000,
      provider: result.provider,
      request_id: requestId,
    });
  } catch (error) {
    console.error(`[${requestId}] Error:`, error.message);
    metrics.record('error', { provider: req.body.provider || 'unknown', type: 'request' });

    res.status(500).json({
      error: error.message,
      request_id: requestId,
      duration: Date.now() - startTime,
    });
  }
});

/**
 * Smart generation endpoint (auto-routing with fallback)
 */
app.post('/api/smart', validateGenerateRequest, async (req, res) => {
  const startTime = Date.now();
  const requestId = uuidv4().slice(0, 8);

  try {
    const { prompt, options = {}, stream = false } = req.body;

    console.log(`[${requestId}] Smart Request: stream=${stream}, prompt=${prompt.slice(0, 50)}...`);

    // Streaming smart routing
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Request-ID', requestId);

      const sendEvent = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      const onData = (chunk) => {
        sendEvent({ content: chunk, done: false });
      };

      const onEnd = (duration) => {
        sendEvent({ content: '', done: true, duration });
        res.write('data: [DONE]\n\n');
        res.end();
      };

      const onError = (err) => {
        sendEvent({ error: err.message, done: true });
        res.end();
      };

      // Use weighted selection for streaming
      const selectedProvider = selectProviderWeighted();
      if (!selectedProvider) {
        return onError(new Error('No providers available'));
      }

      executeStreamWithFallback(prompt, options, onData, onEnd, onError, selectedProvider);
      return;
    }

    // Non-streaming smart routing with fallback
    const result = await executeWithFallback(prompt, {
      ...options,
      timeout: options.timeout || env.REQUEST_TIMEOUT,
    }, cache);

    res.json({
      model: result.model,
      created_at: new Date().toISOString(),
      response: result.response,
      done: true,
      context: [],
      total_duration: (Date.now() - startTime) * 1000000,
      provider: result.provider,
      request_id: requestId,
      cached: result.cached || false,
    });
  } catch (error) {
    console.error(`[${requestId}] Error:`, error.message);

    res.status(500).json({
      error: error.message,
      request_id: requestId,
      duration: Date.now() - startTime,
    });
  }
});

/**
 * OpenAI-compatible chat completions endpoint
 */
app.post('/v1/chat/completions', validateChatCompletionRequest, async (req, res) => {
  const startTime = Date.now();
  const requestId = uuidv4().slice(0, 8);

  try {
    const { model, messages, stream = false, temperature, max_tokens } = req.body;

    // Convert messages to prompt
    const prompt = messages.map((m) => `${m.role}: ${m.content}`).join('\n');

    // Parse model to determine provider
    const parsed = req.parsedModel || { provider: null, model };
    const providerName = parsed.provider || env.DEFAULT_PROVIDER;

    console.log(`[${requestId}] OpenAI Request: model=${model}, provider=${providerName}, stream=${stream}`);

    const options = {
      model: parsed.model || model,
      temperature,
      maxTokens: max_tokens,
    };

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const sendChunk = (content, finishReason = null) => {
        const chunk = {
          id: `chatcmpl-${requestId}`,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: model,
          choices: [
            {
              index: 0,
              delta: finishReason ? {} : { content },
              finish_reason: finishReason,
            },
          ],
        };
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      };

      const onData = (chunk) => sendChunk(chunk);
      const onEnd = () => {
        sendChunk('', 'stop');
        res.write('data: [DONE]\n\n');
        res.end();
      };
      const onError = (err) => {
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
      };

      executeStreamWithFallback(prompt, options, onData, onEnd, onError, providerName);
      return;
    }

    // Non-streaming
    const result = await executeWithFallback(prompt, options, cache);

    const tokens = estimateTokens(prompt, result.response);

    res.json({
      id: `chatcmpl-${requestId}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: result.response,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: tokens.prompt,
        completion_tokens: tokens.completion,
        total_tokens: tokens.prompt + tokens.completion,
      },
    });
  } catch (error) {
    console.error(`[${requestId}] OpenAI Error:`, error.message);

    res.status(500).json({
      error: {
        message: error.message,
        type: 'server_error',
        code: 'internal_error',
      },
    });
  }
});

/**
 * OpenAI-compatible models list endpoint
 */
app.get('/v1/models', (req, res) => {
  const models = [];

  for (const [providerName, config] of Object.entries(PROVIDER_CONFIG)) {
    for (const [alias, modelId] of Object.entries(config.models)) {
      models.push({
        id: modelId,
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: providerName,
      });
    }
  }

  res.json({
    object: 'list',
    data: models,
  });
});

/**
 * Model tags endpoint (Ollama-compatible)
 */
app.get('/api/tags', async (req, res) => {
  try {
    const ollamaProvider = getProvider('ollama');
    const ollamaModels = await ollamaProvider.listModels();

    res.json({
      models: ollamaModels,
    });
  } catch (error) {
    res.json({ models: [] });
  }
});

/**
 * Quota status endpoint
 */
app.get('/api/quota', (req, res) => {
  res.json(getAllProviderStats());
});

/**
 * Reset quota endpoint
 */
app.post('/api/quota/reset', (req, res) => {
  const { provider } = req.body;

  if (provider) {
    try {
      const p = getProvider(provider);
      p.resetQuota();
      res.json({ success: true, provider });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  } else {
    // Reset all providers
    for (const name of Object.keys(PROVIDER_CONFIG)) {
      const p = getProvider(name);
      p.resetQuota();
    }
    res.json({ success: true, provider: 'all' });
  }
});

/**
 * Cache statistics endpoint
 */
app.get('/api/cache/stats', async (req, res) => {
  if (!cache) {
    return res.json({ enabled: false });
  }

  const stats = await cache.getStats();
  res.json({
    enabled: true,
    ...stats,
  });
});

/**
 * Clear cache endpoint
 */
app.post('/api/cache/clear', async (req, res) => {
  if (!cache) {
    return res.json({ cleared: 0 });
  }

  const cleared = await cache.clear();
  res.json({ cleared });
});

// ============ Admin Routes ============

/**
 * Generate new API key
 */
app.post('/admin/api-keys', adminAuthMiddleware, (req, res) => {
  const { userId, projectId } = req.body;
  const result = generateApiKey(userId, projectId);
  res.json({ apiKey: result.apiKey, ...result.info });
});

/**
 * List API keys
 */
app.get('/admin/api-keys', adminAuthMiddleware, (req, res) => {
  res.json({ keys: listApiKeys() });
});

/**
 * Delete API key
 */
app.delete('/admin/api-keys/:key', adminAuthMiddleware, (req, res) => {
  const deleted = deleteApiKey(req.params.key);
  res.json({ success: deleted });
});

// ============ Error Handling ============

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

module.exports = { app, initializeCache };
