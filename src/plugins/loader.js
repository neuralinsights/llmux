/**
 * LLMux - Plugin Loader
 * Discovers and initializes plugins
 */

const fs = require('fs');
const path = require('path');
const registry = require('./registry');
const { createPluginContext } = require('./context');

const PLUGINS_DIR = path.join(__dirname, '../../plugins');

class PluginLoader {
    /**
     * Load all plugins
     */
    static async loadAll() {
        console.log('[PLUGINS] Loading plugins...');

        // 1. Ensure plugins dir exists
        if (!fs.existsSync(PLUGINS_DIR)) {
            console.log('[PLUGINS] No local plugins directory found.');
            return;
        }

        // 2. Scan directory
        const entries = fs.readdirSync(PLUGINS_DIR, { withFileTypes: true });

        for (const entry of entries) {
            if (entry.isDirectory()) {
                await this.loadPlugin(path.join(PLUGINS_DIR, entry.name));
            }
        }
    }

    static async loadPlugin(pluginPath) {
        try {
            // Look for index.js or main file defined in package.json
            let mainFile = 'index.js';
            let packageJson = {};

            if (fs.existsSync(path.join(pluginPath, 'package.json'))) {
                packageJson = require(path.join(pluginPath, 'package.json'));
                if (packageJson.main) mainFile = packageJson.main;
            } else {
                // Fallback minimal metadata if no package.json
                packageJson = { name: path.basename(pluginPath), version: '0.0.0' };
            }

            const pluginModule = require(pluginPath); // simple require works if it resolves main

            const context = createPluginContext(packageJson.name);

            // Initialize
            if (pluginModule.init) {
                await pluginModule.init(context);
            }

            // Register
            registry.register(pluginModule, {
                name: packageJson.name,
                version: packageJson.version,
                description: packageJson.description
            });

        } catch (err) {
            console.error(`[PLUGINS] Failed to load plugin at ${pluginPath}:`, err.message);
        }
    }
}

module.exports = PluginLoader;
