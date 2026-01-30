/**
 * OpenTelemetry Tracing Tests
 */

// Mock OpenTelemetry SDK modules before requiring anything else
jest.mock('@opentelemetry/sdk-node', () => ({
  NodeSDK: jest.fn().mockImplementation(() => ({
    start: jest.fn().mockResolvedValue(undefined),
    shutdown: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@opentelemetry/auto-instrumentations-node', () => ({
  getNodeAutoInstrumentations: jest.fn().mockReturnValue([]),
}));

jest.mock('@opentelemetry/exporter-trace-otlp-http', () => ({
  OTLPTraceExporter: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@opentelemetry/resources', () => ({
  Resource: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@opentelemetry/semantic-conventions', () => ({
  ATTR_SERVICE_NAME: 'service.name',
  ATTR_SERVICE_VERSION: 'service.version',
}));

// Mock OpenTelemetry API
const mockSpan = {
  setAttribute: jest.fn().mockReturnThis(),
  setStatus: jest.fn().mockReturnThis(),
  recordException: jest.fn().mockReturnThis(),
  end: jest.fn(),
};

const mockTracer = {
  startSpan: jest.fn().mockReturnValue(mockSpan),
  startActiveSpan: jest.fn((name, options, fn) => {
    if (typeof options === 'function') {
      return options(mockSpan);
    }
    return fn(mockSpan);
  }),
};

jest.mock('@opentelemetry/api', () => ({
  trace: {
    getTracer: jest.fn().mockReturnValue(mockTracer),
    setSpan: jest.fn().mockReturnValue({}),
  },
  context: {
    active: jest.fn().mockReturnValue({}),
  },
  SpanKind: {
    CLIENT: 'CLIENT',
    SERVER: 'SERVER',
  },
  SpanStatusCode: {
    OK: 1,
    ERROR: 2,
  },
}));

// Import after mocks are set up
const {
  getTracer,
  startProviderSpan,
  recordSuccess,
  recordError,
  tracingMiddleware,
  createChildSpan,
  traceRouterDecision,
  traceCacheOperation,
  traceCircuitBreaker,
  traceRateLimit,
  traceQuotaCheck,
  TRACER_NAME,
  isOtelEnabled,
  getOtelConfig,
} = require('../src/telemetry');

describe('Telemetry: Tracing', () => {
  describe('TRACER_NAME', () => {
    it('should be llmux', () => {
      expect(TRACER_NAME).toBe('llmux');
    });
  });

  describe('getTracer()', () => {
    it('should return a tracer instance', () => {
      const tracer = getTracer();
      expect(tracer).toBeDefined();
      expect(tracer.startSpan).toBeDefined();
    });
  });

  describe('startProviderSpan()', () => {
    it('should create a span with provider attributes', () => {
      const span = startProviderSpan('claude', 'chat', { model: 'claude-3' });

      expect(span).toBeDefined();
      expect(span.end).toBeDefined();
    });

    it('should set correct span name format', () => {
      const { trace } = require('@opentelemetry/api');
      const tracer = trace.getTracer();

      startProviderSpan('openai', 'complete');

      expect(tracer.startSpan).toHaveBeenCalledWith(
        'llm.openai.complete',
        expect.objectContaining({
          kind: 'CLIENT',
          attributes: expect.objectContaining({
            'llm.provider': 'openai',
            'llm.operation': 'complete',
          }),
        })
      );
    });
  });

  describe('recordSuccess()', () => {
    it('should set success status and end span', () => {
      const span = startProviderSpan('gemini', 'chat');

      recordSuccess(span, {
        promptTokens: 100,
        completionTokens: 50,
        model: 'gemini-pro',
        latencyMs: 1500,
      });

      expect(span.setAttribute).toHaveBeenCalledWith('llm.usage.prompt_tokens', 100);
      expect(span.setAttribute).toHaveBeenCalledWith('llm.usage.completion_tokens', 50);
      expect(span.setAttribute).toHaveBeenCalledWith('llm.response.model', 'gemini-pro');
      expect(span.setAttribute).toHaveBeenCalledWith('llm.latency_ms', 1500);
      expect(span.setStatus).toHaveBeenCalledWith({ code: 1 });
      expect(span.end).toHaveBeenCalled();
    });

    it('should handle missing optional fields', () => {
      const span = startProviderSpan('ollama', 'chat');

      recordSuccess(span);

      expect(span.setStatus).toHaveBeenCalledWith({ code: 1 });
      expect(span.end).toHaveBeenCalled();
    });
  });

  describe('recordError()', () => {
    it('should record exception and set error status', () => {
      const span = startProviderSpan('claude', 'chat');
      const error = new Error('API rate limit exceeded');

      recordError(span, error, { errorType: 'rate_limit', statusCode: 429 });

      expect(span.recordException).toHaveBeenCalledWith(error);
      expect(span.setStatus).toHaveBeenCalledWith({
        code: 2,
        message: 'API rate limit exceeded',
      });
      expect(span.setAttribute).toHaveBeenCalledWith('error.type', 'rate_limit');
      expect(span.setAttribute).toHaveBeenCalledWith('http.status_code', 429);
      expect(span.end).toHaveBeenCalled();
    });
  });

  describe('tracingMiddleware()', () => {
    it('should return middleware function', () => {
      const middleware = tracingMiddleware();
      expect(typeof middleware).toBe('function');
    });

    it('should attach span to request', () => {
      const middleware = tracingMiddleware();
      const req = {
        method: 'POST',
        path: '/v1/chat/completions',
        originalUrl: '/v1/chat/completions',
        get: jest.fn().mockReturnValue('test-agent'),
      };
      const res = {
        statusCode: 200,
        end: jest.fn(),
      };
      const next = jest.fn();

      middleware(req, res, next);

      expect(req.span).toBeDefined();
      expect(next).toHaveBeenCalled();
    });

    it('should end span on response end', () => {
      const middleware = tracingMiddleware();
      const req = {
        method: 'GET',
        path: '/health',
        originalUrl: '/health',
        get: jest.fn().mockReturnValue(''),
      };
      const res = {
        statusCode: 200,
        end: jest.fn(),
      };
      const next = jest.fn();

      middleware(req, res, next);

      // Simulate response end
      res.end('OK');

      expect(req.span.end).toHaveBeenCalled();
    });
  });

  describe('createChildSpan()', () => {
    it('should create span with parent context', () => {
      const parentSpan = startProviderSpan('claude', 'chat');
      const req = { span: parentSpan };

      const childSpan = createChildSpan(req, 'cache.lookup', { 'cache.key': 'abc' });

      expect(childSpan).toBeDefined();
    });

    it('should create span without parent if missing', () => {
      const req = {};

      const span = createChildSpan(req, 'orphan.span');

      expect(span).toBeDefined();
    });
  });

  describe('traceRouterDecision()', () => {
    it('should trace routing decision', () => {
      const req = { span: startProviderSpan('test', 'test') };
      const decision = {
        provider: 'claude',
        taskType: 'code',
        score: { total: 0.85 },
        alternatives: [{ name: 'openai' }, { name: 'gemini' }],
      };

      traceRouterDecision(req, decision);

      // Should not throw
    });
  });

  describe('traceCacheOperation()', () => {
    it('should trace cache hit', () => {
      const req = { span: startProviderSpan('test', 'test') };

      traceCacheOperation(req, 'get', true, 'abc123def');

      // Should not throw
    });

    it('should trace cache miss', () => {
      const req = { span: startProviderSpan('test', 'test') };

      traceCacheOperation(req, 'get', false);

      // Should not throw
    });
  });

  describe('traceCircuitBreaker()', () => {
    it('should trace circuit breaker check', () => {
      const req = { span: startProviderSpan('test', 'test') };

      traceCircuitBreaker(req, 'claude', 'closed', true);

      // Should not throw
    });

    it('should trace circuit open state', () => {
      const req = { span: startProviderSpan('test', 'test') };

      traceCircuitBreaker(req, 'openai', 'open', false);

      // Should not throw
    });
  });

  describe('traceRateLimit()', () => {
    it('should trace rate limit allowed', () => {
      const req = { span: startProviderSpan('test', 'test') };

      traceRateLimit(req, 'api:key123', true, 99);

      // Should not throw
    });

    it('should trace rate limit denied', () => {
      const req = { span: startProviderSpan('test', 'test') };

      traceRateLimit(req, '192.168.1.1', false, 0);

      // Should not throw
    });
  });

  describe('traceQuotaCheck()', () => {
    it('should trace quota with masked key', () => {
      const req = { span: startProviderSpan('test', 'test') };

      traceQuotaCheck(req, 'sk-12345678abcdefgh', true, {
        tokensUsed: 5000,
        tokenLimit: 100000,
      });

      // Should not throw
    });

    it('should handle missing key', () => {
      const req = { span: startProviderSpan('test', 'test') };

      traceQuotaCheck(req, null, false);

      // Should not throw
    });
  });
});

describe('Telemetry: OpenTelemetry Setup', () => {
  describe('isOtelEnabled()', () => {
    it('should return false when not initialized', () => {
      expect(isOtelEnabled()).toBe(false);
    });
  });

  describe('getOtelConfig()', () => {
    it('should return configuration object', () => {
      const config = getOtelConfig();

      expect(config).toHaveProperty('enabled');
      expect(config).toHaveProperty('serviceName');
      expect(config).toHaveProperty('serviceVersion');
      expect(config).toHaveProperty('endpoint');
    });

    it('should have llmux as service name', () => {
      const config = getOtelConfig();
      expect(config.serviceName).toBe('llmux');
    });
  });
});
