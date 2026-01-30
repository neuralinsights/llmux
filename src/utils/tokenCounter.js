/**
 * Token Counter Module
 * Provides accurate token counting for different LLM providers
 *
 * @module utils/tokenCounter
 */

const { encoding_for_model, get_encoding } = require('tiktoken');

// Cache encodings for performance
const encodingCache = new Map();

// Model to encoding mapping
const MODEL_ENCODINGS = {
  // OpenAI GPT-4 family
  'gpt-4': 'cl100k_base',
  'gpt-4-turbo': 'cl100k_base',
  'gpt-4o': 'o200k_base',
  'gpt-4o-mini': 'o200k_base',

  // OpenAI GPT-3.5 family
  'gpt-3.5-turbo': 'cl100k_base',
  'gpt-3.5': 'cl100k_base',

  // Claude models (use cl100k_base as approximation)
  'claude-3': 'cl100k_base',
  'claude-3.5': 'cl100k_base',
  'claude-3-opus': 'cl100k_base',
  'claude-3-sonnet': 'cl100k_base',
  'claude-3-haiku': 'cl100k_base',
  'claude-sonnet': 'cl100k_base',
  'claude-opus': 'cl100k_base',

  // Gemini models (use cl100k_base as approximation)
  'gemini': 'cl100k_base',
  'gemini-pro': 'cl100k_base',
  'gemini-1.5': 'cl100k_base',
  'gemini-2': 'cl100k_base',

  // Codex/Code models
  'codex': 'p50k_base',
  'code-davinci': 'p50k_base',

  // Default fallback
  'default': 'cl100k_base',
};

/**
 * Get encoding for a model
 * @param {string} model - Model name
 * @returns {object} tiktoken encoding
 */
function getEncoding(model) {
  // Check cache first
  if (encodingCache.has(model)) {
    return encodingCache.get(model);
  }

  // Find matching encoding
  let encodingName = MODEL_ENCODINGS.default;

  for (const [prefix, encoding] of Object.entries(MODEL_ENCODINGS)) {
    if (model.toLowerCase().startsWith(prefix.toLowerCase())) {
      encodingName = encoding;
      break;
    }
  }

  try {
    const encoding = get_encoding(encodingName);
    encodingCache.set(model, encoding);
    return encoding;
  } catch (error) {
    // Fallback to default encoding
    const fallbackEncoding = get_encoding('cl100k_base');
    encodingCache.set(model, fallbackEncoding);
    return fallbackEncoding;
  }
}

/**
 * Count tokens in text using tiktoken
 * @param {string} text - Text to count tokens for
 * @param {string} [model='gpt-4'] - Model name for encoding selection
 * @returns {number} Token count
 */
function countTokens(text, model = 'gpt-4') {
  if (!text || typeof text !== 'string') {
    return 0;
  }

  try {
    const encoding = getEncoding(model);
    const tokens = encoding.encode(text);
    return tokens.length;
  } catch (error) {
    // Fallback to crude estimate if tiktoken fails
    return Math.ceil(text.length / 4);
  }
}

/**
 * Count tokens for chat messages (OpenAI format)
 * @param {Array} messages - Array of message objects {role, content}
 * @param {string} [model='gpt-4'] - Model name
 * @returns {number} Total token count
 */
function countChatTokens(messages, model = 'gpt-4') {
  if (!Array.isArray(messages)) {
    return 0;
  }

  let totalTokens = 0;

  // Each message has overhead tokens
  const tokensPerMessage = model.includes('gpt-3.5') ? 4 : 3;
  const tokensPerName = model.includes('gpt-3.5') ? -1 : 1;

  for (const message of messages) {
    totalTokens += tokensPerMessage;

    if (message.role) {
      totalTokens += countTokens(message.role, model);
    }

    if (message.content) {
      totalTokens += countTokens(message.content, model);
    }

    if (message.name) {
      totalTokens += countTokens(message.name, model) + tokensPerName;
    }
  }

  // Every reply is primed with <|start|>assistant<|message|>
  totalTokens += 3;

  return totalTokens;
}

/**
 * Estimate tokens for prompt and completion (compatible with existing interface)
 * @param {string} prompt - Input prompt
 * @param {string} response - Output response
 * @param {string} [model='gpt-4'] - Model name
 * @returns {{prompt: number, completion: number, total: number}}
 */
function estimateTokens(prompt, response, model = 'gpt-4') {
  const promptTokens = countTokens(prompt, model);
  const completionTokens = countTokens(response, model);

  return {
    prompt: promptTokens,
    completion: completionTokens,
    total: promptTokens + completionTokens,
  };
}

/**
 * Estimate cost based on token counts
 * @param {number} promptTokens - Number of prompt tokens
 * @param {number} completionTokens - Number of completion tokens
 * @param {string} model - Model name
 * @returns {{promptCost: number, completionCost: number, totalCost: number}} Cost in USD
 */
function estimateCost(promptTokens, completionTokens, model) {
  // Pricing per 1M tokens (as of 2026)
  const PRICING = {
    // GPT-4o
    'gpt-4o': { prompt: 2.50, completion: 10.00 },
    'gpt-4o-mini': { prompt: 0.15, completion: 0.60 },

    // GPT-4
    'gpt-4': { prompt: 30.00, completion: 60.00 },
    'gpt-4-turbo': { prompt: 10.00, completion: 30.00 },

    // GPT-3.5
    'gpt-3.5-turbo': { prompt: 0.50, completion: 1.50 },

    // Claude
    'claude-3-opus': { prompt: 15.00, completion: 75.00 },
    'claude-3.5-sonnet': { prompt: 3.00, completion: 15.00 },
    'claude-3-sonnet': { prompt: 3.00, completion: 15.00 },
    'claude-3-haiku': { prompt: 0.25, completion: 1.25 },

    // Gemini
    'gemini-1.5-pro': { prompt: 1.25, completion: 5.00 },
    'gemini-1.5-flash': { prompt: 0.075, completion: 0.30 },
    'gemini-2.0-flash': { prompt: 0.10, completion: 0.40 },

    // Default (conservative estimate)
    'default': { prompt: 1.00, completion: 3.00 },
  };

  // Find matching pricing
  let pricing = PRICING.default;
  for (const [prefix, price] of Object.entries(PRICING)) {
    if (model.toLowerCase().includes(prefix.toLowerCase())) {
      pricing = price;
      break;
    }
  }

  const promptCost = (promptTokens / 1_000_000) * pricing.prompt;
  const completionCost = (completionTokens / 1_000_000) * pricing.completion;

  return {
    promptCost: parseFloat(promptCost.toFixed(6)),
    completionCost: parseFloat(completionCost.toFixed(6)),
    totalCost: parseFloat((promptCost + completionCost).toFixed(6)),
    currency: 'USD',
  };
}

/**
 * Truncate text to fit within token limit
 * @param {string} text - Text to truncate
 * @param {number} maxTokens - Maximum tokens allowed
 * @param {string} [model='gpt-4'] - Model name
 * @returns {{text: string, truncated: boolean, originalTokens: number, finalTokens: number}}
 */
function truncateToTokenLimit(text, maxTokens, model = 'gpt-4') {
  if (!text) {
    return { text: '', truncated: false, originalTokens: 0, finalTokens: 0 };
  }

  const originalTokens = countTokens(text, model);

  if (originalTokens <= maxTokens) {
    return { text, truncated: false, originalTokens, finalTokens: originalTokens };
  }

  // Binary search for optimal truncation point
  let low = 0;
  let high = text.length;
  let result = '';

  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2);
    const truncated = text.slice(0, mid);
    const tokens = countTokens(truncated, model);

    if (tokens <= maxTokens) {
      result = truncated;
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  return {
    text: result,
    truncated: true,
    originalTokens,
    finalTokens: countTokens(result, model),
  };
}

/**
 * Free cached encodings (for cleanup)
 */
function freeEncodings() {
  for (const encoding of encodingCache.values()) {
    encoding.free();
  }
  encodingCache.clear();
}

// Cleanup on process exit
process.on('exit', freeEncodings);

module.exports = {
  countTokens,
  countChatTokens,
  estimateTokens,
  estimateCost,
  truncateToTokenLimit,
  freeEncodings,
  MODEL_ENCODINGS,
};
