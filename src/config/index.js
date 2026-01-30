/**
 * LLMux - Configuration Index
 * Re-exports all configuration modules
 */

const { env, validateConfig } = require('./env');
const { PROVIDER_CONFIG, getProvidersByPriority, getAllModels, parseModelName } = require('./providers');

module.exports = {
  env,
  validateConfig,
  PROVIDER_CONFIG,
  getProvidersByPriority,
  getAllModels,
  ollama: {
    enabled: true,
    weight: 5,
    defaultModel: 'qwen3:14b',
    secure: true, // [NEW] Trusted for PII
    models: {
      general: 'qwen3:14b',
      code: 'qwen3:14b-code',
    },
  },
  parseModelName,
};
