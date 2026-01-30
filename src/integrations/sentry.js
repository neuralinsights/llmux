/**
 * LLMux - Sentry Error Tracking Integration
 * Provides error tracking and performance monitoring via Sentry
 */

let Sentry = null;
let isInitialized = false;

/**
 * Default Sentry configuration
 */
const DEFAULT_CONFIG = {
  enabled: process.env.SENTRY_ENABLED === 'true',
  dsn: process.env.SENTRY_DSN || '',
  environment: process.env.NODE_ENV || 'development',
  release: process.env.npm_package_version || '3.1.0',
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0.1,
  profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE) || 0.1,
  debug: process.env.SENTRY_DEBUG === 'true',
};

/**
 * Initialize Sentry
 * @param {Object} [config] - Configuration options
 * @returns {boolean} Whether initialization was successful
 */
function initializeSentry(config = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  if (!finalConfig.enabled) {
    console.log('[SENTRY] Error tracking disabled (set SENTRY_ENABLED=true to enable)');
    return false;
  }

  if (!finalConfig.dsn) {
    console.warn('[SENTRY] DSN not provided, error tracking disabled');
    return false;
  }

  if (isInitialized) {
    console.log('[SENTRY] Already initialized');
    return true;
  }

  try {
    Sentry = require('@sentry/node');

    Sentry.init({
      dsn: finalConfig.dsn,
      environment: finalConfig.environment,
      release: `llmux@${finalConfig.release}`,
      tracesSampleRate: finalConfig.tracesSampleRate,
      profilesSampleRate: finalConfig.profilesSampleRate,
      debug: finalConfig.debug,
      integrations: [
        Sentry.httpIntegration(),
        Sentry.expressIntegration(),
      ],
      beforeSend(event, hint) {
        // Scrub sensitive data
        if (event.request && event.request.headers) {
          delete event.request.headers['authorization'];
          delete event.request.headers['x-api-key'];
        }
        return event;
      },
    });

    isInitialized = true;
    console.log(`[SENTRY] Error tracking initialized`);
    console.log(`[SENTRY] Environment: ${finalConfig.environment}`);
    console.log(`[SENTRY] Release: llmux@${finalConfig.release}`);

    return true;
  } catch (error) {
    console.error('[SENTRY] Failed to initialize:', error.message);
    return false;
  }
}

/**
 * Capture an exception
 * @param {Error} error - The error to capture
 * @param {Object} [context] - Additional context
 */
function captureException(error, context = {}) {
  if (!isInitialized || !Sentry) {
    console.error('[ERROR]', error.message);
    return;
  }

  Sentry.withScope((scope) => {
    if (context.provider) {
      scope.setTag('provider', context.provider);
    }
    if (context.model) {
      scope.setTag('model', context.model);
    }
    if (context.operation) {
      scope.setTag('operation', context.operation);
    }
    if (context.requestId) {
      scope.setTag('request_id', context.requestId);
    }
    if (context.extra) {
      scope.setExtras(context.extra);
    }
    if (context.user) {
      scope.setUser({
        id: context.user.id,
        // Don't send PII
      });
    }

    Sentry.captureException(error);
  });
}

/**
 * Capture a message
 * @param {string} message - The message to capture
 * @param {string} [level] - Severity level (info, warning, error)
 * @param {Object} [context] - Additional context
 */
function captureMessage(message, level = 'info', context = {}) {
  if (!isInitialized || !Sentry) {
    console.log(`[${level.toUpperCase()}]`, message);
    return;
  }

  Sentry.withScope((scope) => {
    scope.setLevel(level);
    if (context.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }
    if (context.extra) {
      scope.setExtras(context.extra);
    }
    Sentry.captureMessage(message);
  });
}

/**
 * Set user context
 * @param {Object} user - User information
 */
function setUser(user) {
  if (!isInitialized || !Sentry) return;

  Sentry.setUser({
    id: user.id,
    // Don't include PII like email or username
  });
}

/**
 * Clear user context
 */
function clearUser() {
  if (!isInitialized || !Sentry) return;
  Sentry.setUser(null);
}

/**
 * Add breadcrumb for debugging
 * @param {Object} breadcrumb - Breadcrumb data
 */
function addBreadcrumb(breadcrumb) {
  if (!isInitialized || !Sentry) return;

  Sentry.addBreadcrumb({
    category: breadcrumb.category || 'llmux',
    message: breadcrumb.message,
    level: breadcrumb.level || 'info',
    data: breadcrumb.data,
  });
}

/**
 * Start a transaction for performance monitoring
 * @param {string} name - Transaction name
 * @param {string} op - Operation type
 * @returns {Object|null} Transaction object
 */
function startTransaction(name, op) {
  if (!isInitialized || !Sentry) return null;

  return Sentry.startSpan({
    name,
    op,
  }, (span) => span);
}

/**
 * Express error handler middleware
 * @returns {Function} Express error handler
 */
function sentryErrorHandler() {
  if (!isInitialized || !Sentry) {
    return (err, req, res, next) => {
      console.error('[ERROR]', err.message);
      next(err);
    };
  }

  return Sentry.expressErrorHandler();
}

/**
 * Express request handler middleware
 * @returns {Function} Express request handler
 */
function sentryRequestHandler() {
  if (!isInitialized || !Sentry) {
    return (req, res, next) => next();
  }

  return Sentry.expressIntegration().setupOnce;
}

/**
 * Flush pending events before shutdown
 * @param {number} [timeout] - Timeout in milliseconds
 * @returns {Promise<boolean>}
 */
async function flush(timeout = 2000) {
  if (!isInitialized || !Sentry) return true;

  try {
    await Sentry.flush(timeout);
    return true;
  } catch (error) {
    console.error('[SENTRY] Flush failed:', error.message);
    return false;
  }
}

/**
 * Check if Sentry is enabled and initialized
 * @returns {boolean}
 */
function isSentryEnabled() {
  return isInitialized;
}

/**
 * Get Sentry configuration
 * @returns {Object}
 */
function getSentryConfig() {
  return {
    enabled: isInitialized,
    environment: DEFAULT_CONFIG.environment,
    release: DEFAULT_CONFIG.release,
  };
}

module.exports = {
  initializeSentry,
  captureException,
  captureMessage,
  setUser,
  clearUser,
  addBreadcrumb,
  startTransaction,
  sentryErrorHandler,
  sentryRequestHandler,
  flush,
  isSentryEnabled,
  getSentryConfig,
  DEFAULT_CONFIG,
};
