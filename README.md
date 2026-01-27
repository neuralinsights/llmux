# LLMux v3.0.0

> **LLM Multiplexer** - Unified HTTP API Gateway for multiple AI providers, supporting Claude, Gemini, Codex, and Ollama

## Features

- **Zero API Key Storage** - Uses CLI session authentication, no sensitive credentials to manage
- **Streaming Responses (SSE)** - Real-time output with OpenAI-compatible format
- **Smart Caching** - LRU in-memory cache with optional Redis, reduces costs by 40%+
- **Weighted Load Balancing** - Distributes traffic across providers by weight
- **Intelligent Fallback** - Automatic provider switching on quota exhaustion with exponential backoff retry
- **Prometheus Metrics** - Full observability with Grafana integration support
- **API Key Authentication** - Multi-tenant support, optionally enabled
- **OpenAI Compatible API** - Seamless integration with existing tools

## Quick Start

### Local Development (No Docker)

```bash
npm install
npm start
```

### Docker Deployment

Supports multiple container runtimes. Choose your preferred tool:

#### Docker Desktop (Mac/Windows)

```bash
# Using docker-compose
docker-compose up -d --build

# Or using the script
./scripts/docker-run.sh
```

#### OrbStack (Recommended for macOS)

```bash
./scripts/orbstack-run.sh

# OrbStack feature: automatic domain
# http://llmux.orb.local:8765
```

#### Colima (Lightweight macOS Alternative)

```bash
# Install: brew install colima docker
colima start
./scripts/colima-run.sh
```

#### Podman / Podman Desktop

```bash
./scripts/podman-run.sh
```

#### Rancher Desktop

```bash
# Supports both containerd (nerdctl) and dockerd backends
./scripts/rancher-desktop.sh
```

#### Manual docker run

```bash
docker build -t llmux:3.0.0 .

docker run -d \
  --name llmux \
  -p 8765:8765 \
  -v ~/.claude:/root/.claude:ro \
  -v ~/.codex:/root/.codex:ro \
  -v ~/.gemini:/root/.gemini:ro \
  -e OLLAMA_HOST=http://host.docker.internal:11434 \
  llmux:3.0.0
```

### Host Access Addresses

Different runtimes use different addresses to access host services (e.g., Ollama):

| Runtime | Host Address |
|---------|--------------|
| Docker Desktop | `host.docker.internal` |
| OrbStack | `host.docker.internal` or `host.orb.local` |
| Colima | `host.lima.internal` |
| Podman (macOS) | `host.containers.internal` |
| Podman (Linux) | `172.17.0.1` or `--network host` |
| Linux Docker | `172.17.0.1` or `--network host` |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8765` | Server port |
| `DEFAULT_PROVIDER` | `claude` | Default AI provider |
| `REQUEST_TIMEOUT` | `120000` | Request timeout (ms) |
| `OLLAMA_HOST` | `http://127.0.0.1:11434` | Ollama server address |
| `API_KEY_REQUIRED` | `false` | Enable API key authentication |
| `API_KEY` | - | Default API key |
| `ADMIN_KEY` | - | Admin secret key |
| `CACHE_TTL` | `3600000` | Cache TTL (ms) |
| `CACHE_MAX_SIZE` | `1000` | Maximum cache entries |

## API Endpoints

### Core Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/smart` | POST | Smart routing (recommended), auto-selects optimal provider |
| `/api/generate` | POST | Generate with specified provider |
| `/v1/chat/completions` | POST | OpenAI-compatible API |
| `/v1/models` | GET | OpenAI-compatible model list |

### Management Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check (`?deep=true` for deep check) |
| `/metrics` | GET | Prometheus metrics |
| `/api/tags` | GET | Model list with metadata |
| `/api/quota` | GET | Quota status |
| `/api/quota/reset` | POST | Reset quota counters |
| `/api/cache/stats` | GET | Cache statistics |
| `/api/cache/clear` | POST | Clear cache |

### Direct Provider Access

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/claude` | POST | Direct Claude CLI access |
| `/gemini` | POST | Direct Gemini CLI access |
| `/codex` | POST | Direct Codex CLI access |
| `/ollama` | POST | Direct Ollama access |

## Usage Examples

### Basic Requests

```bash
# Smart routing (auto-selects provider)
curl -X POST http://localhost:8765/api/smart \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Explain what machine learning is"}'

# Specify provider
curl -X POST http://localhost:8765/api/generate \
  -H "Content-Type: application/json" \
  -d '{"provider": "claude", "prompt": "Hello"}'
```

### Streaming Responses

```bash
# Streaming request
curl -X POST http://localhost:8765/api/smart \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Write a poem", "stream": true}'

# OpenAI-compatible streaming
curl -X POST http://localhost:8765/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-opus-4-5",
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": true
  }'
```

### OpenAI Compatible

```bash
curl -X POST http://localhost:8765/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-opus-4-5",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "What is 2+2?"}
    ]
  }'
```

### Python Client

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8765/v1",
    api_key="not-needed"  # If API key not enabled
)

# Non-streaming
response = client.chat.completions.create(
    model="claude-opus-4-5",
    messages=[{"role": "user", "content": "Hello"}]
)
print(response.choices[0].message.content)

# Streaming
stream = client.chat.completions.create(
    model="gemini-3-flash-preview",
    messages=[{"role": "user", "content": "Write a poem"}],
    stream=True
)
for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")
```

## Provider Configuration

| Provider | Default Model | Weight | Streaming | Strengths |
|----------|---------------|--------|-----------|-----------|
| Claude | claude-opus-4-5 | 50% | Yes | Reasoning, code review, complex analysis |
| Gemini | gemini-3-flash-preview | 30% | Yes | Multimodal, 1M context window |
| Codex | gpt-5.2-codex | 15% | No | Code generation, tool calling |
| Ollama | qwen3:14b | 5% | Yes | Local privacy, unlimited quota |

### Supported Models

**Claude:**
- `claude-opus-4-5` - Most powerful reasoning (default)
- `claude-sonnet-4` - Balanced performance
- `claude-haiku-4` - Fast and lightweight

**Gemini:**
- `gemini-3-flash-preview` - Fast version (default)
- `gemini-3-pro-preview` - Most powerful reasoning
- `gemini-2.0-flash` - Stable alternative

**Codex:**
- `gpt-5.2-codex` - Latest version (default)
- `gpt-5.1-codex-max` - Long-running tasks
- `gpt-5.1-codex-mini` - Quota-efficient

**Ollama:**
- `qwen3:14b` - Default
- `qwen2.5:0.5b` - Fast and lightweight

## Monitoring & Observability

### Prometheus Metrics

```bash
curl http://localhost:8765/metrics
```

Available metrics:
- `llmux_requests_total` - Total request count
- `llmux_latency_seconds` - Latency statistics
- `llmux_tokens_total` - Token usage
- `llmux_cache_hits_total` - Cache hits
- `llmux_errors_total` - Error count
- `llmux_active_requests` - Active requests
- `llmux_uptime_seconds` - Server uptime

### Grafana Dashboard

After importing metrics, you can create:
- Request volume / error rate panels
- Provider latency comparison
- Cache hit rate trends
- Token usage statistics

### Health Checks

```bash
# Basic health check
curl http://localhost:8765/health

# Deep check (actually calls providers)
curl "http://localhost:8765/health?deep=true"
```

## API Key Authentication

### Enable Authentication

```bash
# Set environment variables
export API_KEY_REQUIRED=true
export ADMIN_KEY=your-admin-secret
export API_KEY=sk-default-key
```

### Manage API Keys

```bash
# Create new key
curl -X POST http://localhost:8765/admin/api-keys \
  -H "X-Admin-Key: your-admin-secret" \
  -H "Content-Type: application/json" \
  -d '{"userId": "user1", "projectId": "proj1"}'

# List all keys
curl http://localhost:8765/admin/api-keys \
  -H "X-Admin-Key: your-admin-secret"

# Delete key
curl -X DELETE http://localhost:8765/admin/api-keys/sk-xxxx \
  -H "X-Admin-Key: your-admin-secret"
```

### Using API Keys

```bash
curl -X POST http://localhost:8765/api/smart \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello"}'
```

## Cache Management

```bash
# View statistics
curl http://localhost:8765/api/cache/stats

# Clear cache
curl -X POST http://localhost:8765/api/cache/clear
```

Disable caching for specific requests:
```json
{"prompt": "...", "options": {"useCache": false}}
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Request                          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Key Auth Middleware                   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Response Cache Check                      │
│                    (SHA256 Hash Key)                         │
└──────────────────────────┬──────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
         Cache Hit                 Cache Miss
              │                         │
              ▼                         ▼
       Return Cached         ┌─────────────────────┐
                            │  Weighted Load       │
                            │  Balancer            │
                            └──────────┬──────────┘
                                       │
                ┌──────────────────────┼──────────────────────┐
                │                      │                      │
                ▼                      ▼                      ▼
        ┌───────────┐          ┌───────────┐          ┌───────────┐
        │  Claude   │          │  Gemini   │          │  Codex    │
        │  (50%)    │          │  (30%)    │          │  (15%)    │
        └─────┬─────┘          └─────┬─────┘          └─────┬─────┘
              │                      │                      │
              │         Retry with Exponential Backoff      │
              │                      │                      │
              └──────────────────────┼──────────────────────┘
                                     │
                                     ▼
                            ┌───────────────┐
                            │  Ollama       │
                            │  (Fallback)   │
                            └───────┬───────┘
                                    │
                                    ▼
                        ┌─────────────────────┐
                        │  Record Metrics     │
                        │  Update Cache       │
                        │  Return Response    │
                        └─────────────────────┘
```

## n8n Integration

Use the HTTP Request node in n8n:

```json
{
  "method": "POST",
  "url": "http://llmux:8765/api/smart",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": {
    "prompt": "{{ $json.text }}"
  }
}
```

## CLI Session Authentication

The unique advantage of LLMux is using CLI sessions instead of API keys:

1. Login on your local machine:
   ```bash
   claude --login
   codex login
   gemini --login
   ```

2. Session files are stored in:
   - Claude: `~/.claude/`
   - Codex: `~/.codex/`
   - Gemini: `~/.gemini/`

3. Mount these directories when deploying to containers

4. (Optional) For Codex with custom Ollama, copy and customize `config/codex.toml` to `~/.codex/config.toml`

**Benefits:**
- No API key management required
- Uses CLI free tier quotas
- More secure (credentials not persisted in config)

## Version History

### v3.0.0 (2026-01-27)
- Streaming response support (SSE)
- Response caching (LRU)
- Weighted load balancing
- Exponential backoff retry
- Prometheus metrics
- API key authentication
- Enhanced health checks
- Fixed duplicate route definitions

### v2.1.0 (2026-01-07)
- OpenAI-compatible API
- Gemini 3 support

### v2.0.0 (2026-01-07)
- Smart round-robin
- Quota management
- Latest model support

## License

MIT
