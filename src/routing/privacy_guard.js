/**
 * privacy_guard.js
 * Detects PII and assigns Privacy Levels to content.
 * Used to enforce routing rules (e.g. Block PII from public providers).
 */

const PII_PATTERNS = {
    EMAIL: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    // Simple Phone: (123) 456-7890 or 123-456-7890 or +1...
    PHONE: /(\+\d{1,2}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g,
    // Basic SSN (US): 000-00-0000
    SSN: /\b\d{3}-\d{2}-\d{4}\b/g,
    // Credit Card (Simple Luhn-like structure check is hard with regex, matching generic 16 digit groups)
    // 4 blocks of 4 digits
    CREDIT_CARD: /\b\d{4}[-\s]\d{4}[-\s]\d{4}[-\s]\d{4}\b/g,
    // IP Address (IPv4)
    IPV4: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g
};

class PrivacyGuard {
    constructor() {
        this.levels = {
            PUBLIC: 'PUBLIC',       // No PII, safe for any provider
            SENSITIVE: 'SENSITIVE', // Potential PII present
            CRITICAL: 'CRITICAL'    // High-risk PII (SSN, Credit Card)
        };
    }

    /**
     * Analyze text for PII and return report
     * @param {string} text 
     */
    analyze(text) {
        if (!text || typeof text !== 'string') {
            return { level: this.levels.PUBLIC, findings: [] };
        }

        const findings = [];
        let criticalFound = false;
        let sensitiveFound = false;

        // Check Critical PII
        if (PII_PATTERNS.SSN.test(text)) {
            findings.push('SSN');
            criticalFound = true;
        }
        if (PII_PATTERNS.CREDIT_CARD.test(text)) {
            findings.push('CREDIT_CARD');
            criticalFound = true;
        }

        // Check Sensitive PII
        if (PII_PATTERNS.EMAIL.test(text)) {
            findings.push('EMAIL');
            sensitiveFound = true;
        }
        if (PII_PATTERNS.PHONE.test(text)) {
            findings.push('PHONE');
            sensitiveFound = true;
        }
        if (PII_PATTERNS.IPV4.test(text)) {
            findings.push('IPV4');
            sensitiveFound = true;
        }

        // Determine Level
        let level = this.levels.PUBLIC;
        if (criticalFound) level = this.levels.CRITICAL;
        else if (sensitiveFound) level = this.levels.SENSITIVE;

        return {
            level,
            findings // List of PII types found
        };
    }

    /**
     * Redact PII from text (Simple masking)
     * @param {string} text 
     */
    redact(text) {
        let redacted = text;
        redacted = redacted.replace(PII_PATTERNS.EMAIL, '[REDACTED_EMAIL]');
        redacted = redacted.replace(PII_PATTERNS.PHONE, '[REDACTED_PHONE]');
        redacted = redacted.replace(PII_PATTERNS.SSN, '[REDACTED_SSN]');
        redacted = redacted.replace(PII_PATTERNS.CREDIT_CARD, '[REDACTED_CC]');
        // strict IP redaction might break code snippets, effectively ignored for redaction unless explicitly requested usually.
        // Keeping IP unredacted for now as it often appears in logs/code.
        return redacted;
    }
}

module.exports = new PrivacyGuard();
