
const SemanticRouter = require('../src/routing/ai_router');
const ExperimentManager = require('../src/routing/experiment');
const { logRoutingEvent } = require('../src/routing/collector');
const fs = require('fs');

// Mock dependencies
jest.mock('fs');
jest.mock('../src/routing/weighted', () => ({
    selectProviderWeighted: jest.fn(() => ({ name: 'weighted-provider' }))
}));
jest.mock('../src/providers', () => ({
    getAvailableProviders: jest.fn(() => [
        { name: 'claude-3-opus' },
        { name: 'gpt-4' },
        { name: 'gemini-pro' },
        { name: 'ollama-llama3' }
    ])
}));

describe('Phase 4.2: AI Driven Routing', () => {

    describe('SemanticRouter', () => {
        test('Should correctly classify CODE prompts', () => {
            expect(SemanticRouter.detectTaskType('Write a function to sum numbers')).toBe('CODE');
            expect(SemanticRouter.detectTaskType('console.log("hello")')).toBe('CODE');
            expect(SemanticRouter.detectTaskType('Fix this python script')).toBe('CODE');
        });

        test('Should correctly classify MATH prompts', () => {
            expect(SemanticRouter.detectTaskType('Solve 2x + 5 = 10')).toBe('MATH');
            expect(SemanticRouter.detectTaskType('Calculate the derivative of x^2')).toBe('MATH');
        });

        test('Should correctly classify CREATIVE prompts', () => {
            expect(SemanticRouter.detectTaskType('Write a poem about robots')).toBe('CREATIVE');
            expect(SemanticRouter.detectTaskType('Write a story in the style of Shakespeare')).toBe('CREATIVE');
        });

        test('Should default to GENERAL for ambiguous prompts', () => {
            expect(SemanticRouter.detectTaskType('Hello, how are you?')).toBe('GENERAL');
            expect(SemanticRouter.detectTaskType('')).toBe('GENERAL');
        });

        test('Should select preferred provider for task type', () => {
            const providers = [
                { name: 'claude-3-opus' },
                { name: 'gpt-3.5-turbo' },
                { name: 'ollama-7b' }
            ];

            // CODE prefers codex > claude > gemini
            // In our mock list we have claude.
            const selected = SemanticRouter.selectProvider('CODE', providers);
            expect(selected.name).toContain('claude');
        });
    });

    describe('ExperimentManager', () => {
        const originalEnv = process.env;

        beforeEach(() => {
            jest.resetModules();
            process.env = { ...originalEnv };
        });

        afterAll(() => {
            process.env = originalEnv;
        });

        test('Should route to AI Strategy when random < rate', () => {
            process.env.AI_ROUTING_RATE = '1.0'; // Force AI
            // Re-require to pick up env
            const Manager = require('../src/routing/experiment'); // It exports new instance

            // We need to re-instantiate or mock Math.random if the class reads env in constructor.
            // The class reads env in constructor. 
            // Since module caches the instance, we can't easily re-init with process.env change 
            // unless we reset modules or modify the instance property directly if accessible.
            // The exported object is an instance. Let's modify the property.
            Manager.AI_ROUTING_RATE = 1.0;

            const decision = Manager.route('Write a function');
            expect(decision.strategy).toBe('AI_SEMANTIC');
            expect(decision.taskType).toBe('CODE');
            expect(decision.provider.name).toContain('claude'); // Based on Semantic Logic
        });

        test('Should route to Weighted Baseline when random > rate', () => {
            const Manager = require('../src/routing/experiment');
            Manager.AI_ROUTING_RATE = 0.0; // Force Baseline

            const decision = Manager.route('Write a function');

            // Note: In our implementation, if selectProvider returns null (AI failed), it falls back.
            // But here we force Group A (Baseline).
            expect(decision.strategy).toBe('WEIGHTED_BASELINE');
            expect(decision.provider.name).toBe('weighted-provider');
        });
    });

    describe('DataCollector', () => {
        test('Should log routing events to file', () => {
            const appendSpy = jest.spyOn(fs, 'appendFile').mockImplementation((file, data, cb) => cb(null));

            logRoutingEvent({
                monitor: 'test',
                strategy: 'AI'
            });

            expect(appendSpy).toHaveBeenCalled();
            const writtenData = JSON.parse(appendSpy.mock.calls[0][1].trim());
            expect(writtenData.strategy).toBe('AI');
            expect(writtenData.timestamp).toBeDefined();
        });
    });

});
