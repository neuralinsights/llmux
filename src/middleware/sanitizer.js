/**
 * LLMux - Prompt Sanitizer Middleware
 * Protection against prompt injection attacks (OWASP LLM01)
 *
 * @see https://owasp.org/www-project-top-10-for-large-language-model-applications/
 */

/**
 * Suspicious patterns that may indicate prompt injection attempts
 * These patterns are logged but not blocked to avoid false positives
 */
const SUSPICIOUS_PATTERNS = [
  // Direct instruction override attempts
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/i,
  /forget\s+(everything|all|your)\s+(you|instructions?|training)/i,
  /disregard\s+(all\s+)?(previous|prior|your)\s+(instructions?|rules?)/i,

  // Role manipulation
  /you\s+are\s+(now|no\s+longer)\s+(a|an|the)/i,
  /pretend\s+(you\s+are|to\s+be)\s+(a|an|the)/i,
  /act\s+as\s+(if\s+you\s+are\s+)?(a|an|the)/i,
  /simulate\s+(being|a|an)/i,

  // System prompt extraction
  /what\s+(is|are)\s+your\s+(system\s+)?(prompt|instructions?|rules?)/i,
  /show\s+(me\s+)?(your|the)\s+(system\s+)?(prompt|instructions?)/i,
  /reveal\s+(your|the)\s+(system\s+)?(prompt|instructions?)/i,
  /print\s+(your|the)\s+(system\s+)?(prompt|instructions?)/i,

  // Jailbreak patterns
  /\bDAN\b/,  // "Do Anything Now"
  /\bAIM\b.*\bMachiavelli/i,  // AIM jailbreak
  /developer\s+mode/i,
  /jailbreak/i,
  /bypass\s+(the\s+)?(filter|safety|restrictions?)/i,

  // Code injection attempts
  /```\s*(system|bash|sh|python|javascript|eval)/i,
  /<script[\s>]/i,
  /\$\{.*\}/,  // Template injection
  /\{\{.*\}\}/,  // Template injection

  // Delimiter injection
  /###\s*(system|instruction|end)/i,
  /\[INST\]/i,
  /<\|system\|>/i,
  /<\|user\|>/i,
  /<\|assistant\|>/i,
];

/**
 * High-risk patterns that should be blocked
 */
const BLOCKED_PATTERNS = [
  // Malicious code execution
  /eval\s*\(/i,
  /exec\s*\(/i,
  /spawn\s*\(/i,
  /child_process/i,
  /require\s*\(\s*['"`]child_process/i,
  /require\s*\(\s*['"`]fs['"`]\s*\)/i,

  // Credential extraction
  /process\.env\./i,
  /\.env\s+file/i,
  /api[_\-\s]?key/i,
  /secret[_\-\s]?key/i,
  /password\s*[:=]/i,
  /bearer\s+token/i,

  // File system access
  /\/etc\/passwd/i,
  /\/etc\/shadow/i,
  /\.ssh\/id_rsa/i,
  /\.aws\/credentials/i,
];

/**
 * Sanitizer configuration
 */
const DEFAULT_CONFIG = {
  logSuspicious: true,
  blockHighRisk: true,
  maxPromptLength: 100000,
  stripControlChars: true,
  normalizeWhitespace: false,
};

/**
 * Strip control characters from text
 * @param {string} text - Input text
 * @returns {string} Sanitized text
 */
function stripControlChars(text) {
  // Keep common whitespace (tab, newline, carriage return)
  // Remove other control characters (0x00-0x08, 0x0B-0x0C, 0x0E-0x1F, 0x7F)
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Check text against pattern list
 * @param {string} text - Text to check
 * @param {RegExp[]} patterns - Patterns to match
 * @returns {string[]} Matched pattern descriptions
 */
function checkPatterns(text, patterns) {
  const matches = [];
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      matches.push(pattern.source.slice(0, 50));
    }
  }
  return matches;
}

/**
 * Analyze prompt for potential injection attempts
 * @param {string} prompt - Prompt to analyze
 * @returns {{safe: boolean, suspicious: string[], blocked: string[], sanitized: string}}
 */
function analyzePrompt(prompt, config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  let sanitized = prompt;

  // Strip control characters if enabled
  if (cfg.stripControlChars) {
    sanitized = stripControlChars(sanitized);
  }

  // Check for blocked patterns
  const blocked = checkPatterns(sanitized, BLOCKED_PATTERNS);
  if (blocked.length > 0 && cfg.blockHighRisk) {
    return {
      safe: false,
      suspicious: [],
      blocked,
      sanitized,
      reason: 'HIGH_RISK_PATTERN_DETECTED',
    };
  }

  // Check for suspicious patterns
  const suspicious = checkPatterns(sanitized, SUSPICIOUS_PATTERNS);

  return {
    safe: true,
    suspicious,
    blocked: [],
    sanitized,
    reason: null,
  };
}

/**
 * Create prompt sanitizer middleware
 * @param {Object} config - Sanitizer configuration
 * @returns {Function} Express middleware
 */
function createSanitizer(config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  return (req, res, next) => {
    // Extract prompt from request body
    const prompt = req.body?.prompt;
    const messages = req.body?.messages;

    // Skip if no prompt content
    if (!prompt && !messages) {
      return next();
    }

    // Analyze main prompt
    if (prompt) {
      const analysis = analyzePrompt(prompt, cfg);

      if (!analysis.safe) {
        console.warn(
          `[SECURITY] Blocked prompt injection attempt: ${analysis.blocked.join(', ')}`
        );
        return res.status(400).json({
          error: 'Prompt contains potentially harmful content',
          code: 'PROMPT_INJECTION_BLOCKED',
          details: cfg.logSuspicious ? analysis.blocked : undefined,
        });
      }

      if (analysis.suspicious.length > 0 && cfg.logSuspicious) {
        console.warn(
          `[SECURITY] Suspicious prompt patterns detected: ${analysis.suspicious.join(', ')}`
        );
        // Log but don't block
        req.promptAnalysis = analysis;
      }

      // Replace with sanitized version
      req.body.prompt = analysis.sanitized;
    }

    // Analyze chat messages
    if (messages && Array.isArray(messages)) {
      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        if (msg.content) {
          const analysis = analyzePrompt(msg.content, cfg);

          if (!analysis.safe) {
            console.warn(
              `[SECURITY] Blocked prompt injection in message[${i}]: ${analysis.blocked.join(', ')}`
            );
            return res.status(400).json({
              error: {
                message: `Message ${i} contains potentially harmful content`,
                type: 'invalid_request_error',
                code: 'prompt_injection_blocked',
              },
            });
          }

          if (analysis.suspicious.length > 0 && cfg.logSuspicious) {
            console.warn(
              `[SECURITY] Suspicious patterns in message[${i}]: ${analysis.suspicious.join(', ')}`
            );
          }

          // Replace with sanitized version
          messages[i].content = analysis.sanitized;
        }
      }
    }

    next();
  };
}

/**
 * Default sanitizer middleware instance
 */
const sanitizer = createSanitizer();

module.exports = {
  createSanitizer,
  sanitizer,
  analyzePrompt,
  stripControlChars,
  SUSPICIOUS_PATTERNS,
  BLOCKED_PATTERNS,
  DEFAULT_CONFIG,
};
