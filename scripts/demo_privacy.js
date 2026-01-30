/**
 * demo_privacy.js
 * Visualizes Phase 2 features: Privacy Guard & Complexity Scorer.
 */

const http = require('http');

const REQUESTS = [
    // 1. PII -> Should trigger Privacy Filter and route to Ollama (Secure)
    { type: 'PII_EMAIL', prompt: 'Please email the report to CEO@example.com immediately.' },

    // 2. High Complexity -> Should route to Claude/Codex (Pro models)
    { type: 'COMPLEX_CODE', prompt: 'Write a React component that renders a datagrid with sorting, filtering, and pagination, using Tailwind CSS and TypeScript. ```tsx ... ```' },

    // 3. Simple -> Should route to Ollama/Gemini (Flash)
    { type: 'SIMPLE', prompt: 'What is 2+2?' },

    // 4. PII + Critical -> Should BLOCK if no severe provider found (or route to Ollama)
    { type: 'PII_PHONE', prompt: 'Call me at (555) 123-4567 regarding the incident.' }
];

function sendRequest(data) {
    const postData = JSON.stringify({
        prompt: data.prompt,
        options: { temperature: 0.7 }
    });

    const options = {
        hostname: 'localhost',
        port: 8765,
        path: '/api/smart',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    const req = http.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
            console.log(`[${res.statusCode}] ${data.type} request processed.`);
        });
    });

    req.on('error', (e) => {
        console.error(`Problem: ${e.message}`);
    });

    req.write(postData);
    req.end();
}

console.log('🛡️  Starting Privacy & Complexity Test...');
let delay = 0;
REQUESTS.forEach((req) => {
    setTimeout(() => {
        console.log(`Sending ${req.type}...`);
        sendRequest(req);
    }, delay);
    delay += 2000;
});
