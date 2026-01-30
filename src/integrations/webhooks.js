/**
 * LLMux - Webhook Manager
 * Dispatches system events to registered webhooks
 */

// const axios = require('axios'); // Removed, using fetch
const { getDatabase } = require('../db');

// Events
const EVENTS = {
    QUOTA_EXCEEDED: 'quota_exceeded',
    CIRCUIT_OPEN: 'circuit_open',
    TENANT_CREATED: 'tenant_created',
    API_KEY_CREATED: 'api_key_created',
};

class WebhookManager {
    /**
     * Register a new webhook
     * @param {string} tenantId - Tenant ID (or 'system')
     * @param {string} event - Event name
     * @param {string} url - Callback URL
     * @param {string} [secret] - Optional secret for signature
     */
    static async register(tenantId, event, url, secret) {
        // Persistent storage via DB would go here
        // For now we will mock it or if DB supports it, use it.
        // Let's assume we extended DB adapter.
        const db = getDatabase();
        if (db.createWebhook) {
            return db.createWebhook({ tenantId, event, url, secret });
        }
        console.warn('[WEBHOOK] DB adapter does not support webhooks yet');
        return null;
    }

    /**
     * Trigger an event
     * @param {string} event - Event name
     * @param {Object} payload - Event payload
     * @param {string} [tenantId] - Specific tenant context
     */
    static async trigger(event, payload, tenantId = null) {
        if (!process.env.WEBHOOKS_ENABLED && process.env.WEBHOOKS_ENABLED !== 'true') return;

        // Fetch webhooks for this event
        const db = getDatabase();
        let hooks = [];
        if (db.listWebhooks) {
            hooks = await db.listWebhooks(event, tenantId);
        }

        if (hooks.length === 0) return;

        console.log(`[WEBHOOK] Triggering ${event} for ${hooks.length} hooks`);

        // Dispatch async
        hooks.forEach(hook => {
            this.sendPayload(hook, payload).catch(err => {
                console.error(`[WEBHOOK] Failed to send to ${hook.url}:`, err.message);
            });
        });
    }

    static async sendPayload(hook, payload) {
        // In Node 18, fetch is available globally.
        const response = await fetch(hook.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-LLMux-Event': hook.event,
                'X-LLMux-Signature': 'TODO-HMAC' // Implement HMAC signature
            },
            body: JSON.stringify({
                id: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
                event: hook.event,
                payload
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
    }
}

module.exports = {
    WebhookManager,
    EVENTS
};
