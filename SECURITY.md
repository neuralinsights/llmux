# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 3.x.x   | :white_check_mark: |
| < 3.0   | :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

1. **DO NOT** create a public GitHub issue
2. Email security details to: security@example.com
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 5 business days
- **Resolution Target**: Within 30 days (severity dependent)

### What to Expect

1. Confirmation of receipt
2. Assessment and severity classification
3. Regular updates on remediation progress
4. Credit in release notes (if desired)

## Security Features

LLMux implements several security measures:

### Input Validation
- Zod schema validation for all API inputs
- Strict mode rejects unknown fields
- Maximum prompt length enforcement (100,000 chars)

### Prompt Injection Protection
- Pattern matching for dangerous constructs
- Blocks `eval()`, `process.env`, credential extraction attempts
- Configurable severity levels

### Rate Limiting
- 100 requests/minute per client (default)
- IP-based and API key-based limiting
- Draft-7 standard rate limit headers

### Authentication
- Optional API key authentication
- Secure header-based key transmission

### CORS
- Configurable origin whitelist
- Secure defaults for production

## Security Best Practices

### For Deployers

1. **Enable API Key Authentication**
   ```bash
   API_KEY_REQUIRED=true
   ```

2. **Use HTTPS in Production**
   - Deploy behind a reverse proxy with TLS
   - Never expose HTTP in production

3. **Restrict CORS Origins**
   ```bash
   CORS_ORIGIN=https://your-app.example.com
   ```

4. **Secure API Keys**
   - Use environment variables or secrets management
   - Never commit keys to version control
   - Rotate keys periodically

5. **Network Isolation**
   - Deploy behind firewall/VPN for internal use
   - Use network policies in Kubernetes

### For Contributors

1. Never log sensitive data (API keys, prompts with PII)
2. Validate all external inputs
3. Use parameterized queries for any database operations
4. Follow principle of least privilege
5. Keep dependencies updated

## Known Limitations

- Memory cache is not encrypted at rest
- Streaming responses may expose partial content
- No built-in request signing/verification

## Security Audits

LLMux has not undergone formal security audits. Use in production at your own risk.

## Acknowledgments

We thank the following for responsible disclosure:
- (No reports yet)

---

Last updated: 2026-01-30
