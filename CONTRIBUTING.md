# Contributing to LLMux

Thank you for your interest in contributing to LLMux! This document provides guidelines for contributing to the project.

## Code of Conduct

Be respectful and constructive in all interactions. We welcome contributors of all backgrounds and experience levels.

## Getting Started

### Development Setup

```bash
# Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/llmux.git
cd llmux

# Install dependencies
npm install

# Create environment file
cp config/.env.example .env
# Edit .env with your API keys

# Start development server
npm run dev
```

### Project Structure

```
src/
├── index.js              # Entry point
├── app.js                # Express configuration
├── config/               # Configuration modules
├── providers/            # LLM provider implementations
├── cache/                # Cache system
├── routing/              # Request routing logic
├── middleware/           # Express middleware
├── telemetry/            # Metrics and monitoring
└── utils/                # Utility functions
```

## Development Workflow

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring

### Commit Messages

Follow conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:
```
feat(providers): add support for new Gemini model
fix(cache): correct TTL calculation for expired entries
docs(api): update OpenAPI specification with new endpoints
```

### Pull Requests

1. Create a feature branch from `main`
2. Make your changes with clear commits
3. Write/update tests for your changes
4. Ensure all tests pass: `npm test`
5. Update documentation if needed
6. Submit a PR with a clear description

### PR Checklist

- [ ] Code follows project style guidelines
- [ ] Tests added/updated for changes
- [ ] Documentation updated if needed
- [ ] No breaking changes (or documented in PR)
- [ ] Commit messages follow conventions

## Code Style

### JavaScript/Node.js

- Use ES6+ features
- Use `const` by default, `let` when needed
- Prefer arrow functions for callbacks
- Use async/await over raw promises
- Add JSDoc comments for public functions

```javascript
/**
 * Generate text from the specified provider
 * @param {string} prompt - Input prompt
 * @param {Object} options - Generation options
 * @returns {Promise<string>} Generated text
 */
async function generate(prompt, options = {}) {
  // Implementation
}
```

### Formatting

We use standard JavaScript formatting:
- 2 spaces for indentation
- Single quotes for strings
- Semicolons required
- Max line length: 100 characters

### Linting

```bash
# Run linter
npm run lint

# Fix auto-fixable issues
npm run lint:fix
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- path/to/test.js

# Run with coverage
npm run test:coverage
```

### Writing Tests

- Place tests in `test/` directory
- Name test files `*.test.js`
- Use descriptive test names
- Test both success and error cases

```javascript
describe('MemoryCache', () => {
  it('should return cached value within TTL', async () => {
    const cache = new MemoryCache({ ttl: 1000 });
    await cache.set('key', 'value');
    expect(await cache.get('key')).toBe('value');
  });

  it('should return null for expired entries', async () => {
    const cache = new MemoryCache({ ttl: 1 });
    await cache.set('key', 'value');
    await sleep(10);
    expect(await cache.get('key')).toBeNull();
  });
});
```

## Adding a New Provider

1. Create provider class in `src/providers/`:

```javascript
// src/providers/newprovider.js
const { BaseProvider } = require('./base');

class NewProvider extends BaseProvider {
  constructor() {
    super('newprovider', config);
  }

  async generate(prompt, options) {
    // Implementation
  }

  async *stream(prompt, options) {
    // Streaming implementation
  }
}

module.exports = { NewProvider };
```

2. Register in `src/providers/index.js`
3. Add configuration in `src/config/providers.js`
4. Write tests in `test/providers/newprovider.test.js`
5. Update documentation

## Reporting Issues

### Bug Reports

Include:
- LLMux version
- Node.js version
- Operating system
- Steps to reproduce
- Expected vs actual behavior
- Error messages/logs

### Feature Requests

Include:
- Use case description
- Proposed solution
- Alternative approaches considered

## Security

Report security vulnerabilities via email to: security@example.com

Do NOT create public issues for security vulnerabilities.

See [SECURITY.md](./SECURITY.md) for details.

## Questions?

- Open a [Discussion](https://github.com/neuralinsights/llmux/discussions)
- Check existing [Issues](https://github.com/neuralinsights/llmux/issues)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
