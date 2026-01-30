# LLMux Documentation

> **Version**: 3.0.0
> **Last Updated**: 2026-01-30

Welcome to the LLMux documentation. LLMux is a unified AI CLI HTTP gateway that provides intelligent routing across multiple LLM providers.

## Documentation Index

### Getting Started
- **[README](../README.md)** - Quick start guide and installation
- **[Deployment Guide](./deployment.md)** - Production deployment instructions

### Technical Reference
- **[Architecture](./architecture.md)** - System design and module structure
- **[API Reference](./api-reference.yaml)** - OpenAPI 3.0 specification

### Contributing
- **[Contributing Guide](../CONTRIBUTING.md)** - How to contribute to LLMux
- **[Security Policy](../SECURITY.md)** - Vulnerability reporting guidelines

## Quick Links

| Endpoint | Description |
|----------|-------------|
| `POST /api/smart` | Smart routing (recommended) |
| `POST /api/generate` | Specify provider directly |
| `POST /v1/chat/completions` | OpenAI-compatible API |
| `GET /v1/models` | List available models |
| `GET /health` | Health check |
| `GET /metrics` | Prometheus metrics |

## Supported Providers

| Provider | Default Model | Weight |
|----------|---------------|--------|
| Claude | claude-sonnet-4-20250514 | 30% |
| Gemini | gemini-2.5-flash | 25% |
| Codex | codex-1 | 25% |
| Ollama | qwen3:32b | 20% |

## License

MIT License - See [LICENSE](../LICENSE) for details.
