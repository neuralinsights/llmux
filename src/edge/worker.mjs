/**
 * LLMux - Edge Worker
 * Stateless entry point for Cloudflare Workers
 */

import { handleRequest } from './router.mjs';
import { CONFIG } from './config.mjs';

export default {
    async fetch(request, env, ctx) {
        // Inject Env into Config global or pass context
        // In CF Workers, env contains secrets/vars

        try {
            const url = new URL(request.url);

            // Health Check
            if (url.pathname === '/health') {
                return new Response(JSON.stringify({ status: 'ok', region: request.cf?.colo || 'dev' }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Generate Endpoint
            if (url.pathname === '/v1/chat/completions' || url.pathname === '/api/generate') {
                if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
                return await handleRequest(request, env);
            }

            return new Response('Not Found', { status: 404 });
        } catch (e) {
            return new Response(JSON.stringify({ error: e.message }), { status: 500 });
        }
    }
};
