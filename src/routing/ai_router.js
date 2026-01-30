/**
 * LLMux - AI Semantic Router
 * Routes requests based on intent analysis, privacy, and complexity.
 */

const inspector = require('../telemetry/inspector');
const PrivacyGuard = require('./privacy_guard');
const ComplexityScorer = require('./complexity_scorer');
const ResourceMonitor = require('../resilience/resource_monitor');

class SemanticRouter {
    /**
     * Detect task type, privacy level, and complexity from prompt
     * @param {string} prompt 
     * @param {string} [requestId] Optional request ID for tracing
     * @returns {{taskType: string, privacy: Object, complexity: string}}
     */
    static detectTaskType(prompt, requestId) {
        let detectedType = 'GENERAL';

        // Simple keyword heuristics
        if (/(write|code|function|debug|fix|convert|script)/i.test(prompt)) detectedType = 'CODE';
        else if (/(calculate|solve|math|equation|compute)/i.test(prompt)) detectedType = 'MATH';
        else if (/(poem|story|haiku|creative|write a)/i.test(prompt)) detectedType = 'CREATIVE';
        else if (/(analyze|sentiment|summarize|classify)/i.test(prompt)) detectedType = 'ANALYSIS';

        // NEW: Complexity & Privacy Analysis
        const privacy = PrivacyGuard.analyze(prompt);
        const complexityScore = ComplexityScorer.score(prompt);
        const complexityCat = ComplexityScorer.categorize(complexityScore);

        if (requestId) {
            inspector.trace(requestId, 'ROUTER_ANALYSIS', {
                promptSummary: (prompt || '').slice(0, 50),
                detectedType,
                privacy: privacy.level,
                pii: privacy.findings,
                complexity: complexityCat,
                score: complexityScore
            });
        }

        return { taskType: detectedType, privacy, complexity: complexityCat };
    }

    /**
     * Select best provider based on task, availability, privacy, and system health.
     * @param {Object} analysis Result from detectTaskType
     * @param {Array<Object>} availableProviders 
     * @param {string} [requestId] 
     * @returns {Object|null} Selected Provider
     */
    static selectProvider(analysis, availableProviders, requestId) {
        const { taskType, privacy, complexity } = analysis;

        // 1. Privacy Filter
        let candidates = availableProviders;
        if (privacy.level !== 'PUBLIC') {
            // Filter for secure/private providers only
            candidates = candidates.filter(p => p.name.includes('ollama') || p.secure || (p.config && p.config.secure));

            if (requestId && candidates.length < availableProviders.length) {
                inspector.trace(requestId, 'PRIVACY_FILTER', {
                    blocked: availableProviders.length - candidates.length,
                    reason: `Content is ${privacy.level}`
                });
            }
        }

        if (candidates.length === 0) {
            // If strictly private and no private model, fail safe?
            // For demo: if we blocked all, return null.
            if (privacy.level !== 'PUBLIC') {
                if (requestId) inspector.trace(requestId, 'ROUTER_BLOCK', { reason: 'No Secure Provider Available' });
                return null;
            }
            candidates = availableProviders;
        }

        // 2. Resource & Complexity Optimization
        const systemHealth = ResourceMonitor.getHealth();

        // Preference Logic
        // CODE -> Codex, Claude
        // CREATIVE -> Claude, Gemini
        // MATH -> Gemini, Claude
        // ANALYSIS -> Claude

        // Adjust preference based on Complexity/Health
        // SIMPLE or DEGRADED -> Prefer faster/smaller models (Ollama, Gemini Flash)
        const preferSpeed = complexity === 'SIMPLE' || systemHealth !== 'HEALTHY';

        let preferredOrder = [];
        if (preferSpeed) {
            preferredOrder = ['ollama', 'gemini', 'claude', 'codex'];
        } else {
            // Default task-based preference
            if (taskType === 'CODE') preferredOrder = ['codex', 'claude', 'gemini', 'ollama'];
            else if (taskType === 'MATH') preferredOrder = ['gemini', 'claude', 'codex', 'ollama'];
            else if (taskType === 'CREATIVE') preferredOrder = ['claude', 'gemini', 'ollama', 'codex'];
            else preferredOrder = ['claude', 'gemini', 'codex', 'ollama'];
        }

        // Selection
        let selected = null;
        for (const name of preferredOrder) {
            selected = candidates.find(p => p.name.toLowerCase().includes(name));
            if (selected) break;
        }

        if (!selected) selected = candidates[0]; // Fallback

        if (requestId) {
            inspector.trace(requestId, 'ROUTER_SELECTION', {
                taskType,
                selected: selected?.name,
                systemHealth,
                privacyMode: privacy.level !== 'PUBLIC',
                optimization: preferSpeed ? 'SPEED' : 'QUALITY'
            });
        }

        return selected;
    }
}

module.exports = SemanticRouter;
