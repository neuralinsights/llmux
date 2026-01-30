/**
 * LLMux - Ollama Provider
 * Local Ollama API integration (HTTP-based, not CLI)
 */

const { BaseProvider } = require('./base');
const { env } = require('../config/env');

/**
 * Ollama provider implementation
 * Uses HTTP API instead of CLI for better performance
 */
class OllamaProvider extends BaseProvider {
  constructor() {
    super('ollama');
    this.host = env.OLLAMA_HOST;
  }

  /**
   * Call Ollama (non-streaming)
   * @param {string} prompt - The prompt
   * @param {Object} options - Call options
   * @returns {Promise<{provider: string, model: string, response: string, duration: number}>}
   */
  async call(prompt, options = {}) {
    const modelId = options.model || this.getDefaultModel();
    const timeout = options.timeout || this.getTimeout('total');
    const startTime = Date.now();

    const response = await fetch(`${this.host}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelId,
        prompt: prompt,
        stream: false,
        options: {
          num_predict: options.maxTokens || 4096,
          temperature: options.temperature || 0.7,
        },
      }),
      signal: AbortSignal.timeout(timeout),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const duration = Date.now() - startTime;

    this.quotaState.incrementRequestCount();

    return {
      provider: this.name,
      model: modelId,
      response: data.response,
      duration: duration,
    };
  }

  /**
   * Call Ollama with streaming
   * @param {string} prompt - The prompt
   * @param {Object} options - Call options
   * @param {Function} onData - Callback for data chunks
   * @param {Function} onEnd - Callback when complete
   * @param {Function} onError - Callback for errors
   * @returns {Promise<void>}
   */
  async callStream(prompt, options, onData, onEnd, onError) {
    const modelId = options.model || this.getDefaultModel();
    const timeout = options.timeout || this.getTimeout('total');
    const startTime = Date.now();

    try {
      const response = await fetch(`${this.host}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelId,
          prompt: prompt,
          stream: true,
          options: {
            num_predict: options.maxTokens || 4096,
            temperature: options.temperature || 0.7,
          },
        }),
        signal: AbortSignal.timeout(timeout),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      this.quotaState.incrementRequestCount();

      const processStream = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter((line) => line.trim());

            for (const line of lines) {
              try {
                const json = JSON.parse(line);
                if (json.response) {
                  onData(json.response);
                }
                if (json.done) {
                  onEnd(Date.now() - startTime);
                  return;
                }
              } catch (e) {
                // Ignore JSON parse errors for incomplete chunks
              }
            }
          }
          onEnd(Date.now() - startTime);
        } catch (err) {
          onError(err);
        }
      };

      // Start processing stream
      processStream();
    } catch (err) {
      onError(err);
    }
  }

  /**
   * Check Ollama health by calling /api/tags
   * @returns {Promise<{status: string, latencyMs: number}>}
   */
  async healthCheck() {
    const start = Date.now();
    try {
      const response = await fetch(`${this.host}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      return {
        status: response.ok ? 'ok' : 'error',
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      return {
        status: 'error',
        error: err.message,
        latencyMs: Date.now() - start,
      };
    }
  }

  /**
   * List available models from Ollama
   * @returns {Promise<Array<{name: string, size: number, modified_at: string}>>}
   */
  async listModels() {
    const response = await fetch(`${this.host}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json();
    return data.models || [];
  }
}

module.exports = { OllamaProvider };
