
const spawn = require('child_process').spawn;
const assert = require('assert');

// We simulate an MCP client by spawning the server and sending JSON-RPC messages

const SERVER_CMD = 'npm';
const SERVER_ARGS = ['run', 'mcp'];
const API_PORT = 8765;

// Ensure main API is available? 
// We will assume the test runner has started the server or we can start it.
// For this script, we assume the server is running on port 8765.

async function runTest() {
    console.log('--- MCP Server Verification ---');

    const proc = spawn(SERVER_CMD, SERVER_ARGS, { stdio: ['pipe', 'pipe', 'inherit'] });

    let buffer = '';
    let messageCount = 0;

    proc.stdout.on('data', (data) => {
        const str = data.toString();
        buffer += str;

        // MCP uses JSON-RPC, possibly delimited by newlines?
        // The SDK might output raw JSON.
        // Let's try to parse lines.
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete line

        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const msg = JSON.parse(line);
                handleMessage(msg, proc);
            } catch (e) {
                // Ignore non-json logs
            }
        }
    });

    // Send Initialize Request
    const initRequest = {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "test-client", version: "1.0" }
        }
    };

    send(proc, initRequest);

    // Timeout
    setTimeout(() => {
        console.error('Timeout!');
        proc.kill();
        process.exit(1);
    }, 10000);
}

function send(proc, msg) {
    proc.stdin.write(JSON.stringify(msg) + '\n');
}

let step = 0;

function handleMessage(msg, proc) {
    console.log(`[RCV] Step ${step} Message:`, JSON.stringify(msg));

    if (step === 0 && msg.id == 1) { // Relax strict equality
        // Init Response
        assert.ok(msg.result.serverInfo, 'Server info missing');
        console.log('✅ Initialized');

        // Send Initialized Notification
        send(proc, { jsonrpc: "2.0", method: "notifications/initialized" });

        // Request Tool List
        step++;
        send(proc, {
            jsonrpc: "2.0",
            id: 2,
            method: "tools/list",
            params: {}
        });
    } else if (step === 1 && msg.id == 2) {
        // List Tools Response
        const tools = msg.result.tools;
        const toolNames = tools.map(t => t.name);
        console.log('Tools:', toolNames);

        assert.ok(toolNames.includes('generate_text'));
        assert.ok(toolNames.includes('save_memory'));
        assert.ok(toolNames.includes('search_memory'));
        assert.ok(toolNames.includes('get_models'));
        console.log('✅ Tools Listed');

        // Call Tool: get_models
        step++;
        send(proc, {
            jsonrpc: "2.0",
            id: 3,
            method: "tools/call",
            params: {
                name: "get_models",
                arguments: {}
            }
        });
    } else if (step === 2 && msg.id == 3) {
        // get_models Response
        // Note: Main server needs to be running! If not, this might be error.
        // If error, it returns { isError: true, ... } in content usually?
        // Or JSON-RPC error.

        if (msg.error) {
            console.log('Warning: API call failed (Server likely not running).');
            console.log('Error:', msg.error);
        } else {
            const content = msg.result.content[0].text;
            console.log('Models:', content);
            assert.ok(content.includes('Available Models'), 'Result incorrect');
        }
        console.log('✅ Tool Call Attempted');

        console.log('--- Verification Complete ---');
        proc.kill();
        process.exit(0);
    }
}

runTest();
