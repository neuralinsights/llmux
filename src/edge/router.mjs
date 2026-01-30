/**
 * Edge Router
 * Handles routing logic without Node.js dependencies
 */

import { CONFIG } from './config.mjs';

export async function handleRequest(request, env) {
    const body = await request.json();

    // 1. Determine Provider (Simple Weighted or Fallback)
    // For Edge v1, we default to env.DEFAULT_PROVIDER or 'claude'
    // But we support 'provider' field in body

    let providerName = body.provider || env.DEFAULT_PROVIDER || CONFIG.DEFAULT_PROVIDER;

    // Validate Provider
    let providerConfig = CONFIG.PROVIDERS[providerName];
    if (!providerConfig) {
        // Fallback to default if unknown
        providerName = CONFIG.DEFAULT_PROVIDER;
        providerConfig = CONFIG.PROVIDERS[providerName];
    }

    // 2. Prepare Request to Upstream
    // We need API Key. CF Workers store them in `env`.
    // e.g. env.ANTHROPIC_API_KEY, env.OPENAI_API_KEY

    let apiKey = '';
    if (providerName === 'claude') apiKey = env.ANTHROPIC_API_KEY;
    if (providerName === 'openai') apiKey = env.OPENAI_API_KEY;

    if (!apiKey) {
        return new Response(JSON.stringify({ error: `Missing configuration for ${providerName}` }), { status: 500 });
    }

    // 3. Transform Body? 
    // LLMux Unified Format -> Provider Format transformation might be needed.
    // For v1, we assume passthrough or simple adaptation.
    // A real implementation would include the Adapter logic from Phase 2.
    // Here we do a minimal pass-through assuming the client sent compatible format or we just wrap it.

    // Minimal Proxy Logic
    try {
        // We start a fetch to upstream
        const upstreamResp = await fetch(providerConfig.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...providerConfig.headers(apiKey)
            },
            body: JSON.stringify(body)
            // Note: If body format differs (e.g. unified vs specific), adapters are needed.
            // We assume for this Proof of Concept that the input matches the provider expectation OR unified format is close enough.
        });

        // Stream back response
        const { readable, writable } = new TransformStream();
        upstreamResp.body.pipeTo(writable);

        return new Response(readable, {
            status: upstreamResp.status,
            headers: upstreamResp.headers
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: `Upstream error: ${err.message}` }), { status: 502 });
    }
}
