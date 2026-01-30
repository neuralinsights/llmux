/**
 * LLMux - Utilities Index
 * Re-exports all utility modules
 */

const { sleep, isQuotaError, isRetryableError, withRetry, createRetryWrapper } = require('./retry');
const { executeCLI, executeCLIStream, isCommandAvailable } = require('./cli');
const {
  countTokens,
  countChatTokens,
  estimateTokens,
  estimateCost,
  truncateToTokenLimit,
  freeEncodings,
  MODEL_ENCODINGS,
} = require('./tokenCounter');

module.exports = {
  // Retry utilities
  sleep,
  isQuotaError,
  isRetryableError,
  withRetry,
  createRetryWrapper,

  // CLI utilities
  executeCLI,
  executeCLIStream,
  isCommandAvailable,

  // Token counting utilities
  countTokens,
  countChatTokens,
  estimateTokens,
  estimateCost,
  truncateToTokenLimit,
  freeEncodings,
  MODEL_ENCODINGS,
};
