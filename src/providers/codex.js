/**
 * LLMux - Codex Provider
 * Codex CLI integration
 */

const { BaseProvider } = require('./base');
const { executeCLI } = require('../utils/cli');
const { withRetry } = require('../utils/retry');
const { env } = require('../config/env');

/**
 * Codex provider implementation
 * Note: Codex does not support streaming
 */
class CodexProvider extends BaseProvider {
  constructor() {
    super('codex');
  }

  /**
   * Call Codex (non-streaming only)
   * @param {string} prompt - The prompt
   * @param {Object} options - Call options
   * @returns {Promise<{provider: string, model: string, response: string, duration: number}>}
   */
  async call(prompt, options = {}) {
    const modelId = options.model || this.getDefaultModel();
    const timeout = options.timeout || this.getTimeout('total');
    const retries = options.retries || 2;

    const args = [
      'exec',
      prompt,
      '--dangerously-bypass-approvals-and-sandbox',
      '--skip-git-repo-check',
      '-m',
      modelId,
    ];

    // Support OSS mode
    if (options.useOss || env.CODEX_USE_OSS) {
      args.push('--oss');
    }

    const result = await withRetry(
      () => executeCLI('codex', args, null, timeout),
      { maxRetries: retries }
    );

    this.quotaState.incrementRequestCount();

    return {
      provider: this.name,
      model: modelId,
      response: result.output,
      duration: result.duration,
    };
  }

  /**
   * Codex does not support streaming
   * @throws {Error} Always throws - streaming not supported
   */
  callStream() {
    throw new Error('Codex provider does not support streaming');
  }

  /**
   * Override supportsStreaming to return false
   * @returns {boolean} Always false for Codex
   */
  supportsStreaming() {
    return false;
  }
}

module.exports = { CodexProvider };
