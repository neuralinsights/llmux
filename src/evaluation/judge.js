/**
 * LLMux - LLM-as-Judge Evaluator
 * Automated quality scoring using LLM evaluation
 */

const { getProvider } = require('../providers');
const inspector = require('../telemetry/inspector');

class JudgeService {
    constructor() {
        this.judgeProvider = process.env.JUDGE_PROVIDER || 'claude';
        this.judgeModel = process.env.JUDGE_MODEL || 'claude-sonnet-4';
        this.enabled = process.env.ENABLE_JUDGE !== 'false';
    }

    /**
     * Evaluate two responses using LLM-as-judge
     * @param {Object} comparison - { prompt, responseA, responseB, providerA, providerB }
     * @returns {Promise<Object>} - { winner, scores, reasoning }
     */
    async evaluate({ prompt, responseA, responseB, providerA, providerB, requestId }) {
        if (!this.enabled) {
            return { winner: 'TIE', scores: {}, reasoning: 'Judge disabled' };
        }

        try {
            const judgePrompt = this._buildJudgePrompt({
                prompt,
                responseA,
                responseB,
                providerA,
                providerB
            });

            const provider = getProvider(this.judgeProvider);
            const result = await provider.call(judgePrompt, {
                model: this.judgeModel,
                timeout: 30000
            });

            // Parse JSON response
            const evaluation = this._parseJudgeResponse(result.response);

            inspector.trace(requestId || 'judge', 'JUDGE_EVALUATION', {
                providerA,
                providerB,
                winner: evaluation.winner,
                scoreA: evaluation.scores.A?.total || 0,
                scoreB: evaluation.scores.B?.total || 0
            });

            return evaluation;

        } catch (err) {
            console.error('[Judge] Evaluation failed:', err.message);
            return {
                winner: 'ERROR',
                scores: {},
                reasoning: `Evaluation failed: ${err.message}`
            };
        }
    }

    /**
     * Build judge prompt
     * @private
     */
    _buildJudgePrompt({ prompt, responseA, responseB, providerA, providerB }) {
        return `You are an expert evaluator of AI responses. Compare these two responses to the same prompt and determine which is better.

ORIGINAL PROMPT:
${prompt}

RESPONSE A (Provider: ${providerA}):
${responseA}

RESPONSE B (Provider: ${providerB}):
${responseB}

Evaluate each response on these criteria (0-10 scale):
1. **Correctness**: Does it accurately answer the question?
2. **Relevance**: Is it on-topic and addresses the prompt?
3. **Clarity**: Is it well-structured and easy to understand?
4. **Completeness**: Does it cover all necessary aspects?
5. **Conciseness**: Is it appropriately concise without being verbose?

Return your evaluation in this EXACT JSON format (no markdown, just raw JSON):
{
  "winner": "A" or "B" or "TIE",
  "scores": {
    "A": {
      "correctness": <0-10>,
      "relevance": <0-10>,
      "clarity": <0-10>,
      "completeness": <0-10>,
      "conciseness": <0-10>,
      "total": <sum of above>
    },
    "B": {
      "correctness": <0-10>,
      "relevance": <0-10>,
      "clarity": <0-10>,
      "completeness": <0-10>,
      "conciseness": <0-10>,
      "total": <sum of above>
    }
  },
  "reasoning": "Brief explanation (1-2 sentences)"
}`;
    }

    /**
     * Parse judge response (extract JSON)
     * @private
     */
    _parseJudgeResponse(response) {
        try {
            // Try to extract JSON from response (may be wrapped in markdown)
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }

            const parsed = JSON.parse(jsonMatch[0]);

            // Validate structure
            if (!parsed.winner || !parsed.scores) {
                throw new Error('Invalid JSON structure');
            }

            // Calculate totals if missing
            if (parsed.scores.A && !parsed.scores.A.total) {
                parsed.scores.A.total = Object.values(parsed.scores.A)
                    .filter(v => typeof v === 'number')
                    .reduce((sum, v) => sum + v, 0);
            }
            if (parsed.scores.B && !parsed.scores.B.total) {
                parsed.scores.B.total = Object.values(parsed.scores.B)
                    .filter(v => typeof v === 'number')
                    .reduce((sum, v) => sum + v, 0);
            }

            return parsed;

        } catch (err) {
            console.error('[Judge] Failed to parse response:', err.message);
            return {
                winner: 'ERROR',
                scores: { A: { total: 0 }, B: { total: 0 } },
                reasoning: `Parse error: ${err.message}`
            };
        }
    }

    /**
     * Batch evaluate multiple comparisons
     * @param {Array} comparisons - Array of comparison objects
     * @returns {Promise<Array>} - Array of evaluation results
     */
    async evaluateBatch(comparisons) {
        const results = [];

        for (const comp of comparisons) {
            const evaluation = await this.evaluate({
                prompt: comp.prompt,
                responseA: comp.primary.response,
                responseB: comp.shadow.response,
                providerA: comp.primary.provider,
                providerB: comp.shadow.provider,
                requestId: comp.requestId
            });

            results.push({
                ...comp,
                evaluation
            });

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        return results;
    }
}

// Export singleton
module.exports = new JudgeService();
