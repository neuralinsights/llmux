/**
 * LLMux - Weighted Load Balancing Router
 * Selects providers based on configured weights
 */

const { getProvider, getAvailableProviders } = require('../providers');
const { PROVIDER_CONFIG } = require('../config/providers');

/**
 * Select a provider using weighted random selection
 * @returns {string|null} Selected provider name or null if none available
 */
function selectProviderWeighted() {
  const availableProviders = getAvailableProviders();

  if (availableProviders.length === 0) {
    return null;
  }

  // Build weighted list from available providers
  const weighted = availableProviders.map((provider) => ({
    name: provider.name,
    weight: provider.config.weight,
  }));

  const totalWeight = weighted.reduce((sum, p) => sum + p.weight, 0);
  let random = Math.random() * totalWeight;

  for (const provider of weighted) {
    random -= provider.weight;
    if (random <= 0) {
      return provider.name;
    }
  }

  // Fallback to first available
  return weighted[0].name;
}

/**
 * Get weighted selection statistics
 * @returns {Object} Stats including expected vs actual distribution
 */
function getWeightedStats() {
  const stats = {
    providers: {},
    totalWeight: 0,
  };

  for (const [name, config] of Object.entries(PROVIDER_CONFIG)) {
    const provider = getProvider(name);
    const available = provider.isAvailable();

    stats.providers[name] = {
      weight: config.weight,
      available,
      expectedPercentage: 0,
    };

    if (available) {
      stats.totalWeight += config.weight;
    }
  }

  // Calculate expected percentages based on available providers
  for (const [name, providerStats] of Object.entries(stats.providers)) {
    if (providerStats.available && stats.totalWeight > 0) {
      providerStats.expectedPercentage = (providerStats.weight / stats.totalWeight) * 100;
    }
  }

  return stats;
}

module.exports = {
  selectProviderWeighted,
  getWeightedStats,
};
