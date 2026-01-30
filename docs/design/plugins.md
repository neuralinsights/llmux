# LLMux Plugin System Design

## 1. Overview
The Plugin System allows developers to extend LLMux functionality without modifying the core codebase. Plugins can intercept requests, modify prompts, log data, integrate with external tools, and handle errors.

## 2. Architecture

### 2.1 Plugin Structure
A plugin is a standard Node.js module that exports a factory function or a class.

```javascript
// plugins/my-plugin/index.js
module.exports = {
  name: 'my-plugin',
  version: '1.0.0',
  init: async (context) => {
    // Initialization logic
    context.logger.info('Plugin initialized');
  },
  hooks: {
    onRequest: async (context, next) => { ... },
    onPrompt: async (context, next) => { ... },
    onResponse: async (context, next) => { ... }
  }
};
```

### 2.2 Lifecycle
1. **Discovery**: Loader finds plugins in `plugins/` dir or `node_modules`.
2. **Loading**: `require()` the module.
3. **Initialization**: Call `init()` with `PluginContext`.
4. **Registration**: Register hooks into the global Event/Hook registry.
5. **Execution**: Core system triggers hooks at specific points.

## 3. Hooks

| Hook | Description | Arguments |
|------|-------------|-----------|
| `onRequest` | Executed before standard middleware. Can modify Request. | `(req, res, next)` |
| `onPrompt` | Executed before Provider call. Can modify prompt/options. | `(prompt, options)` |
| `onResponse` | Executed after Provider success. Can modify response. | `(response, originalReq)` |
| `onError` | Executed on failure. | `(error, originalReq)` |
| `onShutdown` | Cleanup logic. | `()` |

## 4. Plugin Context (API)
The `context` object provided to `init()` exposes safe core functionalities:
- `logger`: Structured logging.
- `db`: Access to Database (scoped or full).
- `config`: Read-only configuration.
- `metrics`: Ability to emit custom metrics.

## 5. Security
- Plugins run in the same process (trusted).
- Future: Sandbox (V8 isolates) or WASM for untrusted plugins.
- For now, plugins are considered trusted extensions.

## 6. Implementation Steps
1. **`src/plugins/loader.js`**: Discover and load plugins.
2. **`src/plugins/registry.js`**: Manage active hooks.
3. **`src/plugins/context.js`**: Create API surface.
4. **Integration**: Insert hook trigger points in `app.js` and `providers/base.js`.
