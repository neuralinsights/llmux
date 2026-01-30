
module.exports = {
    name: 'test-plugin',
    version: '1.0.0',
    init: async (context) => {
        context.logger.info('Test Plugin Initialized');
    },
    hooks: {
        onRequest: async ({ req, res }) => {
            res.setHeader('X-Test-Plugin', 'active');
        },
        onPrompt: async ({ prompt }) => {
            console.log('[TEST-PLUGIN] Prompt intercepted:', prompt);
        }
    }
};
