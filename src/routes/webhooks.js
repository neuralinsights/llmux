/**
 * LLMux - Webhook Management Routes
 */

const express = require('express');
const router = express.Router();
const { WebhookManager, EVENTS } = require('../integrations/webhooks');

// Register a webhook
router.post('/', async (req, res) => {
    try {
        const { event, url, secret } = req.body;

        // Validate event
        if (!Object.values(EVENTS).includes(event)) {
            return res.status(400).json({ error: 'Invalid event type' });
        }

        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        // Use current tenant from auth (or 'system' if admin)
        const tenantId = req.tenantId || 'system';

        const webhook = await WebhookManager.register(tenantId, event, url, secret);
        res.status(201).json(webhook);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/events', (req, res) => {
    res.json({ events: Object.values(EVENTS) });
});

module.exports = router;
