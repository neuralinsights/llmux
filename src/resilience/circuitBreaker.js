/**
 * LLMux - Circuit Breaker Module
 * Provides fault tolerance for provider calls using the circuit breaker pattern
 *
 * @module resilience/circuitBreaker
 */

const CircuitBreaker = require('opossum');
const { EventEmitter } = require('events');

/**
 * Default circuit breaker options
 */
const DEFAULT_OPTIONS = {
  timeout: 30000,              // 30 seconds timeout
  errorThresholdPercentage: 50, // Open circuit when 50% of requests fail
  resetTimeout: 30000,          // Try again after 30 seconds
  volumeThreshold: 5,           // Minimum requests before tripping
  rollingCountTimeout: 10000,   // Window for failure rate calculation
  rollingCountBuckets: 10,      // Number of buckets in rolling window
};

/**
 * Circuit state constants
 */
const STATE = {
  CLOSED: 'closed',
  OPEN: 'open',
  HALF_OPEN: 'halfOpen',
};

/**
 * Circuit Breaker Manager for LLM providers
 * @extends EventEmitter
 */
class CircuitBreakerManager extends EventEmitter {
  /**
   * @param {Object} options - Manager options
   * @param {Object} [options.defaults] - Default circuit breaker options
   * @param {Object} [options.providerOptions] - Per-provider options
   */
  constructor(options = {}) {
    super();

    this.defaults = { ...DEFAULT_OPTIONS, ...options.defaults };
    this.providerOptions = options.providerOptions || {};

    // Store circuits by provider name
    this.circuits = new Map();

    // Store metrics
    this.metrics = new Map();
  }

  /**
   * Get or create circuit breaker for a provider
   * @param {string} providerName - Provider name
   * @param {Function} action - The function to protect
   * @returns {CircuitBreaker} Circuit breaker instance
   */
  getCircuit(providerName, action) {
    if (this.circuits.has(providerName)) {
      return this.circuits.get(providerName);
    }

    const options = {
      ...this.defaults,
      ...this.providerOptions[providerName],
      name: `circuit:${providerName}`,
    };

    const circuit = new CircuitBreaker(action, options);

    // Initialize metrics
    this.metrics.set(providerName, {
      successes: 0,
      failures: 0,
      timeouts: 0,
      rejects: 0,
      fallbacks: 0,
      stateChanges: [],
    });

    // Set up event handlers
    this._setupCircuitEvents(circuit, providerName);

    this.circuits.set(providerName, circuit);
    return circuit;
  }

  /**
   * Set up event handlers for a circuit
   * @param {CircuitBreaker} circuit - Circuit breaker instance
   * @param {string} providerName - Provider name
   */
  _setupCircuitEvents(circuit, providerName) {
    const metrics = this.metrics.get(providerName);

    circuit.on('success', (result, latency) => {
      metrics.successes++;
      this.emit('success', { provider: providerName, latency });
    });

    circuit.on('failure', (error, latency) => {
      metrics.failures++;
      this.emit('failure', { provider: providerName, error: error.message, latency });
      console.log(`[CIRCUIT:${providerName}] Failure: ${error.message}`);
    });

    circuit.on('timeout', (error, latency) => {
      metrics.timeouts++;
      this.emit('timeout', { provider: providerName, latency });
      console.log(`[CIRCUIT:${providerName}] Timeout after ${latency}ms`);
    });

    circuit.on('reject', () => {
      metrics.rejects++;
      this.emit('reject', { provider: providerName });
      console.log(`[CIRCUIT:${providerName}] Request rejected (circuit open)`);
    });

    circuit.on('open', () => {
      metrics.stateChanges.push({ state: STATE.OPEN, timestamp: Date.now() });
      this.emit('stateChange', { provider: providerName, state: STATE.OPEN });
      console.log(`[CIRCUIT:${providerName}] Circuit OPENED - requests will be rejected`);
    });

    circuit.on('halfOpen', () => {
      metrics.stateChanges.push({ state: STATE.HALF_OPEN, timestamp: Date.now() });
      this.emit('stateChange', { provider: providerName, state: STATE.HALF_OPEN });
      console.log(`[CIRCUIT:${providerName}] Circuit HALF-OPEN - testing recovery`);
    });

    circuit.on('close', () => {
      metrics.stateChanges.push({ state: STATE.CLOSED, timestamp: Date.now() });
      this.emit('stateChange', { provider: providerName, state: STATE.CLOSED });
      console.log(`[CIRCUIT:${providerName}] Circuit CLOSED - requests allowed`);
    });

    circuit.on('fallback', (result) => {
      metrics.fallbacks++;
      this.emit('fallback', { provider: providerName, result });
    });
  }

  /**
   * Execute a function through the circuit breaker
   * @param {string} providerName - Provider name
   * @param {Function} action - Function to execute
   * @param {...any} args - Arguments to pass to the function
   * @returns {Promise<any>} Result of the action
   */
  async execute(providerName, action, ...args) {
    const circuit = this.getCircuit(providerName, action);
    return circuit.fire(...args);
  }

  /**
   * Execute with fallback
   * @param {string} providerName - Provider name
   * @param {Function} action - Primary action
   * @param {Function} fallback - Fallback action
   * @param {...any} args - Arguments
   * @returns {Promise<any>} Result
   */
  async executeWithFallback(providerName, action, fallback, ...args) {
    const circuit = this.getCircuit(providerName, action);
    circuit.fallback(fallback);
    return circuit.fire(...args);
  }

  /**
   * Get circuit state for a provider
   * @param {string} providerName - Provider name
   * @returns {string|null} Circuit state
   */
  getState(providerName) {
    const circuit = this.circuits.get(providerName);
    if (!circuit) return null;

    if (circuit.opened) return STATE.OPEN;
    if (circuit.halfOpen) return STATE.HALF_OPEN;
    return STATE.CLOSED;
  }

  /**
   * Check if circuit is available (not open)
   * @param {string} providerName - Provider name
   * @returns {boolean} Whether circuit allows requests
   */
  isAvailable(providerName) {
    const state = this.getState(providerName);
    return state !== STATE.OPEN;
  }

  /**
   * Manually open a circuit
   * @param {string} providerName - Provider name
   */
  open(providerName) {
    const circuit = this.circuits.get(providerName);
    if (circuit) {
      circuit.open();
    }
  }

  /**
   * Manually close a circuit
   * @param {string} providerName - Provider name
   */
  close(providerName) {
    const circuit = this.circuits.get(providerName);
    if (circuit) {
      circuit.close();
    }
  }

  /**
   * Get metrics for a provider
   * @param {string} providerName - Provider name
   * @returns {Object|null} Metrics object
   */
  getMetrics(providerName) {
    const circuit = this.circuits.get(providerName);
    const localMetrics = this.metrics.get(providerName);

    if (!circuit || !localMetrics) return null;

    const stats = circuit.stats;

    return {
      state: this.getState(providerName),
      stats: {
        successes: stats.successes,
        failures: stats.failures,
        timeouts: stats.timeouts,
        rejects: stats.rejects,
        fallbacks: stats.fallbacks,
        latencyMean: Math.round(stats.latencyMean),
        percentiles: stats.percentiles,
      },
      local: localMetrics,
      options: {
        timeout: circuit.options.timeout,
        errorThresholdPercentage: circuit.options.errorThresholdPercentage,
        resetTimeout: circuit.options.resetTimeout,
        volumeThreshold: circuit.options.volumeThreshold,
      },
    };
  }

  /**
   * Get all circuits status
   * @returns {Object} All circuits status
   */
  getAllStatus() {
    const status = {};

    for (const [name, circuit] of this.circuits) {
      status[name] = {
        state: this.getState(name),
        available: this.isAvailable(name),
        stats: {
          successes: circuit.stats.successes,
          failures: circuit.stats.failures,
          rejects: circuit.stats.rejects,
        },
      };
    }

    return status;
  }

  /**
   * Reset all circuits
   */
  resetAll() {
    for (const [name, circuit] of this.circuits) {
      circuit.close();
      this.metrics.set(name, {
        successes: 0,
        failures: 0,
        timeouts: 0,
        rejects: 0,
        fallbacks: 0,
        stateChanges: [],
      });
    }
  }

  /**
   * Shutdown all circuits
   */
  shutdown() {
    for (const circuit of this.circuits.values()) {
      circuit.shutdown();
    }
    this.circuits.clear();
    this.metrics.clear();
  }

  /**
   * Get Prometheus-compatible metrics
   * @returns {string} Prometheus metrics format
   */
  getPrometheusMetrics() {
    const lines = [];

    lines.push('# HELP llmux_circuit_state Circuit breaker state (0=closed, 1=half-open, 2=open)');
    lines.push('# TYPE llmux_circuit_state gauge');

    lines.push('# HELP llmux_circuit_requests_total Total requests through circuit breaker');
    lines.push('# TYPE llmux_circuit_requests_total counter');

    for (const [name, circuit] of this.circuits) {
      const state = this.getState(name);
      const stateValue = state === STATE.CLOSED ? 0 : state === STATE.HALF_OPEN ? 1 : 2;

      lines.push(`llmux_circuit_state{provider="${name}"} ${stateValue}`);
      lines.push(`llmux_circuit_requests_total{provider="${name}",result="success"} ${circuit.stats.successes}`);
      lines.push(`llmux_circuit_requests_total{provider="${name}",result="failure"} ${circuit.stats.failures}`);
      lines.push(`llmux_circuit_requests_total{provider="${name}",result="timeout"} ${circuit.stats.timeouts}`);
      lines.push(`llmux_circuit_requests_total{provider="${name}",result="reject"} ${circuit.stats.rejects}`);
    }

    return lines.join('\n');
  }
}

/**
 * Create a simple circuit breaker for a single function
 * @param {Function} action - Function to protect
 * @param {Object} options - Circuit breaker options
 * @returns {CircuitBreaker} Circuit breaker instance
 */
function createCircuitBreaker(action, options = {}) {
  return new CircuitBreaker(action, { ...DEFAULT_OPTIONS, ...options });
}

module.exports = {
  CircuitBreakerManager,
  createCircuitBreaker,
  DEFAULT_OPTIONS,
  STATE,
};
