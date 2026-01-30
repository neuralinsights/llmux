/**
 * LLMux - Telemetry Module Index
 * Re-exports telemetry modules including metrics and tracing
 */

const { MetricsCollector, metrics } = require('./metrics');
const {
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
} = require('./tracing');
const {
  initializeOtel,
  shutdownOtel,
  isOtelEnabled,
  getOtelConfig,
} = require('./otelSetup');

module.exports = {
  // Metrics
  MetricsCollector,
  metrics,

  // Tracing
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

  // OpenTelemetry SDK
  initializeOtel,
  shutdownOtel,
  isOtelEnabled,
  getOtelConfig,
};
