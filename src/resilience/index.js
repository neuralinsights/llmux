/**
 * LLMux - Resilience Module Index
 * Exports fault tolerance and resilience functionality
 */

const {
  CircuitBreakerManager,
  createCircuitBreaker,
  DEFAULT_OPTIONS,
  STATE,
} = require('./circuitBreaker');

module.exports = {
  CircuitBreakerManager,
  createCircuitBreaker,
  DEFAULT_OPTIONS,
  STATE,
};
