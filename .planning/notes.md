# Ultrathink Notes

## Facts (Confirmed)
- Time: 2026-01-30.
- Stack: Express, Node.js v18+.
- Routing: `src/routing/ai_router.js` uses Regex Patterns (`TASK_PATTERNS`).
- Current Config: Static JSON/Files used (no Redis dynamic loader found in `app.js` yet, though `ioredis` is in package.json).

## Decisions
- **Path Correction**: Use `src/routing` instead of `src/router`.
- **Phase 1 Strategy**: Embedded Dashboard (HTML+React CDN) for Ops simplicity.
- **Telemetry**: Build `src/telemetry/inspector.js` as the central singleton for tracing.

## Unknowns / To-verify
- Does `ioredis` actually connect to anything right now? `app.js` initializes `createCache` with it, so yes.
- Where strictly is the `config/routing.json`? (User mentioned it, but `ls` didn't show it. We likely need to create it for Phase 4).
