/**
 * Circuit Breaker Tests
 */

const { CircuitBreakerManager, createCircuitBreaker, STATE, DEFAULT_OPTIONS } = require('../src/resilience');

describe('Resilience: CircuitBreakerManager', () => {
  let manager;

  beforeEach(() => {
    manager = new CircuitBreakerManager({
      defaults: {
        timeout: 1000,
        errorThresholdPercentage: 50,
        resetTimeout: 500,
        volumeThreshold: 2,
        rollingCountTimeout: 1000,
      },
    });
  });

  afterEach(() => {
    manager.shutdown();
  });

  describe('circuit creation', () => {
    it('should create circuit for provider', async () => {
      const action = jest.fn().mockResolvedValue('success');
      const circuit = manager.getCircuit('test-provider', action);

      expect(circuit).toBeDefined();
      expect(circuit.name).toBe('circuit:test-provider');
    });

    it('should reuse existing circuit', () => {
      const action = jest.fn().mockResolvedValue('success');
      const circuit1 = manager.getCircuit('test-provider', action);
      const circuit2 = manager.getCircuit('test-provider', action);

      expect(circuit1).toBe(circuit2);
    });

    it('should create separate circuits for different providers', () => {
      const action = jest.fn().mockResolvedValue('success');
      const circuit1 = manager.getCircuit('provider-a', action);
      const circuit2 = manager.getCircuit('provider-b', action);

      expect(circuit1).not.toBe(circuit2);
    });
  });

  describe('execute()', () => {
    it('should execute action successfully', async () => {
      const action = jest.fn().mockResolvedValue('result');

      const result = await manager.execute('test-provider', action);

      expect(result).toBe('result');
      expect(action).toHaveBeenCalled();
    });

    it('should track successes', async () => {
      const action = jest.fn().mockResolvedValue('result');

      await manager.execute('test-provider', action);
      await manager.execute('test-provider', action);

      const metrics = manager.getMetrics('test-provider');
      expect(metrics.stats.successes).toBe(2);
    });

    it('should track failures', async () => {
      const action = jest.fn().mockRejectedValue(new Error('fail'));

      try {
        await manager.execute('test-provider', action);
      } catch (e) {
        // Expected
      }

      const metrics = manager.getMetrics('test-provider');
      expect(metrics.stats.failures).toBe(1);
    });
  });

  describe('circuit states', () => {
    it('should start in closed state', () => {
      const action = jest.fn().mockResolvedValue('success');
      manager.getCircuit('test-provider', action);

      expect(manager.getState('test-provider')).toBe(STATE.CLOSED);
    });

    it('should be available when closed', () => {
      const action = jest.fn().mockResolvedValue('success');
      manager.getCircuit('test-provider', action);

      expect(manager.isAvailable('test-provider')).toBe(true);
    });

    it('should return null for unknown provider', () => {
      expect(manager.getState('unknown')).toBeNull();
    });
  });

  describe('manual controls', () => {
    it('should manually open circuit', () => {
      const action = jest.fn().mockResolvedValue('success');
      manager.getCircuit('test-provider', action);

      manager.open('test-provider');

      expect(manager.getState('test-provider')).toBe(STATE.OPEN);
      expect(manager.isAvailable('test-provider')).toBe(false);
    });

    it('should manually close circuit', () => {
      const action = jest.fn().mockResolvedValue('success');
      manager.getCircuit('test-provider', action);
      manager.open('test-provider');

      manager.close('test-provider');

      expect(manager.getState('test-provider')).toBe(STATE.CLOSED);
    });
  });

  describe('getAllStatus()', () => {
    it('should return status for all circuits', async () => {
      const action = jest.fn().mockResolvedValue('success');
      manager.getCircuit('provider-a', action);
      manager.getCircuit('provider-b', action);

      const status = manager.getAllStatus();

      expect(status).toHaveProperty('provider-a');
      expect(status).toHaveProperty('provider-b');
      expect(status['provider-a'].state).toBe(STATE.CLOSED);
    });
  });

  describe('getMetrics()', () => {
    it('should return metrics for provider', async () => {
      const action = jest.fn().mockResolvedValue('success');
      await manager.execute('test-provider', action);

      const metrics = manager.getMetrics('test-provider');

      expect(metrics).toHaveProperty('state');
      expect(metrics).toHaveProperty('stats');
      expect(metrics).toHaveProperty('options');
      expect(metrics.stats.successes).toBe(1);
    });

    it('should return null for unknown provider', () => {
      expect(manager.getMetrics('unknown')).toBeNull();
    });
  });

  describe('resetAll()', () => {
    it('should reset all circuits', async () => {
      const action = jest.fn().mockResolvedValue('success');
      await manager.execute('test-provider', action);
      manager.open('test-provider');

      manager.resetAll();

      expect(manager.getState('test-provider')).toBe(STATE.CLOSED);
    });
  });

  describe('events', () => {
    it('should emit success event', (done) => {
      const action = jest.fn().mockResolvedValue('success');

      manager.on('success', (data) => {
        expect(data.provider).toBe('test-provider');
        expect(data.latency).toBeDefined();
        done();
      });

      manager.execute('test-provider', action);
    });

    it('should emit failure event', (done) => {
      const action = jest.fn().mockRejectedValue(new Error('test error'));

      manager.on('failure', (data) => {
        expect(data.provider).toBe('test-provider');
        expect(data.error).toBe('test error');
        done();
      });

      manager.execute('test-provider', action).catch(() => {});
    });

    it('should emit stateChange event when opened', (done) => {
      const action = jest.fn().mockResolvedValue('success');
      manager.getCircuit('test-provider', action);

      manager.on('stateChange', (data) => {
        if (data.state === STATE.OPEN) {
          expect(data.provider).toBe('test-provider');
          done();
        }
      });

      manager.open('test-provider');
    });
  });

  describe('getPrometheusMetrics()', () => {
    it('should return Prometheus format metrics', async () => {
      const action = jest.fn().mockResolvedValue('success');
      await manager.execute('test-provider', action);

      const metrics = manager.getPrometheusMetrics();

      expect(metrics).toContain('llmux_circuit_state');
      expect(metrics).toContain('llmux_circuit_requests_total');
      expect(metrics).toContain('test-provider');
    });
  });
});

describe('Resilience: createCircuitBreaker', () => {
  it('should create standalone circuit breaker', async () => {
    const action = jest.fn().mockResolvedValue('result');
    const circuit = createCircuitBreaker(action);

    const result = await circuit.fire();

    expect(result).toBe('result');
  });

  it('should accept custom options', () => {
    const action = jest.fn();
    const circuit = createCircuitBreaker(action, { timeout: 5000 });

    expect(circuit.options.timeout).toBe(5000);
  });
});

describe('Resilience: STATE', () => {
  it('should have all states', () => {
    expect(STATE.CLOSED).toBe('closed');
    expect(STATE.OPEN).toBe('open');
    expect(STATE.HALF_OPEN).toBe('halfOpen');
  });
});

describe('Resilience: DEFAULT_OPTIONS', () => {
  it('should have default timeout', () => {
    expect(DEFAULT_OPTIONS.timeout).toBe(30000);
  });

  it('should have error threshold', () => {
    expect(DEFAULT_OPTIONS.errorThresholdPercentage).toBe(50);
  });
});
