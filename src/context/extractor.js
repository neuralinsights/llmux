/**
 * LLMux - Entity Extractor
 * Simple regex-based Named Entity Recognition (NER)
 */

class EntityExtractor {
    constructor() {
        this.patterns = {
            PERSON: [
                /my name is (\w+)/i,
                /i'?m (\w+)/i,
                /call me (\w+)/i,
                /this is (\w+) speaking/i
            ],
            PROJECT: [
                /working on (\w+) project/i,
                /(\w+) project/i,
                /building (\w+)/i
            ],
            DATE: [
                /on ((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* \d{1,2}(?:st|nd|rd|th)?)/i,
                /(\d{4}-\d{2}-\d{2})/,
                /(tomorrow|today|yesterday)/i
            ],
            EMAIL: [
                /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/
            ],
            MONEY: [
                /\$(\d+(?:,\d{3})*(?:\.\d{2})?)/,
                /(\d+(?:,\d{3})*(?:\.\d{2})?) dollars?/i
            ]
        };
    }

    /**
     * Extract entities from text
     * @param {string} text
     * @returns {Array<{ type: string, value: string, context: string }>}
     */
    extract(text) {
        const entities = [];

        for (const [type, patterns] of Object.entries(this.patterns)) {
            for (const pattern of patterns) {
                const matches = text.matchAll(new RegExp(pattern, 'gi'));

                for (const match of matches) {
                    const value = match[1] || match[0];
                    const context = this._getContext(text, match.index, 50);

                    entities.push({
                        type,
                        value: value.trim(),
                        context,
                        position: match.index
                    });
                }
            }
        }

        // Deduplicate
        return this._deduplicate(entities);
    }

    /**
     * Get surrounding context for an entity
     * @private
     */
    _getContext(text, position, radius = 50) {
        const start = Math.max(0, position - radius);
        const end = Math.min(text.length, position + radius);
        return text.slice(start, end).trim();
    }

    /**
     * Remove duplicate entities
     * @private
     */
    _deduplicate(entities) {
        const seen = new Set();
        return entities.filter(entity => {
            const key = `${entity.type}:${entity.value.toLowerCase()}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    /**
     * Extract and format entities for storage
     * @param {string} userPrompt
     * @param {string} assistantResponse
     * @returns {Object} - { entities: Array, summary: string }
     */
    extractFromConversation(userPrompt, assistantResponse) {
        const combinedText = `${userPrompt} ${assistantResponse}`;
        const entities = this.extract(combinedText);

        const summary = entities.length > 0
            ? `Found ${entities.length} entities: ${entities.map(e => `${e.type}(${e.value})`).join(', ')}`
            : 'No entities extracted';

        return { entities, summary };
    }
}

module.exports = new EntityExtractor();
