/**
 * LLMux - Providers Module Index
 * Factory function and exports for all providers
 */

const { BaseProvider, QuotaState } = require('./base');
const { ClaudeProvider } = require('./claude');
const { GeminiProvider } = require('./gemini');
const { CodexProvider } = require('./codex');
const { OllamaProvider } = require('./ollama');
const { PROVIDER_CONFIG, getProvidersByPriority } = require('../config/providers');

/**
 * Provider class registry
 */
const PROVIDER_CLASSES = {
  claude: ClaudeProvider,
  gemini: GeminiProvider,
  codex: CodexProvider,
  ollama: OllamaProvider,
};

/**
 * Provider instance cache (singleton per provider)
 */
const providerInstances = new Map();

/**
 * Get or create a provider instance
 * @param {string} name - Provider name
 * @returns {BaseProvider} Provider instance
 */
function getProvider(name) {
  const normalizedName = name.toLowerCase();

  if (!PROVIDER_CLASSES[normalizedName]) {
    throw new Error(`Unknown provider: ${name}`);
  }

  if (!providerInstances.has(normalizedName)) {
    const ProviderClass = PROVIDER_CLASSES[normalizedName];
    providerInstances.set(normalizedName, new ProviderClass());
  }

  return providerInstances.get(normalizedName);
}

/**
 * Get all available providers (not in cooldown)
 * @returns {Array<BaseProvider>} Available provider instances
 */
function getAvailableProviders() {
  return Object.keys(PROVIDER_CLASSES)
    .map((name) => getProvider(name))
    .filter((provider) => provider.isAvailable());
}

/**
 * Get providers sorted by priority
 * @returns {Array<BaseProvider>} Providers sorted by priority (lowest first)
 */
function getProvidersByPriorityOrder() {
  const priorityOrder = getProvidersByPriority();
  return priorityOrder.map((name) => getProvider(name));
}

/**
 * Reset all provider instances (for testing)
 */
function resetProviders() {
  providerInstances.clear();
}

/**
 * Get provider statistics for all providers
 * @returns {Object} Stats for each provider
 */
function getAllProviderStats() {
  const stats = {};
  for (const name of Object.keys(PROVIDER_CLASSES)) {
    const provider = getProvider(name);
    stats[name] = {
      available: provider.isAvailable(),
      quotaState: provider.quotaState.toJSON(),
      config: {
        weight: provider.config.weight,
        priority: provider.config.priority,
        supportsStream: provider.config.supportsStream,
      },
    };
  }
  return stats;
}

module.exports = {
  // Classes
  BaseProvider,
  QuotaState,
  ClaudeProvider,
  GeminiProvider,
  CodexProvider,
  OllamaProvider,

  // Factory functions
  getProvider,
  getAvailableProviders,
  getProvidersByPriorityOrder,
  resetProviders,
  getAllProviderStats,

  // Registry
  PROVIDER_CLASSES,
};
