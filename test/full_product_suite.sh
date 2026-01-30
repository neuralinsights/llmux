#!/bin/bash

# LLMux Full Product Test Suite
# Runs all unit, integration, and system tests.

EXIT_CODE=0

echo "========================================"
echo "    LLMux Comprehensive Test Suite"
echo "========================================"

echo ""
echo "[1/4] Running Jest Unit & Integration Tests..."
# Force experimental-vm-modules for Edge tests
export NODE_OPTIONS=--experimental-vm-modules
npm test -- --verbose
if [ $? -ne 0 ]; then
    echo "❌ Jest Tests Failed"
    EXIT_CODE=1
else
    echo "✅ Jest Tests Passed"
fi
echo ""

echo "[2/4] Starting Main Server for System Tests..."
export PORT=8765
export LOG_LEVEL=error
export AI_ROUTING_RATE=1.0
node src/index.js > /dev/null 2>&1 &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"
echo "Waiting 5s for startup..."
sleep 5

echo ""
echo "[3/4] Running Live Verification Scripts..."

echo ">> Verifying Plugins..."
node test/verify_plugins.js
if [ $? -ne 0 ]; then
    echo "❌ Plugin Verification Failed"
    EXIT_CODE=1
else 
    echo "✅ Plugin Verification Passed"
fi

echo ">> Verifying AI Routing (Live)..."
# verify_routing.js expects server running
node test/verify_routing.js
if [ $? -ne 0 ]; then
    echo "❌ Routing Verification Failed"
    EXIT_CODE=1
else 
    echo "✅ Routing Verification Passed"
fi

echo ""
echo "[4/4] Running MCP Integration Tests..."
# verify_mcp_advanced.js spawns 'npm run mcp' which connects to our running server
node test/verify_mcp_advanced.js
if [ $? -ne 0 ]; then
    echo "❌ MCP Verification Failed"
    EXIT_CODE=1
else 
    echo "✅ MCP Verification Passed"
fi

# Cleanup
echo ""
echo "Stopping Server..."
kill $SERVER_PID

echo "========================================"
if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ ALL SYSTEMS GO - FULL SUITE PASSED"
else
    echo "❌ SOME TESTS FAILED"
fi
echo "========================================"

exit $EXIT_CODE
