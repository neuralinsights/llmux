/**
 * LLMux - Provider Configuration
 * Defines all supported AI providers with their models, timeouts, and capabilities
 */

const PROVIDER_CONFIG = {
  claude: {
    models: {
      'opus-4.5': 'claude-opus-4-5',
      'sonnet-4': 'claude-sonnet-4',
      'haiku': 'claude-haiku-4',
    },
    defaultModel: 'claude-opus-4-5',
    quotaWindow: 5 * 60 * 60 * 1000, // 5 hours
    cooldownTime: 10 * 60 * 1000,    // 10 minutes
    priority: 1,
    weight: 50, // 50% traffic weight
    timeouts: {
      connect: 5000,
      firstByte: 30000,
      total: 120000,
    },
    strengths: ['reasoning', 'code review', 'complex analysis'],
    supportsStream: true,
  },

  gemini: {
    models: {
      '3-flash': 'gemini-3-flash-preview',
      '3-pro': 'gemini-3-pro-preview',
      '2.0-flash': 'gemini-2.0-flash',
    },
    defaultModel: 'gemini-3-flash-preview',
    quotaWindow: 60 * 60 * 1000,  // 1 hour
    cooldownTime: 5 * 60 * 1000,  // 5 minutes
    priority: 2,
    weight: 30, // 30% traffic weight
    timeouts: {
      connect: 5000,
      firstByte: 15000,
      total: 60000,
    },
    strengths: ['multimodal', '1M context', 'agent capabilities'],
    supportsStream: true,
  },

  codex: {
    models: {
      '5.2': 'gpt-5.2-codex',
      '5.1-max': 'gpt-5.1-codex-max',
      '5.1-mini': 'gpt-5.1-codex-mini',
    },
    defaultModel: 'gpt-5.2-codex',
    quotaWindow: 5 * 60 * 60 * 1000, // 5 hours
    cooldownTime: 10 * 60 * 1000,    // 10 minutes
    priority: 3,
    weight: 15, // 15% traffic weight
    timeouts: {
      connect: 5000,
      firstByte: 20000,
      total: 90000,
    },
    strengths: ['code generation', 'tool calling', 'API integration'],
    supportsStream: false,
  },

  ollama: {
    models: {
      'qwen3:14b': 'qwen3:14b',
      'qwen2.5:0.5b': 'qwen2.5:0.5b',
      'nomic-embed-text': 'nomic-embed-text',
    },
    defaultModel: 'qwen3:14b',
    quotaWindow: 0,     // No quota
    cooldownTime: 0,    // No cooldown
    priority: 4,
    weight: 5, // 5% fallback
    timeouts: {
      connect: 2000,
      firstByte: 5000,
      total: 30000,
    },
    strengths: ['local privacy', 'unlimited quota', 'offline capable'],
    supportsStream: true,
  },
};

/**
 * Get provider names sorted by priority
 * @returns {string[]} Array of provider names
 */
function getProvidersByPriority() {
  return Object.entries(PROVIDER_CONFIG)
    .sort((a, b) => a[1].priority - b[1].priority)
    .map(([name]) => name);
}

/**
 * Get all available models across all providers
 * @returns {Array<{name: string, provider: string, alias: string, default: boolean, supportsStream: boolean}>}
 */
function getAllModels() {
  const models = [];

  for (const [provider, config] of Object.entries(PROVIDER_CONFIG)) {
    for (const [alias, fullName] of Object.entries(config.models)) {
      models.push({
        name: fullName,
        provider: provider,
        alias: alias,
        description: config.strengths.join(', '),
        default: fullName === config.defaultModel,
        supportsStream: config.supportsStream,
        weight: config.weight,
      });
    }
  }

  return models;
}

/**
 * Parse model name to determine provider
 * @param {string} model - Model name or alias
 * @returns {{provider: string, model: string}} Provider and resolved model name
 */
function parseModelName(model) {
  if (!model) {
    return { provider: null, model: null };
  }

  const modelLower = model.toLowerCase();

  // Claude models
  if (modelLower.includes('claude') || modelLower.includes('opus') ||
      modelLower.includes('sonnet') || modelLower.includes('haiku')) {
    let resolvedModel = 'claude-opus-4-5';
    if (modelLower.includes('sonnet')) {
      resolvedModel = 'claude-sonnet-4';
    } else if (modelLower.includes('haiku')) {
      resolvedModel = 'claude-haiku-4';
    }
    return { provider: 'claude', model: resolvedModel };
  }

  // Gemini models
  if (modelLower.includes('gemini')) {
    const resolvedModel = modelLower.includes('pro')
      ? 'gemini-3-pro-preview'
      : 'gemini-3-flash-preview';
    return { provider: 'gemini', model: resolvedModel };
  }

  // Codex/GPT models
  if (modelLower.includes('gpt') || modelLower.includes('codex')) {
    const resolvedModel = modelLower.includes('mini')
      ? 'gpt-5.1-codex-mini'
      : 'gpt-5.2-codex';
    return { provider: 'codex', model: resolvedModel };
  }

  // Ollama/Qwen models
  if (modelLower.includes('qwen') || modelLower.includes('ollama')) {
    const resolvedModel = modelLower.includes('0.5b')
      ? 'qwen2.5:0.5b'
      : 'qwen3:14b';
    return { provider: 'ollama', model: resolvedModel };
  }

  return { provider: null, model: null };
}

module.exports = {
  PROVIDER_CONFIG,
  getProvidersByPriority,
  getAllModels,
  parseModelName,
};
