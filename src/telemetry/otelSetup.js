/**
 * LLMux - OpenTelemetry SDK Setup
 * Initializes OpenTelemetry with configurable exporters
 */

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { Resource } = require('@opentelemetry/resources');
const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } = require('@opentelemetry/semantic-conventions');

let sdk = null;
let isInitialized = false;

/**
 * Default OpenTelemetry configuration
 */
const DEFAULT_CONFIG = {
  serviceName: 'llmux',
  serviceVersion: process.env.npm_package_version || '3.1.0',
  enabled: process.env.OTEL_ENABLED === 'true',
  endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
  headers: {},
  autoInstrumentation: {
    '@opentelemetry/instrumentation-http': { enabled: true },
    '@opentelemetry/instrumentation-express': { enabled: true },
    '@opentelemetry/instrumentation-dns': { enabled: false },
    '@opentelemetry/instrumentation-fs': { enabled: false },
  },
};

/**
 * Initialize OpenTelemetry SDK
 * @param {Object} [config] - Configuration options
 * @param {string} [config.serviceName] - Service name for traces
 * @param {string} [config.serviceVersion] - Service version
 * @param {boolean} [config.enabled] - Whether tracing is enabled
 * @param {string} [config.endpoint] - OTLP endpoint URL
 * @param {Object} [config.headers] - Additional headers for exporter
 * @returns {Promise<void>}
 */
async function initializeOtel(config = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  if (!finalConfig.enabled) {
    console.log('[OTEL] Tracing disabled (set OTEL_ENABLED=true to enable)');
    return;
  }

  if (isInitialized) {
    console.log('[OTEL] Already initialized');
    return;
  }

  try {
    // Parse headers from environment if present
    const envHeaders = process.env.OTEL_EXPORTER_OTLP_HEADERS;
    if (envHeaders) {
      envHeaders.split(',').forEach((header) => {
        const [key, value] = header.split('=');
        if (key && value) {
          finalConfig.headers[key.trim()] = value.trim();
        }
      });
    }

    // Create trace exporter
    const traceExporter = new OTLPTraceExporter({
      url: finalConfig.endpoint,
      headers: finalConfig.headers,
    });

    // Create SDK with auto-instrumentation
    sdk = new NodeSDK({
      resource: new Resource({
        [ATTR_SERVICE_NAME]: finalConfig.serviceName,
        [ATTR_SERVICE_VERSION]: finalConfig.serviceVersion,
        'deployment.environment': process.env.NODE_ENV || 'development',
      }),
      traceExporter,
      instrumentations: [
        getNodeAutoInstrumentations(finalConfig.autoInstrumentation),
      ],
    });

    // Start SDK
    await sdk.start();
    isInitialized = true;

    console.log(`[OTEL] Tracing initialized`);
    console.log(`[OTEL] Service: ${finalConfig.serviceName}@${finalConfig.serviceVersion}`);
    console.log(`[OTEL] Endpoint: ${finalConfig.endpoint}`);

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      await shutdownOtel();
      process.exit(0);
    });
  } catch (error) {
    console.error('[OTEL] Failed to initialize:', error.message);
  }
}

/**
 * Shutdown OpenTelemetry SDK gracefully
 * @returns {Promise<void>}
 */
async function shutdownOtel() {
  if (sdk && isInitialized) {
    try {
      await sdk.shutdown();
      isInitialized = false;
      console.log('[OTEL] Tracing shutdown complete');
    } catch (error) {
      console.error('[OTEL] Error during shutdown:', error.message);
    }
  }
}

/**
 * Check if OpenTelemetry is enabled and initialized
 * @returns {boolean}
 */
function isOtelEnabled() {
  return isInitialized;
}

/**
 * Get current OpenTelemetry configuration
 * @returns {Object}
 */
function getOtelConfig() {
  return {
    enabled: isInitialized,
    serviceName: DEFAULT_CONFIG.serviceName,
    serviceVersion: DEFAULT_CONFIG.serviceVersion,
    endpoint: DEFAULT_CONFIG.endpoint,
  };
}

module.exports = {
  initializeOtel,
  shutdownOtel,
  isOtelEnabled,
  getOtelConfig,
  DEFAULT_CONFIG,
};
