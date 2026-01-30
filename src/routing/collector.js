/**
 * LLMux - Routing Data Collector
 * Collects data points on routing decisions for future optimization
 */

const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(process.cwd(), 'logs', 'routing_events.jsonl');

/**
 * Log a routing decision and outcome
 * @param {Object} event
 * @param {string} event.provider - Selected provider
 * @param {string} event.model - Selected model
 * @param {string} event.taskType - Detected task type
 * @param {number} event.promptLength - Length of prompt
 * @param {number} event.duration - Request duration in ms
 * @param {boolean} event.success - Whether request succeeded
 * @param {string} [event.error] - Error message if failed
 * @param {string} [event.strategy] - Routing strategy used (e.g. 'balanced', 'ai')
 */
function logRoutingEvent(event) {
    const entry = {
        timestamp: new Date().toISOString(),
        ...event
    };

    // Async append to file
    fs.appendFile(LOG_FILE, JSON.stringify(entry) + '\n', (err) => {
        if (err) console.error('[COLLECTOR] Failed to write log:', err);
    });
}

module.exports = {
    logRoutingEvent
};
