/**
 * LLMux Traffic Simulator
 * Sends diverse requests to the local server to populate the Inspector Dashboard.
 */

const http = require('http');

const REQUESTS = [
    { type: 'CODE', prompt: 'Write a Python function to calculate Fibonacci numbers efficiently.' },
    { type: 'MATH', prompt: 'Solve the equation 3x + 5 = 20.' },
    { type: 'CREATIVE', prompt: 'Write a haiku about a brave toaster.' },
    { type: 'ANALYSIS', prompt: 'Analyze the sentiment of this text: I love this new feature!' },
    { type: 'GENERAL', prompt: 'What is the capital of France?' }
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
            console.log(`[${res.statusCode}] ${data.type} Request Completed`);
        });
    });

    req.on('error', (e) => {
        console.error(`Problem with request: ${e.message}`);
    });

    req.write(postData);
    req.end();
}

console.log('🚀 Starting Traffic Simulation...');
console.log('Sending 5 requests to http://localhost:8765/api/smart');

let delay = 0;
REQUESTS.forEach((req) => {
    setTimeout(() => {
        console.log(`Sending ${req.type} request...`);
        sendRequest(req);
    }, delay);
    delay += 1500; // Stagger requests
});
