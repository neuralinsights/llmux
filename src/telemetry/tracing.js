/**
 * LLMux - OpenTelemetry Distributed Tracing
 * Provides distributed tracing capabilities for LLM provider calls
 */

const { trace, context, SpanKind, SpanStatusCode } = require('@opentelemetry/api');

// Tracer name for LLMux
const TRACER_NAME = 'llmux';

/**
 * Get the LLMux tracer instance
 * @returns {import('@opentelemetry/api').Tracer}
 */
function getTracer() {
  return trace.getTracer(TRACER_NAME);
}

/**
 * Create a span for an LLM provider request
 * @param {string} provider - Provider name (claude, openai, gemini, etc.)
 * @param {string} operation - Operation type (chat, complete, embed, etc.)
 * @param {Object} attributes - Additional span attributes
 * @returns {import('@opentelemetry/api').Span}
 */
function startProviderSpan(provider, operation, attributes = {}) {
  const tracer = getTracer();
  return tracer.startSpan(`llm.${provider}.${operation}`, {
    kind: SpanKind.CLIENT,
    attributes: {
      'llm.provider': provider,
      'llm.operation': operation,
      'llm.system': 'llmux',
      ...attributes,
    },
  });
}

/**
 * Record span success with response metadata
 * @param {import('@opentelemetry/api').Span} span - The span to update
 * @param {Object} response - Response data
 * @param {number} [response.promptTokens] - Input tokens
 * @param {number} [response.completionTokens] - Output tokens
 * @param {string} [response.model] - Model used
 * @param {number} [response.latencyMs] - Latency in milliseconds
 */
function recordSuccess(span, response = {}) {
  if (response.promptTokens !== undefined) {
    span.setAttribute('llm.usage.prompt_tokens', response.promptTokens);
  }
  if (response.completionTokens !== undefined) {
    span.setAttribute('llm.usage.completion_tokens', response.completionTokens);
  }
  if (response.model) {
    span.setAttribute('llm.response.model', response.model);
  }
  if (response.latencyMs !== undefined) {
    span.setAttribute('llm.latency_ms', response.latencyMs);
  }
  span.setStatus({ code: SpanStatusCode.OK });
  span.end();
}

/**
 * Record span error
 * @param {import('@opentelemetry/api').Span} span - The span to update
 * @param {Error} error - The error that occurred
 * @param {Object} [attributes] - Additional error attributes
 */
function recordError(span, error, attributes = {}) {
  span.recordException(error);
  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: error.message,
  });
  if (attributes.errorType) {
    span.setAttribute('error.type', attributes.errorType);
  }
  if (attributes.statusCode) {
    span.setAttribute('http.status_code', attributes.statusCode);
  }
  span.end();
}

/**
 * Wrapper for tracing async operations
 * @param {string} name - Span name
 * @param {Object} options - Span options
 * @param {Function} fn - Async function to trace
 * @returns {Promise<*>} Result of the function
 */
async function withSpan(name, options, fn) {
  const tracer = getTracer();
  return tracer.startActiveSpan(name, options, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Express middleware for request tracing
 * @returns {Function} Express middleware
 */
function tracingMiddleware() {
  return (req, res, next) => {
    const tracer = getTracer();
    const span = tracer.startSpan(`HTTP ${req.method} ${req.path}`, {
      kind: SpanKind.SERVER,
      attributes: {
        'http.method': req.method,
        'http.url': req.originalUrl,
        'http.target': req.path,
        'http.user_agent': req.get('user-agent') || 'unknown',
        'llm.system': 'llmux',
      },
    });

    // Store span in request for downstream use
    req.span = span;

    // Capture response data
    const originalEnd = res.end;
    res.end = function (...args) {
      span.setAttribute('http.status_code', res.statusCode);

      if (res.statusCode >= 400) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: `HTTP ${res.statusCode}`,
        });
      } else {
        span.setStatus({ code: SpanStatusCode.OK });
      }

      span.end();
      return originalEnd.apply(this, args);
    };

    next();
  };
}

/**
 * Create a child span from request context
 * @param {Object} req - Express request with span attached
 * @param {string} name - Child span name
 * @param {Object} [attributes] - Span attributes
 * @returns {import('@opentelemetry/api').Span}
 */
function createChildSpan(req, name, attributes = {}) {
  const tracer = getTracer();
  const parentSpan = req.span;

  if (parentSpan) {
    const ctx = trace.setSpan(context.active(), parentSpan);
    return tracer.startSpan(name, { attributes }, ctx);
  }

  return tracer.startSpan(name, { attributes });
}

/**
 * Trace provider selection decision
 * @param {Object} req - Express request
 * @param {Object} decision - Router decision
 */
function traceRouterDecision(req, decision) {
  const span = createChildSpan(req, 'llm.router.select', {
    'llm.router.selected_provider': decision.provider,
    'llm.router.task_type': decision.taskType,
    'llm.router.score': decision.score?.total || 0,
    'llm.router.alternatives_count': decision.alternatives?.length || 0,
  });
  span.end();
}

/**
 * Trace cache operation
 * @param {Object} req - Express request
 * @param {string} operation - Cache operation (get, set, delete)
 * @param {boolean} hit - Whether cache hit occurred
 * @param {string} [key] - Cache key (hashed)
 */
function traceCacheOperation(req, operation, hit, key) {
  const span = createChildSpan(req, `cache.${operation}`, {
    'cache.operation': operation,
    'cache.hit': hit,
  });
  if (key) {
    span.setAttribute('cache.key_prefix', key.substring(0, 8));
  }
  span.end();
}

/**
 * Trace circuit breaker state
 * @param {Object} req - Express request
 * @param {string} provider - Provider name
 * @param {string} state - Circuit state (closed, open, half_open)
 * @param {boolean} allowed - Whether request was allowed
 */
function traceCircuitBreaker(req, provider, state, allowed) {
  const span = createChildSpan(req, 'circuit_breaker.check', {
    'circuit_breaker.provider': provider,
    'circuit_breaker.state': state,
    'circuit_breaker.allowed': allowed,
  });
  span.end();
}

/**
 * Trace rate limit check
 * @param {Object} req - Express request
 * @param {string} key - Rate limit key
 * @param {boolean} allowed - Whether request was allowed
 * @param {number} remaining - Remaining requests
 */
function traceRateLimit(req, key, allowed, remaining) {
  const span = createChildSpan(req, 'rate_limit.check', {
    'rate_limit.key_type': key.includes(':') ? 'api_key' : 'ip',
    'rate_limit.allowed': allowed,
    'rate_limit.remaining': remaining,
  });
  span.end();
}

/**
 * Trace quota check
 * @param {Object} req - Express request
 * @param {string} apiKey - API key (masked)
 * @param {boolean} allowed - Whether request was allowed
 * @param {Object} usage - Usage data
 */
function traceQuotaCheck(req, apiKey, allowed, usage = {}) {
  const maskedKey = apiKey ? `${apiKey.substring(0, 4)}...${apiKey.slice(-4)}` : 'unknown';
  const span = createChildSpan(req, 'quota.check', {
    'quota.api_key': maskedKey,
    'quota.allowed': allowed,
    'quota.tokens_used': usage.tokensUsed || 0,
    'quota.tokens_limit': usage.tokenLimit || 0,
  });
  span.end();
}

module.exports = {
  getTracer,
  startProviderSpan,
  recordSuccess,
  recordError,
  withSpan,
  tracingMiddleware,
  createChildSpan,
  traceRouterDecision,
  traceCacheOperation,
  traceCircuitBreaker,
  traceRateLimit,
  traceQuotaCheck,
  TRACER_NAME,
};
