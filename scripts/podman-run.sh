#!/bin/bash
# LLMux - Podman Run Script
# For Podman / Podman Desktop

set -e

# Default configuration
IMAGE_NAME="${IMAGE_NAME:-llmux:3.0.0}"
CONTAINER_NAME="${CONTAINER_NAME:-llmux}"
PORT="${PORT:-8765}"
DEFAULT_PROVIDER="${DEFAULT_PROVIDER:-claude}"

# Podman host access varies by platform
# macOS: host.containers.internal
# Linux: use host network or podman network
if [[ "$OSTYPE" == "darwin"* ]]; then
    OLLAMA_HOST="${OLLAMA_HOST:-http://host.containers.internal:11434}"
else
    OLLAMA_HOST="${OLLAMA_HOST:-http://localhost:11434}"
fi

# Session paths
CLAUDE_SESSION="${CLAUDE_SESSION:-$HOME/.claude}"
CODEX_SESSION="${CODEX_SESSION:-$HOME/.codex}"
GEMINI_SESSION="${GEMINI_SESSION:-$HOME/.gemini}"
GCLOUD_CONFIG="${GCLOUD_CONFIG:-$HOME/.config/gcloud}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
print_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check Podman
if ! command -v podman &> /dev/null; then
    print_error "Podman not installed"
    exit 1
fi

# Build image
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if ! podman image exists "$IMAGE_NAME" 2>/dev/null; then
    print_info "Building image $IMAGE_NAME ..."
    podman build -t "$IMAGE_NAME" "$SCRIPT_DIR/.."
fi

# Stop old container
if podman ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    print_info "Stopping old container..."
    podman rm -f "$CONTAINER_NAME" > /dev/null 2>&1 || true
fi

# Build volume arguments
VOLUME_ARGS=""
if [ -d "$CLAUDE_SESSION" ]; then
    VOLUME_ARGS="$VOLUME_ARGS -v $CLAUDE_SESSION:/root/.claude:ro"
    print_info "Mounting Claude session: $CLAUDE_SESSION"
fi

if [ -d "$CODEX_SESSION" ]; then
    VOLUME_ARGS="$VOLUME_ARGS -v $CODEX_SESSION:/root/.codex:ro"
fi

if [ -d "$GEMINI_SESSION" ]; then
    VOLUME_ARGS="$VOLUME_ARGS -v $GEMINI_SESSION:/root/.gemini:ro"
fi

if [ -d "$GCLOUD_CONFIG" ]; then
    VOLUME_ARGS="$VOLUME_ARGS -v $GCLOUD_CONFIG:/root/.config/gcloud:ro"
fi

# Run container
print_info "Starting container..."
podman run -d \
    --name "$CONTAINER_NAME" \
    --restart unless-stopped \
    -p "$PORT:8765" \
    -e OLLAMA_HOST="$OLLAMA_HOST" \
    -e DEFAULT_PROVIDER="$DEFAULT_PROVIDER" \
    -e TZ="${TZ:-UTC}" \
    -e CACHE_TTL="${CACHE_TTL:-3600000}" \
    -e API_KEY_REQUIRED="${API_KEY_REQUIRED:-false}" \
    $VOLUME_ARGS \
    "$IMAGE_NAME"

sleep 3

if curl -sf "http://localhost:$PORT/health" > /dev/null 2>&1; then
    print_info "Service started: http://localhost:$PORT"
else
    print_warn "Service starting..."
    podman logs "$CONTAINER_NAME" --tail 20
fi
