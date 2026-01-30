# LLMux Architecture

> **Version**: 3.0.0
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
│   └── memory.js         # In-memory LRU cache
├── routing/
│   ├── index.js          # Routing aggregator
│   ├── weighted.js       # Weighted random selection
│   └── priority.js       # Priority-based fallback
├── middleware/
│   ├── index.js          # Middleware exports
│   ├── auth.js           # API key authentication
│   ├── validation.js     # Zod schema validation
│   ├── sanitizer.js      # Prompt injection protection
│   └── rateLimit.js      # Rate limiting
├── telemetry/
│   └── metrics.js        # Prometheus metrics collector
└── utils/
    ├── retry.js          # Exponential backoff retry
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
| `PORT` | 3456 | HTTP server port |
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
curl http://localhost:3456/health

# Deep health (checks all providers)
curl http://localhost:3456/health?deep=true
```

### Prometheus Metrics

```bash
curl http://localhost:3456/metrics
```

## Future Enhancements (Roadmap)

- **Phase 2**: Redis cache, per-key rate limiting, budget management
- **Phase 3**: Multi-tenancy, OpenTelemetry, Kubernetes Helm chart
- **Phase 4**: Plugin system, AI-driven routing, vector database support

## Related Documentation

- [API Reference](./api-reference.yaml) - OpenAPI 3.0 specification
- [Deployment Guide](./deployment.md) - Production deployment
- [Contributing](../CONTRIBUTING.md) - How to contribute
