/**
 * LLMux - AI Semantic Router
 * Routes requests based on intent analysis
 */

// Simple keyword heuristics for "Zero-Shot" classification without heavy ML models
const TASK_PATTERNS = {
    CODE: [
        /\b(function|class|const|let|var|return|import|export|def|print|console\.log)\b/,
        /\b(python|javascript|java|cpp|golang|rust|typescript)\b/i,
        /\b(write|create|debug|fix|refactor).+(code|function|script|app)\b/i
    ],
    MATH: [
        /\b(calculate|solve|equation|theorem|algebra|calculus|geometry)\b/i,
        /[\d\+\-\*\/^=]{5,}/ // Simple arithmetic patterns
    ],
    CREATIVE: [
        /\b(write|compose|generate|create).+(story|poem|song|recipe|email|blog|article)\b/i,
        /\b(imagine|fantasy|fiction|style of)\b/i
    ],
    ANALYSIS: [
        /\b(analyze|summarize|explain|extract|compare|contrast|list)\b/i,
        /\b(sentiment|key points|summary|meaning)\b/i
    ]
};

class SemanticRouter {
    /**
     * Detect task type from prompt
     * @param {string} prompt 
     * @returns {string} Task Type (CODE, MATH, CREATIVE, ANALYSIS, GENERAL)
     */
    static detectTaskType(prompt) {
        if (!prompt) return 'GENERAL';
        const text = prompt.toLowerCase();

        for (const [type, patterns] of Object.entries(TASK_PATTERNS)) {
            if (patterns.some(p => p.test(text))) {
                return type;
            }
        }

        return 'GENERAL';
    }

    /**
     * Select best provider for task
     * @param {string} taskType 
     * @param {Array<Object>} availableProviders 
     * @returns {Object|null} Selected Provider
     */
    static selectProvider(taskType, availableProviders) {
        // Define preferences (This could be dynamic config)
        const PREFERENCES = {
            CODE: ['codex', 'claude', 'gemini'], // Providers known for code
            MATH: ['gpt-4', 'claude', 'gemini'],
            CREATIVE: ['claude', 'gpt-4', 'gemini'],
            ANALYSIS: ['claude', 'gemini', 'gpt-3.5'],
            GENERAL: ['gpt-3.5', 'gemini', 'ollama']
        };

        const preferredOrder = PREFERENCES[taskType] || PREFERENCES.GENERAL;

        // Find first available provider in preferred order
        for (const prefName of preferredOrder) {
            const match = availableProviders.find(p =>
                p.name.toLowerCase().includes(prefName) ||
                (p.config && p.config.defaultModel && p.config.defaultModel.includes(prefName))
            );
            if (match) return match;
        }

        // Fallback to random/first available if no preference match
        return availableProviders.length > 0 ? availableProviders[0] : null;
    }
}

module.exports = SemanticRouter;
