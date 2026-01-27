# LLMux v3.0.0 - LLM Multiplexer
# Multi-AI Provider HTTP Gateway
# Supports non-interactive mode for Claude Code, Codex, Gemini CLI
#
# Authentication: Session-based (Web Pro/Max account login)
# - Claude Code: ~/.claude/ (via volume mount)
# - Codex: ~/.codex/ (via volume mount)
# - Gemini CLI: ~/.gemini/ (via volume mount)

FROM node:20-alpine

# Install required tools
RUN apk add --no-cache git curl bash python3 make g++ tzdata

# Set working directory
WORKDIR /app

# Install AI CLI tools globally
RUN npm install -g @anthropic-ai/claude-code@latest \
    && npm install -g @openai/codex@latest \
    && npm install -g @google/gemini-cli@latest

# Install Express server dependencies
COPY package.json ./
RUN npm install --production

# Copy server code
COPY server.js ./

# Create required directories
RUN mkdir -p /root/.claude /root/.codex /root/.gemini /root/.config/gcloud \
    && chmod 700 /root/.claude /root/.codex /root/.gemini \
    && mkdir -p /app/logs /app/data /app/config

# Set environment variables
ENV HOME=/root
ENV NODE_ENV=production

# Expose HTTP port
EXPOSE 8765

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8765/health || exit 1

# Start server
CMD ["node", "server.js"]
