/**
 * Edge Configuration
 * Defaults and Env mapping
 */

export const CONFIG = {
    DEFAULT_PROVIDER: 'claude',
    TIMEOUT: 30000,
    PROVIDERS: {
        'claude': {
            url: 'https://api.anthropic.com/v1/messages',
            model: 'claude-3-opus-20240229',
            headers: (key) => ({ 'x-api-key': key, 'anthropic-version': '2023-06-01' })
        },
        'openai': {
            url: 'https://api.openai.com/v1/chat/completions',
            model: 'gpt-4',
            headers: (key) => ({ 'Authorization': `Bearer ${key}` })
        }
        // Add more providers as needed
    }
};
