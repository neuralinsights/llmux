/**
 * LLMux - Gemini Provider
 * Gemini CLI integration
 */

const { BaseProvider } = require('./base');
const { executeCLI, executeCLIStream } = require('../utils/cli');
const { withRetry } = require('../utils/retry');

/**
 * Gemini provider implementation
 */
class GeminiProvider extends BaseProvider {
  constructor() {
    super('gemini');
  }

  /**
   * Call Gemini (non-streaming)
   * @param {string} prompt - The prompt
   * @param {Object} options - Call options
   * @returns {Promise<{provider: string, model: string, response: string, duration: number}>}
   */
  async call(prompt, options = {}) {
    const modelId = options.model || this.getDefaultModel();
    const timeout = options.timeout || this.getTimeout('total');
    const retries = options.retries || 2;

    const args = [prompt, '-m', modelId, '--yolo'];

    const result = await withRetry(
      () => executeCLI('gemini', args, null, timeout),
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
   * Call Gemini with streaming
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

    const args = [prompt, '-m', modelId, '--yolo'];

    this.quotaState.incrementRequestCount();

    return executeCLIStream('gemini', args, timeout, onData, onEnd, onError);
  }
}

module.exports = { GeminiProvider };
