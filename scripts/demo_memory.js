/**
 * Test script for Phase 3: Context Mesh
 * Tests memory storage and recall
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:8765';

async function testMemory() {
    console.log('🧠 Testing Phase 3: Stateful Context Mesh\n');

    try {
        // Test 1: Store a fact
        console.log('1️⃣  Storing fact: "My name is Alice"');
        const response1 = await axios.post(`${BASE_URL}/api/smart`, {
            prompt: 'My name is Alice and I work on the LLMux project.',
            options: {}
        });
        console.log(`   ✅ Response: ${response1.data.response.slice(0, 100)}...\n`);

        // Wait for embedding to process
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Test 2: Recall the fact
        console.log('2️⃣  Recalling fact: "What is my name?"');
        const response2 = await axios.post(`${BASE_URL}/api/smart`, {
            prompt: 'What is my name?',
            options: {}
        });
        console.log(`   ✅ Response: ${response2.data.response.slice(0, 100)}...\n`);

        // Test 3: Recall project context
        console.log('3️⃣  Recalling context: "What project am I working on?"');
        const response3 = await axios.post(`${BASE_URL}/api/smart`, {
            prompt: 'What project am I working on?',
            options: {}
        });
        console.log(`   ✅ Response: ${response3.data.response.slice(0, 100)}...\n`);

        // Test 4: Opt-out of memory
        console.log('4️⃣  Testing opt-out (disableMemory: true)');
        const response4 = await axios.post(`${BASE_URL}/api/smart`, {
            prompt: 'This should not be stored in memory.',
            options: { disableMemory: true }
        });
        console.log(`   ✅ Response: ${response4.data.response.slice(0, 100)}...\n`);

        console.log('✅ All tests completed!');
        console.log('\n📊 Check the dashboard at http://localhost:8765/dashboard/index.html');
        console.log('   Look for CONTEXT_INJECTION and MEMORY_STORED events.');

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
    }
}

testMemory();
