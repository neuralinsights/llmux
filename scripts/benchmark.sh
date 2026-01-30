#!/bin/bash
set -e

echo "=== LLMux Performance Benchmark ==="
echo "Testing cache hit rate and cost savings"
echo ""

# 配置
BASE_URL="http://localhost:8765"
NUM_REQUESTS=100
NUM_UNIQUE_PROMPTS=10

# 检查服务是否运行
if ! curl -s "${BASE_URL}/health" > /dev/null; then
  echo "❌ LLMux is not running at ${BASE_URL}"
  exit 1
fi

echo "✅ LLMux is running"
echo ""

# 清空缓存
echo "Clearing cache..."
curl -s -X POST "${BASE_URL}/api/cache/clear" > /dev/null
echo "✅ Cache cleared"
echo ""

# 发送请求
echo "Sending ${NUM_REQUESTS} requests (${NUM_UNIQUE_PROMPTS} unique prompts)..."
START_TIME=$(date +%s)

for i in $(seq 1 $NUM_REQUESTS); do
  prompt_id=$((i % NUM_UNIQUE_PROMPTS))
  curl -s -X POST "${BASE_URL}/api/smart" \
    -H "Content-Type: application/json" \
    -d "{\"prompt\": \"Benchmark test prompt ${prompt_id}\", \"options\": {\"useCache\": true}}" \
    > /dev/null
  
  # 进度显示
  if [ $((i % 10)) -eq 0 ]; then
    echo "  Progress: ${i}/${NUM_REQUESTS}"
  fi
done

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo "✅ Completed in ${DURATION} seconds"
echo ""

# 获取缓存统计
echo "=== Cache Statistics ==="
STATS=$(curl -s "${BASE_URL}/api/cache/stats")
echo "$STATS" | jq

# 计算成本节省
HITS=$(echo "$STATS" | jq -r '.hits')
MISSES=$(echo "$STATS" | jq -r '.misses')
TOTAL=$((HITS + MISSES))
HIT_RATE=$(echo "scale=2; $HITS * 100 / $TOTAL" | bc)

echo ""
echo "=== Cost Savings Estimate ==="
echo "Total Requests: ${TOTAL}"
echo "Cache Hits: ${HITS}"
echo "Cache Misses: ${MISSES}"
echo "Hit Rate: ${HIT_RATE}%"
echo "Estimated Cost Saving: ~${HIT_RATE}% (assuming cache hits are free)"
echo ""
echo "Note: Actual savings depend on provider pricing and request complexity"
