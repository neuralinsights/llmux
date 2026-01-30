/**
 * LLMux - Authentication Middleware
 * API Key authentication and management
 */

const { v4: uuidv4 } = require('uuid');
const { env } = require('../config/env');

/**
 * In-memory API key store
 * In production, replace with database
 */
const API_KEYS = new Map();

// Initialize default API key from environment
if (env.API_KEY) {
  API_KEYS.set(env.API_KEY, {
    userId: 'default',
    projectId: 'default',
    createdAt: new Date().toISOString(),
  });
}

/**
 * Endpoints that don't require authentication
 */
const PUBLIC_ENDPOINTS = [
  '/health',
  '/metrics',
  '/api/tags',
  '/v1/models',
];

/**
 * API Key authentication middleware
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
async function authMiddleware(req, res, next) {
  // Public endpoints don't require authentication
  if (PUBLIC_ENDPOINTS.includes(req.path)) {
    return next();
  }

  // Skip auth if not required
  if (!env.API_KEY_REQUIRED) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Missing API key. Use Authorization: Bearer <key>',
    });
  }

  const key = authHeader.slice(7);

  // 1. Check Legacy/Env Keys
  let keyInfo = API_KEYS.get(key);

  // 2. Check Database Keys
  if (!keyInfo) {
    try {
      const ApiKey = require('../models/apiKey');
      const dbKey = await ApiKey.verify(key);
      if (dbKey) {
        keyInfo = {
          userId: dbKey.tenant_id, // Map tenant_id to userId for now
          projectId: 'tenant-project',
          scopes: dbKey.scopes,
          tenantId: dbKey.tenant_id
        };
      }
    } catch (err) {
      console.error('Auth DB check failed', err);
    }
  }

  if (!keyInfo) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  // Attach user info to request
  req.userId = keyInfo.userId;
  req.projectId = keyInfo.projectId;
  req.tenantId = keyInfo.tenantId; // Attach tenantId
  next();
}

/**
 * Admin authentication middleware
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
function adminAuthMiddleware(req, res, next) {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Invalid admin key' });
  }
  next();
}

/**
 * Generate a new API key
 * @param {string} userId - User identifier
 * @param {string} projectId - Project identifier
 * @returns {{apiKey: string, info: Object}}
 */
function generateApiKey(userId = 'default', projectId = 'default') {
  const newKey = `llmux_${uuidv4().replace(/-/g, '')}`;
  const info = {
    userId,
    projectId,
    createdAt: new Date().toISOString(),
  };

  API_KEYS.set(newKey, info);

  return { apiKey: newKey, info };
}

/**
 * Get all API keys (masked for security)
 * @returns {Array<Object>}
 */
function listApiKeys() {
  const keys = [];
  for (const [key, info] of API_KEYS) {
    keys.push({
      key: key.slice(0, 8) + '...' + key.slice(-4),
      ...info,
    });
  }
  return keys;
}

/**
 * Delete an API key
 * @param {string} key - API key to delete
 * @returns {boolean} True if deleted
 */
function deleteApiKey(key) {
  return API_KEYS.delete(key);
}

/**
 * Check if an API key exists
 * @param {string} key - API key to check
 * @returns {boolean}
 */
function hasApiKey(key) {
  return API_KEYS.has(key);
}

/**
 * Get API key info
 * @param {string} key - API key
 * @returns {Object|null}
 */
function getApiKeyInfo(key) {
  return API_KEYS.get(key) || null;
}

module.exports = {
  authMiddleware,
  adminAuthMiddleware,
  generateApiKey,
  listApiKeys,
  deleteApiKey,
  hasApiKey,
  getApiKeyInfo,
  API_KEYS,
  PUBLIC_ENDPOINTS,
};
