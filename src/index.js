/**
 * LLMux v3.0.0 - LLM Multiplexer
 * Unified AI CLI HTTP gateway
 *
 * Entry point for the application
 */

const { app, initializeCache } = require('./app');
const { env, PROVIDER_CONFIG } = require('./config');
const { initializeDatabase, getDatabase } = require('./db');
const { initializeOtel } = require('./telemetry/otelSetup');
const PluginLoader = require('./plugins/loader');

/**
 * Start the server
 */
async function main() {
  try {
    // Initialize OpenTelemetry
    await initializeOtel({ serviceName: 'llmux-service' });

    // Initialize Database
    await initializeDatabase();
    console.log(`[INIT] Database initialized (backend: ${process.env.DB_BACKEND || 'sqlite'})`);

    // Load Plugins
    await PluginLoader.loadAll();

    // Initialize cache
    await initializeCache();
    console.log(`[INIT] Cache initialized (backend: ${env.CACHE_BACKEND})`);

    // Start HTTP server
    app.listen(env.PORT, '0.0.0.0', () => {
      console.log(`
╔═══════════════════════════════════════════════════════════════════════════╗
║                         LLMux v3.0.0 - LLM Multiplexer                    ║
║     Streaming | Smart Cache | Weighted Load Balancing | Prometheus | Auth ║
╠═══════════════════════════════════════════════════════════════════════════╣
║  Port: ${String(env.PORT).padEnd(68)}║
║  Default Provider: ${env.DEFAULT_PROVIDER.padEnd(55)}║
║  API Key Required: ${String(env.API_KEY_REQUIRED).padEnd(55)}║
║  Cache TTL: ${String(env.CACHE_TTL / 1000) + 's'.padEnd(62)}║
╠═══════════════════════════════════════════════════════════════════════════╣
║  Provider Configuration (Weighted Load Balancing):                        ║
║    Claude:  ${PROVIDER_CONFIG.claude.defaultModel.padEnd(30)} Weight: ${String(PROVIDER_CONFIG.claude.weight) + '%'.padEnd(10)}║
║    Gemini:  ${PROVIDER_CONFIG.gemini.defaultModel.padEnd(30)} Weight: ${String(PROVIDER_CONFIG.gemini.weight) + '%'.padEnd(10)}║
║    Codex:   ${PROVIDER_CONFIG.codex.defaultModel.padEnd(30)} Weight: ${String(PROVIDER_CONFIG.codex.weight) + '%'.padEnd(10)}║
║    Ollama:  ${PROVIDER_CONFIG.ollama.defaultModel.padEnd(30)} Weight: ${String(PROVIDER_CONFIG.ollama.weight) + '%'.padEnd(10)}║
╠═══════════════════════════════════════════════════════════════════════════╣
║  API Endpoints:                                                           ║
║    POST /api/smart          - Smart routing (recommended, streaming)      ║
║    POST /api/generate       - Specify provider (streaming supported)      ║
║    POST /v1/chat/completions - OpenAI compatible (streaming supported)    ║
║    GET  /v1/models          - OpenAI model list                           ║
║    GET  /health             - Health check (?deep=true for deep check)    ║
║    GET  /metrics            - Prometheus metrics                          ║
║    GET  /api/tags           - Model list                                  ║
║    GET  /api/quota          - Quota status                                ║
║    POST /api/quota/reset    - Reset quota                                 ║
║    GET  /api/cache/stats    - Cache statistics                            ║
║    POST /api/cache/clear    - Clear cache                                 ║
╚═══════════════════════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('[FATAL] Failed to start server:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('[FATAL] Uncaught exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[SHUTDOWN] Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[SHUTDOWN] Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

// Run main
main();
