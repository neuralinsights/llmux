/**
 * LLMux - Routing Experiment
 * A/B Testing framework for routing strategies
 */

const SemanticRouter = require('./ai_router');
const { selectProviderWeighted } = require('./weighted'); // Legacy strategy
const { logRoutingEvent } = require('./collector');
const { getAvailableProviders } = require('../providers');

class ExperimentManager {
    constructor() {
        // 20% traffic to AI Routing
        this.AI_ROUTING_RATE = parseFloat(process.env.AI_ROUTING_RATE || '0.2');
    }

    /**
     * Route the request using A/B testing
     * @param {string} prompt 
     * @returns {{ provider: Object, strategy: string, taskType: string }}
     */
    route(prompt) {
        const available = getAvailableProviders();
        const taskType = SemanticRouter.detectTaskType(prompt);

        // Bucket assignment (simple random)
        const isExperimentGroup = Math.random() < this.AI_ROUTING_RATE;

        let selectedProvider = null;
        let strategy = 'WEIGHTED_BASELINE';

        if (isExperimentGroup) {
            // Group B: AI Routing
            selectedProvider = SemanticRouter.selectProvider(taskType, available);
            strategy = 'AI_SEMANTIC';
        }

        // Fallback or Group A: Weighted
        if (!selectedProvider) {
            // Use existing weighted logic (mock imported or actual)
            // Note: usage of selectProviderWeighted might differ in API signature, assuming basic
            // In src/routing/index.js (from Phase 2), selectProviderWeighted returns a provider object
            selectedProvider = selectProviderWeighted();
            strategy = isExperimentGroup ? 'AI_FALLBACK_TO_WEIGHTED' : 'WEIGHTED_BASELINE';
        }

        return {
            provider: selectedProvider,
            strategy,
            taskType
        };
    }
}

module.exports = new ExperimentManager();
