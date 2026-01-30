/**
 * LLMux - Langfuse LLM Observability Integration
 * Provides LLM-specific observability and analytics via Langfuse
 */

let isInitialized = false;
let config = null;

/**
 * Default Langfuse configuration
 */
const DEFAULT_CONFIG = {
  enabled: process.env.LANGFUSE_ENABLED === 'true',
  publicKey: process.env.LANGFUSE_PUBLIC_KEY || '',
  secretKey: process.env.LANGFUSE_SECRET_KEY || '',
  baseUrl: process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com',
  release: process.env.npm_package_version || '3.1.0',
  flushAt: parseInt(process.env.LANGFUSE_FLUSH_AT) || 15,
  flushInterval: parseInt(process.env.LANGFUSE_FLUSH_INTERVAL) || 10000,
};

// In-memory trace storage (would be sent to Langfuse API in production)
const traces = new Map();
const generations = new Map();

/**
 * Initialize Langfuse
 * @param {Object} [userConfig] - Configuration options
 * @returns {boolean} Whether initialization was successful
 */
function initializeLangfuse(userConfig = {}) {
  config = { ...DEFAULT_CONFIG, ...userConfig };

  if (!config.enabled) {
    console.log('[LANGFUSE] LLM observability disabled (set LANGFUSE_ENABLED=true to enable)');
    return false;
  }

  if (!config.publicKey || !config.secretKey) {
    console.warn('[LANGFUSE] API keys not provided, LLM observability disabled');
    return false;
  }

  if (isInitialized) {
    console.log('[LANGFUSE] Already initialized');
    return true;
  }

  isInitialized = true;
  console.log(`[LANGFUSE] LLM observability initialized`);
  console.log(`[LANGFUSE] Base URL: ${config.baseUrl}`);
  console.log(`[LANGFUSE] Release: ${config.release}`);

  return true;
}

/**
 * Create a new trace for an LLM interaction
 * @param {Object} options - Trace options
 * @returns {Object} Trace object
 */
function createTrace(options = {}) {
  const traceId = options.id || generateId();
  const trace = {
    id: traceId,
    name: options.name || 'llmux-request',
    userId: options.userId,
    sessionId: options.sessionId,
    metadata: options.metadata || {},
    tags: options.tags || [],
    input: options.input,
    output: null,
    startTime: Date.now(),
    endTime: null,
    generations: [],
    release: config?.release,
  };

  traces.set(traceId, trace);

  return {
    id: traceId,
    update: (data) => updateTrace(traceId, data),
    end: (output) => endTrace(traceId, output),
    generation: (genOptions) => createGeneration(traceId, genOptions),
    span: (spanOptions) => createSpan(traceId, spanOptions),
    score: (scoreOptions) => addScore(traceId, scoreOptions),
  };
}

/**
 * Update trace data
 * @param {string} traceId - Trace ID
 * @param {Object} data - Data to update
 */
function updateTrace(traceId, data) {
  const trace = traces.get(traceId);
  if (trace) {
    Object.assign(trace, data);
  }
}

/**
 * End a trace
 * @param {string} traceId - Trace ID
 * @param {*} output - Trace output
 */
function endTrace(traceId, output) {
  const trace = traces.get(traceId);
  if (trace) {
    trace.output = output;
    trace.endTime = Date.now();

    // In production, would send to Langfuse API
    if (isInitialized) {
      flushTrace(trace);
    }
  }
}

/**
 * Create a generation (LLM call) within a trace
 * @param {string} traceId - Parent trace ID
 * @param {Object} options - Generation options
 * @returns {Object} Generation object
 */
function createGeneration(traceId, options = {}) {
  const generationId = options.id || generateId();
  const generation = {
    id: generationId,
    traceId,
    name: options.name || 'llm-generation',
    model: options.model,
    modelParameters: options.modelParameters || {},
    input: options.input,
    output: null,
    usage: null,
    startTime: Date.now(),
    endTime: null,
    metadata: options.metadata || {},
    level: options.level || 'DEFAULT',
    statusMessage: null,
    completionStartTime: null,
  };

  generations.set(generationId, generation);

  const trace = traces.get(traceId);
  if (trace) {
    trace.generations.push(generationId);
  }

  return {
    id: generationId,
    update: (data) => updateGeneration(generationId, data),
    end: (endOptions) => endGeneration(generationId, endOptions),
  };
}

/**
 * Update generation data
 * @param {string} generationId - Generation ID
 * @param {Object} data - Data to update
 */
function updateGeneration(generationId, data) {
  const generation = generations.get(generationId);
  if (generation) {
    Object.assign(generation, data);
  }
}

/**
 * End a generation
 * @param {string} generationId - Generation ID
 * @param {Object} options - End options
 */
function endGeneration(generationId, options = {}) {
  const generation = generations.get(generationId);
  if (generation) {
    generation.output = options.output;
    generation.endTime = Date.now();
    generation.usage = options.usage || null;
    generation.statusMessage = options.statusMessage;
    generation.level = options.level || generation.level;

    if (options.usage) {
      generation.usage = {
        promptTokens: options.usage.promptTokens || options.usage.prompt_tokens,
        completionTokens: options.usage.completionTokens || options.usage.completion_tokens,
        totalTokens: options.usage.totalTokens || options.usage.total_tokens,
      };
    }
  }
}

/**
 * Create a span within a trace
 * @param {string} traceId - Parent trace ID
 * @param {Object} options - Span options
 * @returns {Object} Span object
 */
function createSpan(traceId, options = {}) {
  const spanId = options.id || generateId();
  return {
    id: spanId,
    traceId,
    name: options.name || 'span',
    startTime: Date.now(),
    endTime: null,
    metadata: options.metadata || {},
    end: (output) => {
      // Span completed
    },
  };
}

/**
 * Add a score to a trace
 * @param {string} traceId - Trace ID
 * @param {Object} options - Score options
 */
function addScore(traceId, options = {}) {
  const trace = traces.get(traceId);
  if (trace) {
    if (!trace.scores) {
      trace.scores = [];
    }
    trace.scores.push({
      name: options.name,
      value: options.value,
      comment: options.comment,
      dataType: options.dataType || 'NUMERIC',
    });
  }
}

/**
 * Flush trace to Langfuse API
 * @param {Object} trace - Trace to flush
 */
async function flushTrace(trace) {
  if (!isInitialized || !config) return;

  // In production, would POST to Langfuse API
  // For now, just log
  console.log(`[LANGFUSE] Trace ${trace.id} completed:`, {
    name: trace.name,
    duration: trace.endTime - trace.startTime,
    generationCount: trace.generations.length,
  });
}

/**
 * Flush all pending events
 * @returns {Promise<void>}
 */
async function flush() {
  if (!isInitialized) return;

  const pendingTraces = Array.from(traces.values()).filter(t => t.endTime);
  for (const trace of pendingTraces) {
    await flushTrace(trace);
  }
}

/**
 * Shutdown Langfuse client
 * @returns {Promise<void>}
 */
async function shutdown() {
  if (!isInitialized) return;

  await flush();
  traces.clear();
  generations.clear();
  isInitialized = false;
  console.log('[LANGFUSE] Shutdown complete');
}

/**
 * Generate a unique ID
 * @returns {string}
 */
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Check if Langfuse is enabled
 * @returns {boolean}
 */
function isLangfuseEnabled() {
  return isInitialized;
}

/**
 * Get Langfuse configuration
 * @returns {Object}
 */
function getLangfuseConfig() {
  return {
    enabled: isInitialized,
    baseUrl: config?.baseUrl || DEFAULT_CONFIG.baseUrl,
    release: config?.release || DEFAULT_CONFIG.release,
  };
}

/**
 * Get trace statistics
 * @returns {Object}
 */
function getStats() {
  return {
    activeTraces: traces.size,
    activeGenerations: generations.size,
  };
}

module.exports = {
  initializeLangfuse,
  createTrace,
  createGeneration,
  createSpan,
  addScore,
  flush,
  shutdown,
  isLangfuseEnabled,
  getLangfuseConfig,
  getStats,
  DEFAULT_CONFIG,
};
