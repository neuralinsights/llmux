/**
 * usage_monitor.js
 * Tracks system resources (CPU, Memory, Event Loop Lag) to determine system health.
 * Used for Load Shedding and Circuit Breaking.
 */

const os = require('os');

class ResourceMonitor {
    constructor(options = {}) {
        this.checkIntervalMs = options.checkIntervalMs || 5000;
        this.historyLength = options.historyLength || 12; // Keep 1 minute of 5s samples

        // Thresholds
        this.cpuThreshold = options.cpuThreshold || 0.8; // 80% Load (normalized)
        this.memThreshold = options.memThreshold || 0.85; // 85% Heap Used
        this.lagThreshold = options.lagThreshold || 50; // 50ms Event Loop Lag

        this.history = [];
        this.currentStatus = 'HEALTHY';
        this.isRunning = false;
        this.intervalId = null;
        this.lastCheck = Date.now();
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastCheck = Date.now();
        this.intervalId = setInterval(() => this._check(), this.checkIntervalMs);
        console.log('[ResourceMonitor] Started monitoring system resources');
    }

    stop() {
        this.isRunning = false;
        if (this.intervalId) clearInterval(this.intervalId);
    }

    /**
     * Get current system health
     * @returns {'HEALTHY' | 'DEGRADED' | 'CRITICAL'}
     */
    getHealth() {
        return this.currentStatus;
    }

    /**
     * Get detailed stats
     */
    getStats() {
        const last = this.history[this.history.length - 1] || {};
        return {
            status: this.currentStatus,
            cpuLoad: last.cpuLoad || 0,
            memUsage: last.memUsage || 0,
            lag: last.lag || 0,
            timestamp: last.timestamp || Date.now()
        };
    }

    _check() {
        const now = Date.now();

        // 1. Measure Event Loop Lag
        // The delay between when we expected to run (checkIntervalMs) and now
        // Actually, setInterval drifts. Better way:
        // We rely on the fact that if CPU is blocked, this callback will be delayed.
        // Ideally we'd use process.hrtime() around a setImmediate, but simply measuring
        // drift from expected time in this interval is a "good enough" approximation for macro lag.
        // Let's stick to a simpler metric for lag: time since last check - interval.
        const delta = now - this.lastCheck;
        const lag = Math.max(0, delta - this.checkIntervalMs);
        this.lastCheck = now;

        // 2. CPU Load
        // os.loadavg() returns 1, 5, 15 min averages.
        // We define "Load" as loadavg(1m) / cpu_cores to normalize 0-1 (can go >1).
        const cpus = os.cpus().length;
        const load1m = os.loadavg()[0];
        const normalizedLoad = load1m / cpus;

        // 3. Memory Usage
        const mem = process.memoryUsage();
        // heapUsed / heapTotal ratio (Node) or RSS / Total System Mem?
        // Let's use RSS / Total System Mem for "System Pressure"
        // And Heap Used / Heap Limit for "Node Pressure"
        // Simplification: RSS / os.totalmem()
        const sysMemUsed = mem.rss / os.totalmem();

        const snapshot = {
            timestamp: now,
            cpuLoad: parseFloat(normalizedLoad.toFixed(2)),
            memUsage: parseFloat(sysMemUsed.toFixed(2)),
            lag: lag
        };

        this._updateHistory(snapshot);
        this._updateStatus(snapshot);
    }

    _updateHistory(snapshot) {
        this.history.push(snapshot);
        if (this.history.length > this.historyLength) {
            this.history.shift();
        }
    }

    _updateStatus(stats) {
        let score = 0;

        if (stats.cpuLoad > this.cpuThreshold) score += 2; // High CPU is critical
        if (stats.memUsage > this.memThreshold) score += 2; // OOM Risk
        if (stats.lag > this.lagThreshold) score += 1; // Laggy

        if (score >= 2) {
            this.currentStatus = 'CRITICAL';
        } else if (score >= 1) {
            this.currentStatus = 'DEGRADED';
        } else {
            this.currentStatus = 'HEALTHY';
        }
    }
}

// Singleton
module.exports = new ResourceMonitor();
