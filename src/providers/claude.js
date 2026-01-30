/**
 * LLMux - Claude Provider
 * Claude CLI integration
 */

const { BaseProvider } = require('./base');
const { executeCLI, executeCLIStream } = require('../utils/cli');
const { withRetry } = require('../utils/retry');

/**
 * Claude provider implementation
 */
class ClaudeProvider extends BaseProvider {
  constructor() {
    super('claude');
  }

  /**
   * Call Claude (non-streaming)
   * @param {string} prompt - The prompt
   * @param {Object} options - Call options
   * @returns {Promise<{provider: string, model: string, response: string, duration: number}>}
   */
  async call(prompt, options = {}) {
    const modelId = options.model || this.getDefaultModel();
    const timeout = options.timeout || this.getTimeout('total');
    const retries = options.retries || 2;

    const args = [prompt, '--print', '--output-format', 'text', '--model', modelId];

    const result = await withRetry(
      () => executeCLI('claude', args, null, timeout),
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
   * Call Claude with streaming
   * @param {string} prompt - The prompt
   * @param {Object} options - Call options
   * @param {Function} onData - Callback for data chunks
   * @param {Function} onEnd - Callback when complete
   * @param {Function} onError - Callback for errors
   * @returns {ChildProcess}
   */
  callStream(prompt, options, onData, onEnd, onError) {
    const modelId = options.model || this.getDefaultModel();
    const timeout = options.timeout || this.getTimeout('total');

    const args = [prompt, '--print', '--output-format', 'text', '--model', modelId];

    this.quotaState.incrementRequestCount();

    return executeCLIStream('claude', args, timeout, onData, onEnd, onError);
  }
}

module.exports = { ClaudeProvider };
