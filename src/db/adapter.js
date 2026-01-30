/**
 * LLMux - Database Adapter Interface
 * Base class for all database storage backends
 */

class DatabaseAdapter {
    constructor(config = {}) {
        this.config = config;
        this.connected = false;
    }

    /**
     * Connect to the database
     * @returns {Promise<void>}
     */
    async connect() {
        throw new Error('Method not implemented: connect');
    }

    /**
     * Disconnect from the database
     * @returns {Promise<void>}
     */
    async disconnect() {
        throw new Error('Method not implemented: disconnect');
    }

    /**
     * Initialize database schema (tables, indexes)
     * @returns {Promise<void>}
     */
    async initSchema() {
        throw new Error('Method not implemented: initSchema');
    }

    // --- Tenant Operations ---

    /**
     * Create a new tenant
     * @param {Object} tenantData - Tenant data (name, plan, config)
     * @returns {Promise<Object>} Created tenant
     */
    async createTenant(tenantData) {
        throw new Error('Method not implemented: createTenant');
    }

    /**
     * Get a tenant by ID
     * @param {string} tenantId - Tenant ID
     * @returns {Promise<Object>} Tenant object or null
     */
    async getTenant(tenantId) {
        throw new Error('Method not implemented: getTenant');
    }

    /**
     * Update a tenant
     * @param {string} tenantId - Tenant ID
     * @param {Object} updateData - Data to update
     * @returns {Promise<Object>} Updated tenant
     */
    async updateTenant(tenantId, updateData) {
        throw new Error('Method not implemented: updateTenant');
    }

    /**
     * Delete a tenant
     * @param {string} tenantId - Tenant ID
     * @returns {Promise<boolean>} True if deleted
     */
    async deleteTenant(tenantId) {
        throw new Error('Method not implemented: deleteTenant');
    }

    /**
     * List tenants
     * @param {Object} options - Pagination/filter options
     * @returns {Promise<Array>} List of tenants
     */
    async listTenants(options = {}) {
        throw new Error('Method not implemented: listTenants');
    }

    // --- API Key Operations ---

    /**
     * Create an API key for a tenant
     * @param {string} tenantId - Tenant ID
     * @param {Object} keyData - Key data (name, scopes, limits)
     * @returns {Promise<Object>} Created key object (with secret)
     */
    async createApiKey(tenantId, keyData) {
        throw new Error('Method not implemented: createApiKey');
    }

    /**
     * Get API key details by the key string (secret)
     * @param {string} keySecret - API Key secret
     * @returns {Promise<Object>} Key object or null
     */
    async getApiKey(keySecret) {
        throw new Error('Method not implemented: getApiKey');
    }

    /**
     * Revoke (delete/disable) an API key
     * @param {string} keyId - API Key ID
     * @returns {Promise<boolean>} True if revoked
     */
    async revokeApiKey(keyId) {
        throw new Error('Method not implemented: revokeApiKey');
    }

    /**
     * List API keys for a tenant
     * @param {string} tenantId - Tenant ID
     * @returns {Promise<Array>} List of keys
     */
    async listApiKeys(tenantId) {
        throw new Error('Method not implemented: listApiKeys');
    }
}

module.exports = DatabaseAdapter;
