/**
 * LLMux - API Key Model
 * Business logic for API Key management
 */

const { getDatabase } = require('../db');

class ApiKey {
    static async create(tenantId, data) {
        const db = getDatabase();
        return db.createApiKey(tenantId, data);
    }

    static async verify(secret) {
        const db = getDatabase();
        const key = await db.getApiKey(secret);
        if (!key) return null;
        return key;
    }
}

module.exports = ApiKey;
