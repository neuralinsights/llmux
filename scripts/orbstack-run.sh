#!/bin/bash
# LLMux - OrbStack (macOS) Run Script
# OrbStack is a fast Docker/Linux runtime for macOS

set -e

IMAGE_NAME="${IMAGE_NAME:-llmux:3.0.0}"
CONTAINER_NAME="${CONTAINER_NAME:-llmux}"
PORT="${PORT:-8765}"
DEFAULT_PROVIDER="${DEFAULT_PROVIDER:-claude}"

# OrbStack uses host.orb.local or host.docker.internal
OLLAMA_HOST="${OLLAMA_HOST:-http://host.docker.internal:11434}"

CLAUDE_SESSION="${CLAUDE_SESSION:-$HOME/.claude}"
CODEX_SESSION="${CODEX_SESSION:-$HOME/.codex}"
GEMINI_SESSION="${GEMINI_SESSION:-$HOME/.gemini}"
GCLOUD_CONFIG="${GCLOUD_CONFIG:-$HOME/.config/gcloud}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
print_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check Docker (provided by OrbStack)
if ! command -v docker &> /dev/null; then
    print_error "Docker not installed. Please install OrbStack: https://orbstack.dev"
    exit 1
fi

# Check if OrbStack
if docker info 2>/dev/null | grep -q "orbstack"; then
    print_info "OrbStack environment detected"
fi

# Build image
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ "$(docker images -q $IMAGE_NAME 2> /dev/null)" == "" ]]; then
    print_info "Building image $IMAGE_NAME ..."
    docker build -t "$IMAGE_NAME" "$SCRIPT_DIR/.."
fi

# Stop old container
docker rm -f "$CONTAINER_NAME" > /dev/null 2>&1 || true

# Build volume arguments
VOLUME_ARGS=""
[ -d "$CLAUDE_SESSION" ] && VOLUME_ARGS="$VOLUME_ARGS -v $CLAUDE_SESSION:/root/.claude:ro"
[ -d "$CODEX_SESSION" ] && VOLUME_ARGS="$VOLUME_ARGS -v $CODEX_SESSION:/root/.codex:ro"
[ -d "$GEMINI_SESSION" ] && VOLUME_ARGS="$VOLUME_ARGS -v $GEMINI_SESSION:/root/.gemini:ro"
[ -d "$GCLOUD_CONFIG" ] && VOLUME_ARGS="$VOLUME_ARGS -v $GCLOUD_CONFIG:/root/.config/gcloud:ro"

print_info "Starting container (OrbStack)..."
docker run -d \
    --name "$CONTAINER_NAME" \
    --restart unless-stopped \
    -p "$PORT:8765" \
    -e OLLAMA_HOST="$OLLAMA_HOST" \
    -e DEFAULT_PROVIDER="$DEFAULT_PROVIDER" \
    -e TZ="${TZ:-UTC}" \
    $VOLUME_ARGS \
    "$IMAGE_NAME"

sleep 2
if curl -sf "http://localhost:$PORT/health" > /dev/null 2>&1; then
    print_info "Service started: http://localhost:$PORT"
    # OrbStack feature: can access via .orb.local domain
    print_info "OrbStack domain: http://${CONTAINER_NAME}.orb.local:8765"
else
    print_warn "Service starting..."
fi
