# LLMux Architecture

> **Version**: 5.0.0
> **Author**: LLMux Team
> **Last Updated**: 2026-01-30

## Overview

LLMux is a lightweight Node.js HTTP gateway that unifies access to multiple LLM providers (Claude, Gemini, Codex, Ollama) through a single API interface. It provides intelligent routing, caching, streaming, and observability features.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         LLMux Gateway                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │   Express    │  │  Middleware  │  │   Routing    │           │
│  │   Server     │──│    Stack     │──│   Engine     │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│                           │                  │                   │
│                           ▼                  ▼                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │    Cache     │  │  Providers   │  │  Telemetry   │           │
│  │   (Memory)   │  │  (4 types)   │  │ (Prometheus) │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌──────────┬──────────┬──────────┬──────────┐
        │  Claude  │  Gemini  │  Codex   │  Ollama  │
        │   API    │   API    │   CLI    │   API    │
        └──────────┴──────────┴──────────┴──────────┘
```

## Directory Structure

```
src/
├── index.js              # Application entry point
├── app.js                # Express app configuration
├── config/
│   ├── index.js          # Config aggregator
│   ├── providers.js      # Provider configuration & model mapping
│   └── env.js            # Environment variable parsing
├── providers/
│   ├── index.js          # Provider factory
│   ├── base.js           # BaseProvider class with quota management
│   ├── claude.js         # Claude API provider
│   ├── gemini.js         # Gemini API provider
│   ├── codex.js          # Codex CLI provider
│   └── ollama.js         # Ollama API provider
├── cache/
│   ├── index.js          # Cache factory
│   ├── adapter.js        # CacheAdapter interface
│   ├── memory.js         # In-memory LRU cache
│   └── redis.js          # Redis distributed cache (v5.0)
├── routing/
│   ├── index.js          # Routing aggregator
│   ├── weighted.js       # Weighted random selection
│   ├── priority.js       # Priority-based fallback
│   ├── dynamic.js        # Dynamic task-aware routing
│   ├── ai_router.js      # Semantic AI routing (v5.0)
│   ├── shadow.js         # Shadow routing for A/B testing (v5.0)
│   ├── experiment.js     # Experiment management
│   ├── weight_optimizer.js # Dynamic weight adjustment (v5.0)
│   ├── complexity_scorer.js # Task complexity scoring (v5.0)
│   ├── privacy_guard.js  # PII detection & routing (v5.0)
│   └── collector.js      # Routing event collector
├── middleware/
│   ├── index.js          # Middleware exports
│   ├── auth.js           # API key authentication
│   ├── validation.js     # Zod schema validation
│   ├── sanitizer.js      # Prompt injection protection
│   └── rateLimit.js      # Rate limiting
├── context/              # Context management (v5.0)
│   ├── history.js        # Conversation history storage
│   ├── injector.js       # Transparent context injection
│   └── extractor.js      # Entity extraction (NER)
├── embeddings/           # Vector embeddings (v5.0)
│   └── generator.js      # 384-dim embedding generator
├── evaluation/           # Quality evaluation (v5.0)
│   ├── judge.js          # LLM-as-judge evaluator
│   └── metrics_collector.js # Evaluation metrics
├── resilience/           # Fault tolerance (v5.0)
│   ├── index.js          # Resilience aggregator
│   ├── circuitBreaker.js # Circuit breaker pattern
│   └── resource_monitor.js # System health monitoring
├── plugins/              # Plugin system (v5.0)
│   ├── loader.js         # Plugin loader
│   ├── registry.js       # Plugin registry & hooks
│   └── context.js        # Plugin context
├── integrations/         # Third-party integrations (v5.0)
│   ├── sentry.js         # Error tracking
│   ├── langfuse.js       # LLM observability
│   ├── helicone.js       # Request logging
│   └── webhooks.js       # Webhook management
├── telemetry/
│   ├── index.js          # Telemetry aggregator
│   ├── metrics.js        # Prometheus metrics collector
│   ├── tracing.js        # OpenTelemetry tracing (v5.0)
│   ├── otelSetup.js      # OTLP configuration (v5.0)
│   └── inspector.js      # Live Flow Inspector (v5.0)
├── routes/               # API routes (v5.0)
│   ├── tenants.js        # Multi-tenancy management
│   ├── webhooks.js       # Webhook endpoints
│   ├── vector.js         # Vector storage API
│   └── evaluation.js     # Evaluation API
├── db/                   # Database layer (v5.0)
│   ├── index.js          # Database factory
│   ├── adapter.js        # Database adapter interface
│   └── sqlite.js         # SQLite implementation
├── models/               # Data models (v5.0)
│   ├── apiKey.js         # API key model
│   └── tenant.js         # Tenant model
├── vector/               # Vector database (v5.0)
│   └── index.js          # In-memory vector store
├── mcp/                  # Model Context Protocol (v5.0)
│   └── server.js         # MCP server implementation
├── quota/                # Quota management (v5.0)
│   ├── index.js          # Quota aggregator
│   └── manager.js        # Quota manager
├── rateLimit/            # Rate limiting (v5.0)
│   ├── index.js          # Rate limit aggregator
│   └── slidingWindow.js  # Sliding window counter
└── utils/
    ├── index.js          # Utils aggregator
    ├── retry.js          # Exponential backoff retry
    ├── tokenCounter.js   # Token counting (tiktoken)
    └── cli.js            # CLI execution utilities
```

## Core Components

### 1. Provider System (`src/providers/`)

Each provider extends `BaseProvider` which implements:
- **Quota Management**: Track token usage per provider
- **Health Monitoring**: Availability status and cooldown
- **Streaming Support**: Server-Sent Events for real-time responses

```javascript
class BaseProvider {
  constructor(name, config) { ... }
  async generate(prompt, options) { ... }  // Abstract
  async *stream(prompt, options) { ... }   // Abstract
  checkQuota(tokens) { ... }
  trackUsage(inputTokens, outputTokens) { ... }
}
```

### 2. Cache System (`src/cache/`)

LRU cache with configurable TTL:
- **CacheAdapter**: Abstract interface for cache backends
- **MemoryCache**: Default in-memory implementation
- **Key Generation**: Hash of prompt + provider + options

```javascript
const key = generateCacheKey(prompt, provider, options);
const cached = await cache.get(key);
if (cached) return cached;
```

### 3. Routing Engine (`src/routing/`)

Two routing strategies:
- **Weighted Selection**: Random selection based on provider weights
- **Priority Fallback**: Sequential fallback on provider failure

```javascript
const weighted = new WeightedSelector(providers);
const selectedProvider = weighted.select();
```

### 4. Middleware Stack (`src/middleware/`)

Request processing pipeline:
1. **Rate Limiting**: 100 req/min per IP/API key
2. **Authentication**: API key validation (optional)
3. **Validation**: Zod schema validation
4. **Sanitization**: Prompt injection protection

### 5. Telemetry (`src/telemetry/`)

Prometheus-compatible metrics:
- `llmux_requests_total` - Request counter by provider/status
- `llmux_tokens_total` - Token usage by provider/type
- `llmux_latency_seconds` - Request latency histogram
- `llmux_cache_hits_total` - Cache hit/miss counter
- `llmux_active_requests` - Current in-flight requests

## Request Flow

```
Client Request
      │
      ▼
┌─────────────┐
│ Rate Limit  │ ─── 429 if exceeded
└─────────────┘
      │
      ▼
┌─────────────┐
│    Auth     │ ─── 401 if invalid key
└─────────────┘
      │
      ▼
┌─────────────┐
│ Validation  │ ─── 400 if invalid input
└─────────────┘
      │
      ▼
┌─────────────┐
│ Sanitizer   │ ─── 400 if injection detected
└─────────────┘
      │
      ▼
┌─────────────┐
│ Cache Check │ ─── Return cached if hit
└─────────────┘
      │
      ▼
┌─────────────┐
│   Router    │ ─── Select provider
└─────────────┘
      │
      ▼
┌─────────────┐
│  Provider   │ ─── Call LLM API
└─────────────┘
      │
      ▼
┌─────────────┐
│ Cache Store │ ─── Store response
└─────────────┘
      │
      ▼
   Response
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 8765 | HTTP server port |
| `DEFAULT_PROVIDER` | claude | Default LLM provider |
| `API_KEY_REQUIRED` | false | Require API key authentication |
| `CACHE_TTL` | 3600000 | Cache TTL in milliseconds |
| `CACHE_MAX_SIZE` | 1000 | Maximum cache entries |
| `CORS_ORIGIN` | * | Allowed CORS origins |

### Provider Configuration

Defined in `src/config/providers.js`:

```javascript
const PROVIDER_CONFIG = {
  claude: {
    defaultModel: 'claude-sonnet-4-20250514',
    weight: 30,
    quotaLimit: 100000,
  },
  gemini: {
    defaultModel: 'gemini-2.5-flash',
    weight: 25,
    quotaLimit: 500000,
  },
  // ...
};
```

## Security Features

### Input Validation (Zod)
- Type-safe schema validation
- Strict mode rejects unknown fields
- Max prompt length: 100,000 characters

### Prompt Injection Protection
- Pattern matching for dangerous constructs
- Blocks: `eval()`, `process.env`, credential extraction
- Configurable severity levels

### Rate Limiting
- 100 requests/minute per client
- API key-based or IP-based limiting
- Draft-7 standard rate limit headers

## Performance Considerations

### Caching Strategy
- Default TTL: 1 hour
- LRU eviction when max size reached
- Cache bypass with `options.noCache: true`

### Streaming
- Server-Sent Events for real-time responses
- Chunked transfer encoding
- Automatic reconnection support

### Connection Pooling
- HTTP keep-alive enabled
- Configurable timeout per provider

## Monitoring

### Health Check

```bash
# Basic health
curl http://localhost:8765/health

# Deep health (checks all providers)
curl http://localhost:8765/health?deep=true
```

### Prometheus Metrics

```bash
curl http://localhost:8765/metrics
```

## Future Enhancements (Roadmap)

- **Phase 2**: Redis cache, per-key rate limiting, budget management
- **Phase 3**: Multi-tenancy, OpenTelemetry, Kubernetes Helm chart
- **Phase 4**: Plugin system, AI-driven routing, vector database support

## Related Documentation

- [API Reference](./api-reference.yaml) - OpenAPI 3.0 specification
- [Deployment Guide](./deployment.md) - Production deployment
- [Contributing](../CONTRIBUTING.md) - How to contribute
