/**
 * Phase 4 Test Script - Self-Optimizing Engine
 * Tests shadow routing, judge evaluation, and weight updates
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:8765';

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testPhase4() {
    console.log('🤖 Testing Phase 4: Self-Optimizing Engine\n');

    try {
        // 1. Check system status
        console.log('1️⃣  Checking system status...');
        const statusRes = await axios.get(`${BASE_URL}/api/evaluation/status`);
        console.log('   ✅ Status:', JSON.stringify(statusRes.data, null, 2));
        console.log();

        // 2. Send test requests to trigger shadow routing
        console.log('2️⃣  Sending 20 requests to trigger shadow routing (5% rate = ~1 shadow)...');
        const prompts = [
            'Write a Python function to calculate fibonacci',
            'Explain quantum computing in simple terms',
            'What is the capital of France?',
            'Write a haiku about coding',
            'Explain the difference between let and const in JavaScript',
            'What is machine learning?',
            'Write a SQL query to find duplicate records',
            'Explain REST API principles',
            'What is Docker?',
            'Write a function to reverse a string',
            'Explain async/await in JavaScript',
            'What is the difference between HTTP and HTTPS?',
            'Write a regex to validate email',
            'Explain the MVC pattern',
            'What is Git?',
            'Write a function to check if a number is prime',
            'Explain closures in JavaScript',
            'What is CI/CD?',
            'Write a function to merge two sorted arrays',
            'Explain the difference between SQL and NoSQL'
        ];

        for (let i = 0; i < prompts.length; i++) {
            try {
                await axios.post(`${BASE_URL}/api/smart`, {
                    prompt: prompts[i]
                }, { timeout: 30000 });
                process.stdout.write(`   Request ${i + 1}/20 sent\r`);
            } catch (err) {
                console.log(`\n   ⚠️  Request ${i + 1} failed: ${err.message}`);
            }
            await sleep(500); // Small delay
        }
        console.log('\n   ✅ All requests sent\n');

        // 3. Wait for shadow executions to complete
        console.log('3️⃣  Waiting 10 seconds for shadow executions...');
        await sleep(10000);

        // 4. Check comparison queue
        console.log('4️⃣  Checking comparison queue...');
        const queueRes = await axios.get(`${BASE_URL}/api/evaluation/comparisons`);
        console.log(`   Queue size: ${queueRes.data.queueSize}`);
        console.log(`   Shadow enabled: ${queueRes.data.status}`);
        console.log(`   Shadow rate: ${queueRes.data.rate * 100}%`);
        console.log();

        if (queueRes.data.queueSize === 0) {
            console.log('   ⚠️  No shadow comparisons in queue. This is expected if shadow is disabled.');
            console.log('   To enable: Set ENABLE_SHADOW=true and restart server.\n');
            return;
        }

        // 5. Trigger judge evaluation
        console.log('5️⃣  Triggering judge evaluation...');
        const judgeRes = await axios.post(`${BASE_URL}/api/evaluation/judge/batch?limit=5`);
        console.log(`   ✅ Processed ${judgeRes.data.processed} comparisons`);

        if (judgeRes.data.results && judgeRes.data.results.length > 0) {
            console.log('\n   Sample results:');
            judgeRes.data.results.slice(0, 3).forEach((r, i) => {
                console.log(`   ${i + 1}. ${r.primary} vs ${r.shadow}`);
                console.log(`      Winner: ${r.winner}`);
                console.log(`      Scores: A=${r.scores.A?.total || 0}, B=${r.scores.B?.total || 0}`);
            });
        }
        console.log();

        // 6. Check metrics
        console.log('6️⃣  Checking performance metrics...');
        const metricsRes = await axios.get(`${BASE_URL}/api/evaluation/metrics`);
        console.log(`   Total evaluations: ${metricsRes.data.totalEvaluations}`);

        if (metricsRes.data.providers) {
            console.log('\n   Provider metrics:');
            for (const [provider, data] of Object.entries(metricsRes.data.providers)) {
                const overall = data.overall;
                if (overall.count > 0) {
                    console.log(`   - ${provider}:`);
                    console.log(`     Count: ${overall.count}`);
                    console.log(`     Win rate: ${(overall.winRate * 100).toFixed(1)}%`);
                    console.log(`     Avg score: ${overall.avgScore.toFixed(1)}/50`);
                }
            }
        }
        console.log();

        // 7. Check current weights
        console.log('7️⃣  Checking current weights...');
        const weightsRes = await axios.get(`${BASE_URL}/api/evaluation/weights`);
        console.log('   Current weights:', weightsRes.data.current);
        console.log('   Optimizer status:', weightsRes.data.status.enabled ? 'enabled' : 'disabled');
        console.log();

        // 8. Manually trigger weight update (if enough data)
        if (metricsRes.data.totalEvaluations >= 5) {
            console.log('8️⃣  Triggering manual weight update...');
            const updateRes = await axios.post(`${BASE_URL}/api/evaluation/weights/update`);
            console.log('   ✅ Weights updated:', updateRes.data.weights);
        } else {
            console.log('8️⃣  Skipping weight update (need ≥50 evaluations, have ' + metricsRes.data.totalEvaluations + ')');
        }
        console.log();

        console.log('✅ Phase 4 test complete!\n');
        console.log('📊 Summary:');
        console.log(`   - Shadow routing: ${queueRes.data.status}`);
        console.log(`   - Comparisons processed: ${judgeRes.data.processed}`);
        console.log(`   - Total evaluations: ${metricsRes.data.totalEvaluations}`);
        console.log(`   - Weight optimizer: ${weightsRes.data.status.enabled ? 'running' : 'stopped'}`);

    } catch (err) {
        console.error('\n❌ Test failed:', err.message);
        if (err.response) {
            console.error('   Response:', err.response.data);
        }
    }
}

// Run test
testPhase4();
