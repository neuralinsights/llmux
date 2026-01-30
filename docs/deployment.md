# LLMux Deployment Guide

> **Version**: 5.0.0
> **Last Updated**: 2026-01-30

This guide covers deploying LLMux in various environments.

## Prerequisites

- Node.js 18+ (LTS recommended)
- npm or yarn
- Access to at least one LLM provider (Claude, Gemini, Codex, or Ollama)

## Quick Start

### Local Development

```bash
# Clone repository
git clone https://github.com/neuralinsights/llmux.git
cd llmux

# Install dependencies
npm install

# Configure environment
cp config/.env.example .env
# Edit .env with your API keys

# Start development server
npm run dev
```

### Production with PM2

```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start src/index.js --name llmux

# Save PM2 configuration
pm2 save

# Setup startup script
pm2 startup
```

## Environment Configuration

Create a `.env` file with the following variables:

```bash
# Server Configuration
PORT=8765
NODE_ENV=production

# Provider API Keys
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AIza...
# Codex uses CLI authentication (no API key needed)
# Ollama runs locally (no API key needed)

# Default Settings
DEFAULT_PROVIDER=claude
API_KEY_REQUIRED=false

# Cache Configuration
CACHE_BACKEND=memory
CACHE_TTL=3600000
CACHE_MAX_SIZE=1000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100

# CORS Configuration
CORS_ORIGIN=*
# Or specific origins: CORS_ORIGIN=https://app.example.com,https://admin.example.com

# Ollama Configuration (if using local Ollama)
OLLAMA_URL=http://localhost:11434
```

## Docker Deployment

### Dockerfile

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY src ./src
COPY config ./config

ENV NODE_ENV=production
ENV PORT=8765

EXPOSE 8765

USER node

CMD ["node", "src/index.js"]
```

### Build and Run

```bash
# Build image
docker build -t llmux:5.0.0 .

# Run container
docker run -d \
  --name llmux \
  -p 8765:8765 \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -e GEMINI_API_KEY=AIza... \
  llmux:5.0.0
```

### Docker Compose

```yaml
version: '3.8'

services:
  llmux:
    build: .
    ports:
      - "8765:8765"
    environment:
      - NODE_ENV=production
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - DEFAULT_PROVIDER=claude
      - API_KEY_REQUIRED=true
      - CACHE_TTL=3600000
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8765/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Optional: Ollama for local inference
  ollama:
    image: ollama/ollama:latest
    volumes:
      - ollama_data:/root/.ollama
    ports:
      - "11434:11434"

volumes:
  ollama_data:
```

## Kubernetes Deployment

### Deployment Manifest

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: llmux
  labels:
    app: llmux
spec:
  replicas: 3
  selector:
    matchLabels:
      app: llmux
  template:
    metadata:
      labels:
        app: llmux
    spec:
      containers:
      - name: llmux
        image: llmux:5.0.0
        ports:
        - containerPort: 8765
        env:
        - name: ANTHROPIC_API_KEY
          valueFrom:
            secretKeyRef:
              name: llmux-secrets
              key: anthropic-api-key
        - name: GEMINI_API_KEY
          valueFrom:
            secretKeyRef:
              name: llmux-secrets
              key: gemini-api-key
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8765
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 8765
          initialDelaySeconds: 5
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: llmux
spec:
  selector:
    app: llmux
  ports:
  - port: 80
    targetPort: 8765
  type: ClusterIP
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: llmux
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - llmux.example.com
    secretName: llmux-tls
  rules:
  - host: llmux.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: llmux
            port:
              number: 80
```

### Create Secrets

```bash
kubectl create secret generic llmux-secrets \
  --from-literal=anthropic-api-key=sk-ant-... \
  --from-literal=gemini-api-key=AIza...
```

## Synology NAS Deployment

LLMux supports deployment on Synology NAS via Docker or direct Node.js installation.

### Using Container Manager (Docker)

1. Open Container Manager in DSM
2. Go to Registry and search for `llmux` (or build locally)
3. Create container with port mapping 8765:8765
4. Set environment variables in container settings

### Using Task Scheduler

```bash
# deploy-to-nas.sh
#!/bin/bash
rsync -avz --exclude node_modules --exclude .git . nas:/volume1/docker/llmux/
ssh nas "cd /volume1/docker/llmux && npm install && pm2 restart llmux"
```

## Monitoring

### Health Checks

```bash
# Basic health
curl http://localhost:8765/health

# Deep health (checks providers)
curl http://localhost:8765/health?deep=true
```

### Prometheus Integration

Add to `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'llmux'
    static_configs:
      - targets: ['llmux:8765']
    metrics_path: /metrics
```

### Grafana Dashboard

Key metrics to monitor:
- `llmux_requests_total` - Request rate by provider
- `llmux_latency_seconds` - Response latency
- `llmux_tokens_total` - Token usage
- `llmux_cache_hits_total` - Cache efficiency

## Security Considerations

### API Key Protection

1. **Never commit API keys** to version control
2. Use environment variables or secrets management
3. Enable `API_KEY_REQUIRED=true` in production

### Network Security

1. Use HTTPS in production (via reverse proxy)
2. Configure CORS to allowed origins only
3. Deploy behind a firewall/VPN for internal use

### Rate Limiting

Default: 100 requests/minute per client. Adjust via:
```bash
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100
```

## Scaling

### Horizontal Scaling

LLMux is stateless and can be scaled horizontally. For cache consistency across instances, consider:
- Redis cache backend (Phase 2 feature)
- Sticky sessions for cached responses

### Load Balancing

Use any standard load balancer (nginx, HAProxy, cloud LB):

```nginx
upstream llmux {
    least_conn;
    server llmux-1:8765;
    server llmux-2:8765;
    server llmux-3:8765;
}

server {
    listen 443 ssl;
    server_name llmux.example.com;

    location / {
        proxy_pass http://llmux;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Troubleshooting

### Common Issues

**Provider unavailable**
```bash
# Check provider health
curl http://localhost:8765/health?deep=true

# Reset provider cooldown
curl -X POST http://localhost:8765/api/quota/reset -d '{"provider":"claude"}'
```

**High memory usage**
```bash
# Clear cache
curl -X POST http://localhost:8765/api/cache/clear

# Reduce cache size
CACHE_MAX_SIZE=500
```

**Rate limiting issues**
```bash
# Check current limits in response headers
curl -I http://localhost:8765/v1/models
# Look for: RateLimit: limit=100, remaining=99, reset=60
```

### Logs

LLMux logs to stdout. Use your container/process manager to capture logs:

```bash
# PM2 logs
pm2 logs llmux

# Docker logs
docker logs -f llmux

# Kubernetes logs
kubectl logs -f deployment/llmux
```

## Related Documentation

- [Architecture](./architecture.md) - System design
- [API Reference](./api-reference.yaml) - OpenAPI specification
- [Contributing](../CONTRIBUTING.md) - Development guide
