/**
 * LLMux - Environment Configuration
 * Centralized environment variable parsing and defaults
 */

const env = {
  // Server Configuration
  PORT: parseInt(process.env.PORT) || 8765,
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Request Configuration
  REQUEST_TIMEOUT: parseInt(process.env.REQUEST_TIMEOUT) || 120000,
  DEFAULT_PROVIDER: process.env.DEFAULT_PROVIDER || 'claude',

  // Ollama Configuration
  OLLAMA_HOST: process.env.OLLAMA_HOST || 'http://127.0.0.1:11434',

  // Authentication
  API_KEY_REQUIRED: process.env.API_KEY_REQUIRED === 'true',
  API_KEY: process.env.API_KEY || null,
  ADMIN_KEY: process.env.ADMIN_KEY || null,

  // Cache Configuration
  CACHE_TTL: parseInt(process.env.CACHE_TTL) || 3600000, // 1 hour
  CACHE_MAX_SIZE: parseInt(process.env.CACHE_MAX_SIZE) || 1000,
  CACHE_BACKEND: process.env.CACHE_BACKEND || 'memory', // memory | redis
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

  // Codex Configuration
  CODEX_USE_OSS: process.env.CODEX_USE_OSS === 'true',

  // CORS Configuration
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  CORS_WHITELIST: process.env.CORS_WHITELIST
    ? process.env.CORS_WHITELIST.split(',').map(s => s.trim())
    : null,

  // Rate Limiting (future)
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000, // 1 minute
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  LOG_DIR: process.env.LOG_DIR || 'logs',
};

// Validate critical configuration
function validateConfig() {
  const errors = [];

  if (env.PORT < 1 || env.PORT > 65535) {
    errors.push(`Invalid PORT: ${env.PORT}`);
  }

  if (env.REQUEST_TIMEOUT < 1000) {
    errors.push(`REQUEST_TIMEOUT too low: ${env.REQUEST_TIMEOUT}ms (minimum 1000ms)`);
  }

  if (env.CACHE_TTL < 0) {
    errors.push(`Invalid CACHE_TTL: ${env.CACHE_TTL}`);
  }

  if (env.CACHE_MAX_SIZE < 1) {
    errors.push(`Invalid CACHE_MAX_SIZE: ${env.CACHE_MAX_SIZE}`);
  }

  const validProviders = ['claude', 'gemini', 'codex', 'ollama'];
  if (!validProviders.includes(env.DEFAULT_PROVIDER)) {
    errors.push(`Invalid DEFAULT_PROVIDER: ${env.DEFAULT_PROVIDER}. Must be one of: ${validProviders.join(', ')}`);
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

// Run validation on load
validateConfig();

module.exports = { env, validateConfig };
