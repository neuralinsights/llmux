/**
 * LLMux - SQLite Database Adapter
 * SQLite implementation for local/single-node deployments
 */

const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const DatabaseAdapter = require('./adapter');

class SqliteAdapter extends DatabaseAdapter {
    constructor(config = {}) {
        super(config);
        this.dbPath = config.path || path.join(process.cwd(), 'data', 'llmux.db');
        this.db = null;
    }

    async connect() {
        try {
            // Ensure data directory exists
            const dataDir = path.dirname(this.dbPath);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }

            this.db = new Database(this.dbPath);
            this.db.pragma('journal_mode = WAL'); // Better concurrency
            this.connected = true;
            console.log(`[DB] Connected to SQLite at ${this.dbPath}`);

            await this.initSchema();
        } catch (error) {
            console.error('[DB] Failed to connect to SQLite:', error);
            throw error;
        }
    }

    async disconnect() {
        if (this.db) {
            this.db.close();
            this.connected = false;
            console.log('[DB] Disconnected from SQLite');
        }
    }

    async initSchema() {
        if (!this.db) return;

        // Tenants Table
        this.db.prepare(`
      CREATE TABLE IF NOT EXISTS tenants (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        plan TEXT DEFAULT 'free',
        config TEXT, -- JSON string
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `).run();

        // API Keys Table
        this.db.prepare(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        key_hash TEXT NOT NULL, -- Storing hash in production, but for now simple secret storage for simplicity 
        key_secret TEXT, -- NOTE: In real prod, store generic hash. Here storing plain for ease of prototype if needed, but we'll stick to simple "secret" column acting as the key itself for lookup.
        name TEXT,
        scopes TEXT, -- JSON array
        last_used_at INTEGER,
        created_at INTEGER NOT NULL,
        expires_at INTEGER,
        is_active INTEGER DEFAULT 1,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      )
    `).run();

        // Index for fast key lookup
        this.db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_api_keys_secret ON api_keys(key_secret)
    `).run();

        // Webhooks Table
        this.db.prepare(`
      CREATE TABLE IF NOT EXISTS webhooks (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        event TEXT NOT NULL,
        url TEXT NOT NULL,
        secret TEXT,
        created_at INTEGER NOT NULL
      )
    `).run();
    }

    // --- Webhook Operations ---

    async createWebhook({ tenantId, event, url, secret }) {
        const id = uuidv4();
        const now = Date.now();
        const stmt = this.db.prepare(`
      INSERT INTO webhooks (id, tenant_id, event, url, secret, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

        stmt.run(id, tenantId, event, url, secret || '', now);
        return { id, tenantId, event, url, created_at: now };
    }

    async listWebhooks(event, tenantId = null) {
        let query = 'SELECT * FROM webhooks WHERE event = ?';
        const params = [event];

        if (tenantId) {
            query += ' AND (tenant_id = ? OR tenant_id = "system")';
            params.push(tenantId);
        } else {
            // Global events, maybe just system
            // Simplify: Just return all matching event for now + generic filter
        }

        const stmt = this.db.prepare(query);
        return stmt.all(...params);
    }

    // --- Tenant Operations ---

    async createTenant(tenantData) {
        const id = uuidv4();
        const now = Date.now();
        const stmt = this.db.prepare(`
      INSERT INTO tenants (id, name, description, plan, config, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

        stmt.run(
            id,
            tenantData.name,
            tenantData.description || null,
            tenantData.plan || 'free',
            JSON.stringify(tenantData.config || {}),
            now,
            now
        );

        return this.getTenant(id);
    }

    async getTenant(tenantId) {
        const stmt = this.db.prepare('SELECT * FROM tenants WHERE id = ?');
        const tenant = stmt.get(tenantId);
        if (!tenant) return null;

        return {
            ...tenant,
            config: JSON.parse(tenant.config),
        };
    }

    async updateTenant(tenantId, updateData) {
        const keys = Object.keys(updateData).filter(k => k !== 'id' && k !== 'created_at');
        if (keys.length === 0) return this.getTenant(tenantId);

        const sets = keys.map(k => `${k} = ?`).join(', ');
        const values = keys.map(k => {
            if (k === 'config') return JSON.stringify(updateData[k]);
            return updateData[k];
        });

        values.push(Date.now());
        values.push(tenantId);

        const stmt = this.db.prepare(`UPDATE tenants SET ${sets}, updated_at = ? WHERE id = ?`);
        stmt.run(...values);

        return this.getTenant(tenantId);
    }

    async deleteTenant(tenantId) {
        const stmt = this.db.prepare('DELETE FROM tenants WHERE id = ?');
        const result = stmt.run(tenantId);
        return result.changes > 0;
    }

    async listTenants(options = {}) {
        // Basic listing without pagination for verification phase
        const stmt = this.db.prepare('SELECT * FROM tenants ORDER BY created_at DESC');
        const tenants = stmt.all();
        return tenants.map(t => ({ ...t, config: JSON.parse(t.config) }));
    }

    // --- API Key Operations ---

    async createApiKey(tenantId, keyData) {
        const id = uuidv4();
        // In a real app, generate a secure random string like 'sk-...'
        // For now, using UUID-like format or provided strict
        const secret = `sk-${uuidv4().replace(/-/g, '')}`;
        const now = Date.now();

        const stmt = this.db.prepare(`
      INSERT INTO api_keys (id, tenant_id, key_secret, key_hash, name, scopes, created_at, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `);

        // We store secret in key_secret for lookup. key_hash is placeholder for future.
        stmt.run(
            id,
            tenantId,
            secret,
            'TODO_HASH',
            keyData.name || 'Default Key',
            JSON.stringify(keyData.scopes || []),
            now
        );

        return {
            id,
            key: secret,
            ...keyData,
            tenantId
        };
    }

    async getApiKey(keySecret) {
        const stmt = this.db.prepare('SELECT * FROM api_keys WHERE key_secret = ? AND is_active = 1');
        const key = stmt.get(keySecret);
        if (!key) return null;

        return {
            ...key,
            scopes: JSON.parse(key.scopes),
        };
    }
}

module.exports = SqliteAdapter;
