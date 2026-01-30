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
  generateRequestSchema,
  chatCompletionSchema,
  chatMessageSchema,
  formatZodError,
} = require('./validation');

const {
  createSanitizer,
  sanitizer,
  analyzePrompt,
  SUSPICIOUS_PATTERNS,
  BLOCKED_PATTERNS,
} = require('./sanitizer');

const {
  createApiLimiter,
  createAuthLimiter,
  createBurstLimiter,
  createTieredLimiter,
  apiLimiter,
} = require('./rateLimit');

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
  generateRequestSchema,
  chatCompletionSchema,
  chatMessageSchema,
  formatZodError,

  // Sanitization (OWASP LLM01)
  createSanitizer,
  sanitizer,
  analyzePrompt,
  SUSPICIOUS_PATTERNS,
  BLOCKED_PATTERNS,

  // Rate Limiting
  createApiLimiter,
  createAuthLimiter,
  createBurstLimiter,
  createTieredLimiter,
  apiLimiter,
};
