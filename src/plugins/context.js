/**
 * LLMux - Plugin Context
 * Provides safe API access to plugins
 */

const { getDatabase } = require('../db');
// We might import logger or metrics here

function createPluginContext(pluginName) {
    return {
        // Logger with plugin context
        logger: {
            info: (msg) => console.log(`[PLUGIN:${pluginName}] ${msg}`),
            error: (msg, err) => console.error(`[PLUGIN:${pluginName}] ${msg}`, err),
            warn: (msg) => console.warn(`[PLUGIN:${pluginName}] ${msg}`),
        },

        // Read-only access to some config?
        config: {
            // Expose safe config
        },

        // Database access (maybe restricted in future)
        db: getDatabase(),

        // Prometheus metrics helper could go here
        metrics: {
            // ...
        }
    };
}

module.exports = { createPluginContext };
