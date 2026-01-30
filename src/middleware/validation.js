/**
 * LLMux - Request Validation Middleware
 * Type-safe input validation using Zod schemas
 */

const { z } = require('zod');
const { PROVIDER_CONFIG, parseModelName } = require('../config/providers');

// ============ Zod Schemas ============

/**
 * Valid provider names (dynamic from config)
 */
const validProviders = Object.keys(PROVIDER_CONFIG);

/**
 * Generate request schema
 */
const generateRequestSchema = z.object({
  prompt: z
    .string({
      required_error: 'prompt is required',
      invalid_type_error: 'prompt must be a string',
    })
    .min(1, 'prompt cannot be empty')
    .max(100000, 'prompt exceeds maximum length of 100000 characters'),

  provider: z
    .enum(validProviders, {
      errorMap: () => ({
        message: `Unknown provider. Valid providers: ${validProviders.join(', ')}`,
      }),
    })
    .optional(),

  model: z.string().optional(),

  stream: z.boolean({ invalid_type_error: 'stream must be a boolean' }).optional(),

  options: z
    .object({
      temperature: z
        .number({ invalid_type_error: 'temperature must be a number' })
        .min(0, 'temperature must be at least 0')
        .max(2, 'temperature must be at most 2')
        .optional(),
      maxTokens: z
        .number({ invalid_type_error: 'maxTokens must be a number' })
        .int('maxTokens must be an integer')
        .min(1, 'maxTokens must be at least 1')
        .max(100000, 'maxTokens must be at most 100000')
        .optional(),
      timeout: z
        .number({ invalid_type_error: 'timeout must be a number' })
        .int('timeout must be an integer')
        .min(1000, 'timeout must be at least 1000ms')
        .max(600000, 'timeout must be at most 600000ms (10 minutes)')
        .optional(),
      topP: z
        .number({ invalid_type_error: 'topP must be a number' })
        .min(0, 'topP must be at least 0')
        .max(1, 'topP must be at most 1')
        .optional(),
      topK: z
        .number({ invalid_type_error: 'topK must be a number' })
        .int('topK must be an integer')
        .min(1, 'topK must be at least 1')
        .optional(),
      stopSequences: z.array(z.string()).max(10, 'stopSequences can have at most 10 items').optional(),
    })
    .strict()
    .optional(),
}).strict();

/**
 * Chat message schema (OpenAI compatible)
 */
const chatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant'], {
    errorMap: () => ({ message: 'role must be one of: system, user, assistant' }),
  }),
  content: z.string({
    required_error: 'content is required',
    invalid_type_error: 'content must be a string',
  }),
  name: z.string().max(64).optional(),
});

/**
 * Chat completion request schema (OpenAI compatible)
 */
const chatCompletionSchema = z.object({
  model: z.string({
    required_error: 'model is required',
    invalid_type_error: 'model must be a string',
  }),

  messages: z
    .array(chatMessageSchema, {
      required_error: 'messages is required',
      invalid_type_error: 'messages must be an array',
    })
    .min(1, 'messages must contain at least one message')
    .max(1000, 'messages can have at most 1000 items'),

  stream: z.boolean({ invalid_type_error: 'stream must be a boolean' }).optional(),

  temperature: z
    .number({ invalid_type_error: 'temperature must be a number' })
    .min(0)
    .max(2)
    .optional(),

  max_tokens: z
    .number({ invalid_type_error: 'max_tokens must be a number' })
    .int()
    .min(1)
    .max(100000)
    .optional(),

  top_p: z.number().min(0).max(1).optional(),

  frequency_penalty: z.number().min(-2).max(2).optional(),

  presence_penalty: z.number().min(-2).max(2).optional(),

  stop: z.union([z.string(), z.array(z.string()).max(4)]).optional(),

  user: z.string().max(256).optional(),
});

// ============ Error Formatting ============

/**
 * Format Zod error to LLMux error response
 * @param {z.ZodError} error - Zod validation error
 * @param {string} format - Response format ('llmux' or 'openai')
 * @returns {Object} Formatted error response
 */
function formatZodError(error, format = 'llmux') {
  const firstIssue = error.issues[0];
  const path = firstIssue.path.join('.');
  const message = path ? `${path}: ${firstIssue.message}` : firstIssue.message;

  if (format === 'openai') {
    return {
      error: {
        message: message,
        type: 'invalid_request_error',
        code: firstIssue.code,
        param: path || null,
      },
    };
  }

  // LLMux format
  return {
    error: message,
    code: mapZodCodeToLLMuxCode(firstIssue),
    details: error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    })),
  };
}

/**
 * Map Zod error code to LLMux error code
 * @param {Object} issue - Zod issue
 * @returns {string} LLMux error code
 */
function mapZodCodeToLLMuxCode(issue) {
  const path = issue.path[0] || 'unknown';

  // Zod 4.x: check for missing required field via message content
  // (received property is not directly exposed in issue object)
  if (issue.code === 'invalid_type' && issue.message?.includes('received undefined')) {
    return `MISSING_${path.toUpperCase()}`;
  }

  if (issue.code === 'too_small' && path === 'prompt') {
    return 'EMPTY_PROMPT';
  }

  if (issue.code === 'too_big') {
    return `${path.toUpperCase()}_TOO_LONG`;
  }

  if (issue.code === 'invalid_enum_value') {
    return `INVALID_${path.toUpperCase()}`;
  }

  return `INVALID_${path.toUpperCase()}`;
}

// ============ Middleware Functions ============

/**
 * Validate generate request body
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
function validateGenerateRequest(req, res, next) {
  const result = generateRequestSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json(formatZodError(result.error, 'llmux'));
  }

  // Store validated data
  req.validatedBody = result.data;
  next();
}

/**
 * Validate OpenAI-compatible chat completion request
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
function validateChatCompletionRequest(req, res, next) {
  const result = chatCompletionSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json(formatZodError(result.error, 'openai'));
  }

  // Store validated data
  req.validatedBody = result.data;

  // Parse and validate model name
  try {
    const parsed = parseModelName(result.data.model);
    req.parsedModel = parsed;
  } catch (e) {
    // Model parsing failed, but we'll handle unknown models gracefully
    req.parsedModel = { provider: null, model: result.data.model };
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

// ============ Exports ============

module.exports = {
  // Middleware
  validateGenerateRequest,
  validateChatCompletionRequest,
  bodySizeLimiter,

  // Schemas (for external use/testing)
  generateRequestSchema,
  chatCompletionSchema,
  chatMessageSchema,

  // Utilities
  formatZodError,
};
