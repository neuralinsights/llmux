/**
 * LLMux - Tenant Management Routes
 * Admin API for managing tenants and keys
 */

const express = require('express');
const router = express.Router();
const Tenant = require('../models/tenant');
const ApiKey = require('../models/apiKey');
const { v4: uuidv4 } = require('uuid');

// Middleware to ensure admin access (checks for root API key)
const requireAdmin = (req, res, next) => {
    // In a real app, this would check a specific role or a root key
    // For now, we assume if you can hit this endpoint via internal network or with root key, you are admin
    // This is a placeholder for actual admin auth logic
    // Check headers: X-API-Key OR Authorization: Bearer <key>
    let apiKey = req.headers['x-api-key'] || req.query.key;

    if (!apiKey && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        apiKey = req.headers.authorization.slice(7);
    }

    if (process.env.LLM_API_KEY && apiKey === process.env.LLM_API_KEY) {
        return next();
    }

    // Allow if auth is disabled globally (dev mode)
    if (process.env.API_KEY_REQUIRED === 'false') {
        return next();
    }

    return res.status(403).json({ error: 'Admin access required' });
};

router.use(requireAdmin);

// Create Tenant
router.post('/', async (req, res) => {
    try {
        const tenant = await Tenant.create({
            name: req.body.name,
            description: req.body.description,
            plan: req.body.plan,
            config: req.body.config
        });
        res.status(201).json(tenant);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// List Tenants
router.get('/', async (req, res) => {
    try {
        const tenants = await Tenant.list();
        res.json(tenants);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Tenant
router.get('/:id', async (req, res) => {
    try {
        const tenant = await Tenant.findById(req.params.id);
        if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
        res.json(tenant);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create API Key for Tenant
router.post('/:id/keys', async (req, res) => {
    try {
        const tenant = await Tenant.findById(req.params.id);
        if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

        const key = await ApiKey.create(tenant.id, {
            name: req.body.name,
            scopes: req.body.scopes
        });
        res.status(201).json(key);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
