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
     * @param {string} [requestId]
     * @returns {{ provider: Object, strategy: string, taskType: string }}
     */
    route(prompt, requestId) {
        const available = getAvailableProviders();
        const analysis = SemanticRouter.detectTaskType(prompt, requestId);
        const { taskType } = analysis;

        // Bucket assignment (simple random)
        const isExperimentGroup = Math.random() < this.AI_ROUTING_RATE;

        let selectedProvider = null;
        let strategy = 'WEIGHTED_BASELINE';

        if (isExperimentGroup) {
            // Group B: AI Routing
            selectedProvider = SemanticRouter.selectProvider(analysis, available, requestId);
            strategy = 'AI_SEMANTIC';
        }

        // Fallback or Group A: Weighted
        if (!selectedProvider) {
            // Use existing weighted logic (mock imported or actual)
            // But we should really enforce Privacy even in fallback/weighted?
            // For now, let's just make sure we don't crash.
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
