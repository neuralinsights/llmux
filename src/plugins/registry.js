/**
 * LLMux - Plugin Registry
 * Manages plugin registration and hook execution
 */

class PluginRegistry {
    constructor() {
        this.plugins = new Map();
        this.hooks = {
            onRequest: [],
            onPrompt: [],
            onResponse: [],
            onError: [],
            onShutdown: []
        };
    }

    /**
     * Register a plugin
     * @param {Object} plugin - Plugin module
     * @param {Object} metadata - Plugin metadata (name, version)
     */
    register(plugin, metadata) {
        console.log(`[PLUGINS] Registering ${metadata.name} v${metadata.version}`);
        this.plugins.set(metadata.name, { ...metadata, module: plugin });

        // Register Hooks
        if (plugin.hooks) {
            for (const [hookName, handler] of Object.entries(plugin.hooks)) {
                if (this.hooks[hookName]) {
                    this.hooks[hookName].push({
                        pluginName: metadata.name,
                        handler
                    });
                }
            }
        }
    }

    /**
     * Execute a hook series
     * @param {string} hookName - Name of the hook
     * @param {Object} context - Execution context (e.g. req, res)
     * @param  {...any} args - Additional arguments
     */
    async executeHook(hookName, context, ...args) {
        // Try to resolve requestId for tracing
        let requestId = null;
        if (context) {
            if (context.req && context.req.inspectorId) requestId = context.req.inspectorId;
            else if (context.context && context.context.inspectorId) requestId = context.context.inspectorId; // context.context is the req object passed in onPrompt
        }

        if (requestId) {
            require('../telemetry/inspector').trace(requestId, 'PLUGIN_EXEC_START', { hook: hookName });
        }

        if (!this.hooks[hookName]) return;

        for (const { pluginName, handler } of this.hooks[hookName]) {
            try {
                if (requestId) {
                    require('../telemetry/inspector').trace(requestId, 'PLUGIN_RUN', { plugin: pluginName, hook: hookName });
                }
                await handler(context, ...args);
            } catch (err) {
                console.error(`[PLUGINS] Error in ${hookName} from ${pluginName}:`, err);
                if (requestId) {
                    require('../telemetry/inspector').trace(requestId, 'PLUGIN_ERROR', { plugin: pluginName, error: err.message });
                }
                // We generally continue executing other hooks even if one fails, generic error handling
            }
        }
    }
}

// Singleton
const registry = new PluginRegistry();
module.exports = registry;
