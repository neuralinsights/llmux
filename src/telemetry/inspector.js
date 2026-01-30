/**
 * LLMux Live Flow Inspector SDK
 * Captures and emits real-time request traces via WebSockets
 */

const EventEmitter = require('events');

class Inspector extends EventEmitter {
    constructor() {
        super();
        this.io = null; // Socket.io instance
        this.enabled = true;
        this.history = []; // [NEW] In-memory history buffer for late joiners
        this.maxHistory = 100;
    }

    /**
     * Initialize with Socket.io instance
     * @param {Object} io 
     */
    attach(io) {
        this.io = io;
        if (!this.io) return; // Handle detach or invalid input

        console.log('[Inspector] Attached to WebSocket Server');

        this.io.on('connection', (socket) => {
            console.log(`[Inspector] Client connected: ${socket.id}`);

            // Send history to new client
            socket.emit('history', this.history);

            socket.on('disconnect', () => {
                console.log(`[Inspector] Client disconnected: ${socket.id}`);
            });
        });
    }

    /**
     * Emit a trace event
     * @param {string} requestId 
     * @param {string} stage (e.g., 'REQUEST', 'ROUTER', 'PLUGIN', 'LLM', 'RESPONSE')
     * @param {Object} data 
     */
    trace(requestId, stage, data) {
        if (!this.enabled || !this.io) return;

        const payload = {
            requestId,
            timestamp: Date.now(),
            stage,
            data
        };

        // Add to history
        this.history.unshift(payload);
        if (this.history.length > this.maxHistory) {
            this.history.pop();
        }

        // Emit to 'trace' room or broadcast to all
        this.io.emit('trace', payload);
    }

    /**
     * Middleware to capture incoming requests
     */
    middleware() {
        return (req, res, next) => {
            // Use existing request ID if available (middleware runs early)
            // If not, we rely on the one generated in api routes, 
            // but for "REQUEST" stage we might need to pre-generate one or use a shared one.
            // For now, only emit if we can attach it later or use a custom header if present.

            // Let's hook into res.on('finish') for the RESPONSE stage here
            // The REQUEST stage might be better handled inside the route handler where we generate the ID
            // OR we attach a unique ID here if not present.

            if (!req.inspectorId) {
                req.inspectorId = Math.random().toString(36).substring(7);
            }

            this.trace(req.inspectorId, 'INBOUND', {
                method: req.method,
                url: req.originalUrl,
                ip: req.ip
            });

            const start = Date.now();

            res.on('finish', () => {
                this.trace(req.inspectorId, 'OUTBOUND', {
                    statusCode: res.statusCode,
                    duration: Date.now() - start
                });
            });

            next();
        };
    }
}

// Singleton instance
const inspector = new Inspector();

module.exports = inspector;
