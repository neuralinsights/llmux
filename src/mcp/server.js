#!/usr/bin/env node

/**
 * LLMux - MCP Server
 * Exposes LLMux capabilities as Model Context Protocol tools.
 * Connects via stdio.
 * Proxies requests to the running LLMux API instance.
 */

const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { CallToolRequestSchema, ListToolsRequestSchema } = require("@modelcontextprotocol/sdk/types.js");
const { z } = require("zod");

// Configuration
const API_BASE = process.env.LLMUX_API_URL || "http://localhost:8765";

// Helper to call API
async function callApi(endpoint, method, body) {
    try {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`API Error ${res.status}: ${err}`);
        }

        return await res.json();
    } catch (error) {
        throw new Error(`Failed to connect to LLMux at ${API_BASE}: ${error.message}`);
    }
}

// Create Server
const server = new Server(
    {
        name: "llmux-mcp",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// List Tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "generate_text",
                description: "Generate text using LLMux's Smart Routing (AI-driven provider selection).",
                inputSchema: zodToJsonSchema(
                    z.object({
                        prompt: z.string().describe("The user prompt"),
                        monitor: z.boolean().optional().describe("Whether to expect streaming (internal flag, usually false for tools)")
                    })
                ),
            },
            {
                name: "save_memory",
                description: "Save a text snippet to LLMux's Vector Memory.",
                inputSchema: zodToJsonSchema(
                    z.object({
                        content: z.string().describe("Text content to save"),
                        category: z.string().optional().describe("Optional category tag")
                    })
                ),
            },
            {
                name: "search_memory",
                description: "Search for semantic matches in LLMux's Vector Memory.",
                inputSchema: zodToJsonSchema(
                    z.object({
                        query: z.string().describe("Search query"),
                        limit: z.number().optional().describe("Number of results (default 3)")
                    })
                ),
            },
            {
                name: "get_models",
                description: "List available models and providers from LLMux.",
                inputSchema: zodToJsonSchema(z.object({})),
            }
        ],
    };
});

// Call Tool
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
        switch (name) {
            case "generate_text": {
                const result = await callApi("/api/smart", "POST", {
                    prompt: args.prompt,
                    options: { temperature: 0.7 }
                });

                return {
                    content: [
                        {
                            type: "text",
                            text: result.response || JSON.stringify(result),
                        },
                    ],
                };
            }

            case "save_memory": {
                await callApi("/api/vector/upsert", "POST", {
                    content: args.content,
                    metadata: { category: args.category || "mcp" }
                });
                return {
                    content: [{ type: "text", text: "Successfully saved to memory." }],
                };
            }

            case "search_memory": {
                const result = await callApi("/api/vector/search", "POST", {
                    query: args.query,
                    k: args.limit || 3
                });

                const formatted = result.results.map(r =>
                    `[Score: ${r.score.toFixed(2)}] ${r.content} (Meta: ${JSON.stringify(r.metadata)})`
                ).join("\n\n");

                return {
                    content: [{ type: "text", text: formatted || "No matches found." }],
                };
            }

            case "get_models": {
                const result = await callApi("/v1/models", "GET");
                const simplified = result.data.map(m => `${m.id} (${m.owned_by})`).join(", ");
                return {
                    content: [{ type: "text", text: `Available Models: ${simplified}` }]
                };
            }

            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    } catch (error) {
        return {
            isError: true,
            content: [
                {
                    type: "text",
                    text: `Error executing ${name}: ${error.message}`,
                },
            ],
        };
    }
});

// Helper for Schema conversion (simple version)
function zodToJsonSchema(zodObj) {
    // In a full implementation we'd use 'zod-to-json-schema' package
    // For now, manual construction of basic object schema
    // Or just import zod-to-json-schema if installed? We didn't install it.
    // I'll implement a minimal mapper for the specific schemas above.
    // For the above simple objects:
    // Fix: Zod v3 exposes .shape directly on the instance usually
    const shape = zodObj.shape || (typeof zodObj._def.shape === 'function' ? zodObj._def.shape() : zodObj._def.shape) || {};
    const properties = {};
    const required = [];

    for (const [key, val] of Object.entries(shape)) {
        let desc = val.description;
        let type = "string";
        let optional = val.isOptional && val.isOptional();

        if (val._def.typeName === "ZodString") type = "string";
        if (val._def.typeName === "ZodNumber") type = "number";
        if (val._def.typeName === "ZodBoolean") type = "boolean";
        if (val._def.typeName === "ZodOptional") {
            optional = true;
            // Unwrap inner
            if (val._def.innerType._def.typeName === "ZodString") type = "string";
            if (val._def.innerType._def.typeName === "ZodNumber") type = "number";
        }

        properties[key] = { type, description: desc };
        if (!optional) required.push(key);
    }

    return {
        type: "object",
        properties,
        required
    };
}

// Start Server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    // stderr log to avoid polluting stdio used for transport
    console.error("LLMux MCP Server running on stdio");
}

main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
});
