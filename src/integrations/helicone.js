/**
 * LLMux - Helicone Integration
 * Enhances requests with Helicone headers for observability and caching
 */

const { v4: uuidv4 } = require('uuid');

const HELICONE_CONFIG = {
    enabled: process.env.HELICONE_ENABLED === 'true',
    apiKey: process.env.HELICONE_API_KEY,
    cacheEnabled: process.env.HELICONE_CACHE_ENABLED === 'true',
    retryEnabled: process.env.HELICONE_RETRY_ENABLED === 'true',
    propertyPrefix: 'Helicone-Property-',
};

/**
 * Get headers for Helicone integration
 * @param {Object} options - Request options
 * @param {Object} [options.metadata] - Custom metadata/properties
 * @param {string} [options.userId] - User ID
 * @param {string} [options.sessionId] - Session ID
 * @returns {Object} Headers object
 */
function getHeliconeHeaders(options = {}) {
    if (!HELICONE_CONFIG.enabled || !HELICONE_CONFIG.apiKey) {
        return {};
    }

    const headers = {
        'Helicone-Auth': `Bearer ${HELICONE_CONFIG.apiKey}`,
    };

    // Feature Flags
    if (HELICONE_CONFIG.cacheEnabled) {
        headers['Helicone-Cache-Enabled'] = 'true';
    }

    if (HELICONE_CONFIG.retryEnabled) {
        headers['Helicone-Retry-Enabled'] = 'true';
    }

    // User/Session Context
    if (options.userId) {
        headers['Helicone-User-Id'] = options.userId;
    }

    if (options.sessionId) {
        headers['Helicone-Session-Id'] = options.sessionId;
    }

    // Custom Properties
    if (options.metadata) {
        Object.entries(options.metadata).forEach(([key, value]) => {
            // sanitize key to be header-safe
            const safeKey = key.replace(/[^a-zA-Z0-9-_]/g, '-');
            headers[`${HELICONE_CONFIG.propertyPrefix}${safeKey}`] = String(value);
        });
    }

    return headers;
}

/**
 * Check if Helicone is enabled
 */
function isHeliconeEnabled() {
    return HELICONE_CONFIG.enabled && !!HELICONE_CONFIG.apiKey;
}

module.exports = {
    getHeliconeHeaders,
    isHeliconeEnabled,
    HELICONE_CONFIG
};
