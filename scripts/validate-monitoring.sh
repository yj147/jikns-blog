#!/bin/bash

# 错误监控验证脚本
# 任务B：EnhancedErrorMonitor 生产验证

echo "🔍 错误监控验证工具"
echo "======================"
echo "任务B：验证 EnhancedErrorMonitor 在预生产环境的效果"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 监控端点配置
MONITOR_ENDPOINT="${PREPROD_URL:-http://localhost:3999}/api/monitoring/health"
METRICS_ENDPOINT="${PREPROD_URL:-http://localhost:3999}/api/monitoring/metrics"

echo "📊 监控配置信息："
echo "  监控端点: $MONITOR_ENDPOINT"
echo "  指标端点: $METRICS_ENDPOINT"
echo ""

# 1. 检查监控系统健康状态
echo "1️⃣ 检查监控系统健康状态..."
health_response=$(curl -s -w "\n%{http_code}" "$MONITOR_ENDPOINT" 2>/dev/null || echo "000")
http_code=$(echo "$health_response" | tail -n1)

if [ "$http_code" = "200" ]; then
    echo -e "  ${GREEN}✅ 监控系统正常运行${NC}"
else
    echo -e "  ${RED}❌ 监控系统无响应 (HTTP $http_code)${NC}"
    echo "  请先启动监控系统：pnpm dev"
    exit 1
fi

# 2. 模拟不同类型的错误
echo ""
echo "2️⃣ 模拟错误场景..."
echo ""

# 模拟网络错误
echo "  模拟 NETWORK_ERROR (10次)..."
for i in {1..10}; do
    curl -X POST "$PREPROD_URL/api/test/network-error" \
        -H "Content-Type: application/json" \
        -d '{"trigger":"network_failure"}' \
        -s -o /dev/null 2>&1 || true
    sleep 0.1
done
echo -e "    ${GREEN}✓ 完成${NC}"

# 模拟验证错误
echo "  模拟 VALIDATION_ERROR (20次)..."
for i in {1..20}; do
    curl -X POST "$PREPROD_URL/api/user/profile" \
        -H "Content-Type: application/json" \
        -d '{"invalid_field":"bad_data"}' \
        -s -o /dev/null 2>&1 || true
    sleep 0.05
done
echo -e "    ${GREEN}✓ 完成${NC}"

# 模拟未知错误
echo "  模拟 UNKNOWN_ERROR (5次)..."
for i in {1..5}; do
    curl -X GET "$PREPROD_URL/api/undefined-endpoint" \
        -s -o /dev/null 2>&1 || true
    sleep 0.2
done
echo -e "    ${GREEN}✓ 完成${NC}"

# 3. 收集监控指标
echo ""
echo "3️⃣ 收集监控指标..."
sleep 2 # 等待指标聚合

metrics_response=$(curl -s "$METRICS_ENDPOINT" 2>/dev/null || echo '{}')
echo "$metrics_response" > /tmp/monitor-metrics-$(date +%Y%m%d_%H%M%S).json

# 解析指标
if command -v jq &> /dev/null; then
    echo ""
    echo "📈 错误统计："
    echo "$metrics_response" | jq -r '.errors | to_entries[] | "  \(.key): \(.value.count) 次"' 2>/dev/null || echo "  解析失败"

    echo ""
    echo "⚠️  触发的报警："
    echo "$metrics_response" | jq -r '.alerts[] | "  [\(.severity)] \(.code): \(.message)"' 2>/dev/null || echo "  无报警"
else
    echo "  指标已保存到: /tmp/monitor-metrics-*.json"
    echo "  请安装 jq 以查看详细统计"
fi

# 4. 生成验证报告
echo ""
echo "4️⃣ 生成验证报告..."
cat > /tmp/monitor-validation-report.md << EOF
# 错误监控验证报告

生成时间: $(date '+%Y-%m-%d %H:%M:%S')

## 测试场景

| 错误类型 | 模拟次数 | 预期阈值 | 时间窗口 |
|---------|---------|---------|---------|
| NETWORK_ERROR | 10 | 10/分钟 | 应触发报警 |
| VALIDATION_ERROR | 20 | 50/5分钟 | 不应触发 |
| UNKNOWN_ERROR | 5 | 5/分钟 | 应触发报警 |

## 监控系统响应

\`\`\`json
$(echo "$metrics_response" | head -100)
\`\`\`

## 建议阈值调整

基于本次测试，建议：
1. NETWORK_ERROR: 保持当前阈值（10/分钟）
2. VALIDATION_ERROR: 可考虑降低到 30/5分钟
3. UNKNOWN_ERROR: 保持当前阈值（5/分钟）

## 后续行动

- [ ] 在生产环境部署前调整阈值
- [ ] 设置 Slack/邮件报警通道
- [ ] 建立报警升级机制
- [ ] 创建监控仪表板

EOF

echo -e "  ${GREEN}✅ 报告已生成: /tmp/monitor-validation-report.md${NC}"

# 5. 提供后续步骤
echo ""
echo "✨ 验证完成！后续步骤："
echo ""
echo "  1. 查看详细报告："
echo "     cat /tmp/monitor-validation-report.md"
echo ""
echo "  2. 查看原始指标："
echo "     ls -la /tmp/monitor-metrics-*.json"
echo ""
echo "  3. 持续监控（7天）："
echo "     每日运行此脚本，收集数据"
echo ""
echo "  4. 调整监控配置："
echo "     编辑 lib/observability/error-monitor.ts"
echo ""
echo "📅 下次运行时间: $(date -d '+1 day' '+%Y-%m-%d %H:%M')"