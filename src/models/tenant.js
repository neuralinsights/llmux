/**
 * LLMux - Tenant Model
 * Business logic for Tenant management
 */

const { getDatabase } = require('../db');

class Tenant {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.description = data.description;
        this.plan = data.plan;
        this.config = data.config;
        this.createdAt = data.created_at;
    }

    static async create(data) {
        if (!data.name) {
            throw new Error('Tenant name is required');
        }
        const db = getDatabase();
        return db.createTenant(data);
    }

    static async findById(id) {
        const db = getDatabase();
        return db.getTenant(id);
    }

    static async list() {
        const db = getDatabase();
        return db.listTenants();
    }

    static async delete(id) {
        const db = getDatabase();
        return db.deleteTenant(id);
    }
}

module.exports = Tenant;
