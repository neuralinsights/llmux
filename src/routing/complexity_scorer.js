/**
 * complexity_scorer.js
 * Estimates the complexity of a prompt to guide model selection.
 * Simple prompts -> Fast/Cheaper models.
 * Complex prompts -> SOTA/Slower models.
 */

class ComplexityScorer {
    constructor() {
        this.weights = {
            length: 0.05,       // Weight per character (normalized)
            codeBlock: 20,      // Points per code block
            mathSymbol: 5,      // Points per math symbol chunk
            fewShot: 10         // Points per example detected
        };
    }

    /**
     * Calculate complexity score (0-100)
     * @param {string} text 
     */
    score(text) {
        if (!text) return 0;

        let score = 0;

        // 1. Length Factor (Logarithmic roughly? Or linear capped)
        // Assume 1000 chars is "moderately long". 
        // text.length / 50 -> 500 chars = 10 pts.
        score += Math.min(30, text.length / 50);

        // 2. Code Blocks (```) indicate coding task complexity
        const codeBlocks = (text.match(/```/g) || []).length / 2; // Pair of backticks
        score += codeBlocks * this.weights.codeBlock;

        // 3. Math indicators (LaTeX or complex symbols)
        // Simple check for backslashes often used in LaTeX or large numbers of operators
        const mathSignals = (text.match(/\\[a-zA-Z]+|\^|\{|\}/g) || []).length;
        score += Math.min(20, mathSignals * 2);

        // 4. "Step by step" or reasoning indicators
        if (/\b(reason|step by step|explain|analyze|compare)\b/i.test(text)) {
            score += 15;
        }

        // Cap at 100
        return Math.min(100, Math.round(score));
    }

    /**
     * Categorize score
     * @param {number} score 
     * @returns {'SIMPLE' | 'MODERATE' | 'COMPLEX'}
     */
    categorize(score) {
        if (score < 30) return 'SIMPLE';
        if (score < 70) return 'MODERATE';
        return 'COMPLEX';
    }
}

module.exports = new ComplexityScorer();
