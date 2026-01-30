/**
 * LLMux - Request Validation Middleware
 * Input validation for API endpoints
 */

const { PROVIDER_CONFIG, parseModelName } = require('../config/providers');

/**
 * Validate generate request body
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
function validateGenerateRequest(req, res, next) {
  const { prompt, provider, model, stream, options } = req.body;

  // Prompt is required
  if (!prompt) {
    return res.status(400).json({
      error: 'prompt is required',
      code: 'MISSING_PROMPT',
    });
  }

  // Validate prompt type
  if (typeof prompt !== 'string') {
    return res.status(400).json({
      error: 'prompt must be a string',
      code: 'INVALID_PROMPT_TYPE',
    });
  }

  // Validate prompt length (max 100KB)
  if (prompt.length > 100000) {
    return res.status(400).json({
      error: 'prompt exceeds maximum length of 100000 characters',
      code: 'PROMPT_TOO_LONG',
    });
  }

  // Validate provider if specified
  if (provider && !PROVIDER_CONFIG[provider]) {
    return res.status(400).json({
      error: `Unknown provider: ${provider}. Valid providers: ${Object.keys(PROVIDER_CONFIG).join(', ')}`,
      code: 'INVALID_PROVIDER',
    });
  }

  // Validate stream parameter
  if (stream !== undefined && typeof stream !== 'boolean') {
    return res.status(400).json({
      error: 'stream must be a boolean',
      code: 'INVALID_STREAM_TYPE',
    });
  }

  // Validate options if provided
  if (options) {
    if (typeof options !== 'object' || Array.isArray(options)) {
      return res.status(400).json({
        error: 'options must be an object',
        code: 'INVALID_OPTIONS_TYPE',
      });
    }

    // Validate specific options
    if (options.temperature !== undefined) {
      if (typeof options.temperature !== 'number' || options.temperature < 0 || options.temperature > 2) {
        return res.status(400).json({
          error: 'temperature must be a number between 0 and 2',
          code: 'INVALID_TEMPERATURE',
        });
      }
    }

    if (options.maxTokens !== undefined) {
      if (typeof options.maxTokens !== 'number' || options.maxTokens < 1 || options.maxTokens > 100000) {
        return res.status(400).json({
          error: 'maxTokens must be a number between 1 and 100000',
          code: 'INVALID_MAX_TOKENS',
        });
      }
    }

    if (options.timeout !== undefined) {
      if (typeof options.timeout !== 'number' || options.timeout < 1000 || options.timeout > 600000) {
        return res.status(400).json({
          error: 'timeout must be a number between 1000 and 600000 (ms)',
          code: 'INVALID_TIMEOUT',
        });
      }
    }
  }

  next();
}

/**
 * Validate OpenAI-compatible chat completion request
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
function validateChatCompletionRequest(req, res, next) {
  const { model, messages, stream } = req.body;

  // Model is required for OpenAI compatibility
  if (!model) {
    return res.status(400).json({
      error: {
        message: 'model is required',
        type: 'invalid_request_error',
        code: 'model_required',
      },
    });
  }

  // Messages are required
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      error: {
        message: 'messages must be a non-empty array',
        type: 'invalid_request_error',
        code: 'messages_required',
      },
    });
  }

  // Validate each message
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    if (!msg.role || !['system', 'user', 'assistant'].includes(msg.role)) {
      return res.status(400).json({
        error: {
          message: `messages[${i}].role must be one of: system, user, assistant`,
          type: 'invalid_request_error',
          code: 'invalid_role',
        },
      });
    }

    if (typeof msg.content !== 'string') {
      return res.status(400).json({
        error: {
          message: `messages[${i}].content must be a string`,
          type: 'invalid_request_error',
          code: 'invalid_content',
        },
      });
    }
  }

  // Validate stream parameter
  if (stream !== undefined && typeof stream !== 'boolean') {
    return res.status(400).json({
      error: {
        message: 'stream must be a boolean',
        type: 'invalid_request_error',
        code: 'invalid_stream',
      },
    });
  }

  // Parse and validate model name
  try {
    const parsed = parseModelName(model);
    req.parsedModel = parsed;
  } catch (e) {
    // Model parsing failed, but we'll handle unknown models gracefully
    req.parsedModel = { provider: null, model: model };
  }

  next();
}

/**
 * Request body size limiter middleware factory
 * @param {number} maxSize - Maximum body size in bytes
 * @returns {Function} Express middleware
 */
function bodySizeLimiter(maxSize = 1024 * 1024) {
  return (req, res, next) => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);

    if (contentLength > maxSize) {
      return res.status(413).json({
        error: `Request body too large. Maximum size: ${maxSize} bytes`,
        code: 'BODY_TOO_LARGE',
      });
    }

    next();
  };
}

module.exports = {
  validateGenerateRequest,
  validateChatCompletionRequest,
  bodySizeLimiter,
};
