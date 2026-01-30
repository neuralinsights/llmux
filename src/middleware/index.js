/**
 * LLMux - Middleware Module Index
 * Exports all middleware functions
 */

const {
  authMiddleware,
  adminAuthMiddleware,
  generateApiKey,
  listApiKeys,
  deleteApiKey,
  hasApiKey,
  getApiKeyInfo,
  API_KEYS,
  PUBLIC_ENDPOINTS,
} = require('./auth');

const {
  validateGenerateRequest,
  validateChatCompletionRequest,
  bodySizeLimiter,
} = require('./validation');

module.exports = {
  // Authentication
  authMiddleware,
  adminAuthMiddleware,
  generateApiKey,
  listApiKeys,
  deleteApiKey,
  hasApiKey,
  getApiKeyInfo,
  API_KEYS,
  PUBLIC_ENDPOINTS,

  // Validation
  validateGenerateRequest,
  validateChatCompletionRequest,
  bodySizeLimiter,
};
