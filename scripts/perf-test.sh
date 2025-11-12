#!/bin/bash

# Feed 页面性能自动化测试脚本
# 用途：消除测试环境波动，建立可靠性能基线

set -e

# 配置参数
PORT=3010
TEST_URL="http://localhost:${PORT}/feed"
RUNS=5
OUTPUT_DIR="./perf-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
CHROME_PATH="/home/jikns/.cache/ms-playwright/chromium-1187/chrome-linux/chrome"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Feed 页面性能自动化测试${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 创建输出目录
mkdir -p "${OUTPUT_DIR}"

# 步骤 1: 清空构建缓存
echo -e "${YELLOW}[1/6]${NC} 清空构建缓存..."
rm -rf .next
echo -e "${GREEN}✓${NC} 缓存已清空"
echo ""

# 步骤 2: 重新构建
echo -e "${YELLOW}[2/6]${NC} 重新构建项目..."
pnpm build > "${OUTPUT_DIR}/build_${TIMESTAMP}.log" 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} 构建成功"
else
    echo -e "${RED}✗${NC} 构建失败，查看日志: ${OUTPUT_DIR}/build_${TIMESTAMP}.log"
    exit 1
fi
echo ""

# 步骤 3: 启动服务
echo -e "${YELLOW}[3/6]${NC} 启动 Next.js 服务 (端口 ${PORT})..."

# 停止旧进程
lsof -ti:${PORT} 2>/dev/null | xargs -r kill -9 && echo "已停止旧进程" || echo "无旧进程运行"

# 启动新进程
PORT=${PORT} pnpm start > "${OUTPUT_DIR}/server_${TIMESTAMP}.log" 2>&1 &
SERVER_PID=$!
echo "服务进程 PID: ${SERVER_PID}"

# 等待服务就绪
echo -n "等待服务启动"
for i in {1..30}; do
    sleep 1
    if curl -s -o /dev/null -w "%{http_code}" ${TEST_URL} | grep -q "200"; then
        echo ""
        echo -e "${GREEN}✓${NC} 服务已就绪"
        break
    fi
    echo -n "."
    if [ $i -eq 30 ]; then
        echo ""
        echo -e "${RED}✗${NC} 服务启动超时"
        kill ${SERVER_PID}
        exit 1
    fi
done
echo ""

# 步骤 4: 记录系统状态
echo -e "${YELLOW}[4/6]${NC} 记录系统状态..."
{
    echo "=== 测试时间 ==="
    date
    echo ""
    echo "=== CPU 信息 ==="
    top -bn1 | head -5
    echo ""
    echo "=== 内存信息 ==="
    free -h
    echo ""
    echo "=== 磁盘信息 ==="
    df -h /
} > "${OUTPUT_DIR}/system_${TIMESTAMP}.log"
echo -e "${GREEN}✓${NC} 系统状态已记录"
echo ""

# 步骤 5: 运行 Lighthouse 测试
echo -e "${YELLOW}[5/6]${NC} 运行 Lighthouse 测试 (${RUNS} 次)..."
echo ""

TTI_VALUES=()
LCP_VALUES=()
TBT_VALUES=()
PERF_SCORES=()

for i in $(seq 1 ${RUNS}); do
    echo -e "${YELLOW}测试 ${i}/${RUNS}${NC}"

    OUTPUT_FILE="${OUTPUT_DIR}/lighthouse_run${i}_${TIMESTAMP}.json"

    CHROME_PATH=${CHROME_PATH} npx lighthouse ${TEST_URL} \
        --only-categories=performance \
        --throttling-method=simulate \
        --output=json \
        --output-path="${OUTPUT_FILE}" \
        --chrome-flags="--headless --no-sandbox --disable-gpu" \
        --quiet 2>&1 | grep -E "(Lighthouse|score)" || true

    if [ -f "${OUTPUT_FILE}" ]; then
        # 提取关键指标
        TTI=$(node -e "console.log(require('./${OUTPUT_FILE}').audits.interactive.numericValue)")
        LCP=$(node -e "console.log(require('./${OUTPUT_FILE}').audits['largest-contentful-paint'].numericValue)")
        TBT=$(node -e "console.log(require('./${OUTPUT_FILE}').audits['total-blocking-time'].numericValue)")
        SCORE=$(node -e "console.log((require('./${OUTPUT_FILE}').categories.performance.score * 100).toFixed(0))")

        TTI_VALUES+=($TTI)
        LCP_VALUES+=($LCP)
        TBT_VALUES+=($TBT)
        PERF_SCORES+=($SCORE)

        echo "  TTI: $(echo "scale=3; $TTI/1000" | bc)s | LCP: $(echo "scale=3; $LCP/1000" | bc)s | TBT: ${TBT}ms | Score: ${SCORE}"
    else
        echo -e "${RED}  ✗ 测试失败${NC}"
    fi

    # 测试间隔
    if [ $i -lt ${RUNS} ]; then
        sleep 2
    fi
    echo ""
done

# 步骤 6: 计算统计数据
echo -e "${YELLOW}[6/6]${NC} 生成性能报告..."

# 使用 node 计算统计数据
node -e "
const values = {
    tti: [${TTI_VALUES[@]}],
    lcp: [${LCP_VALUES[@]}],
    tbt: [${TBT_VALUES[@]}],
    score: [${PERF_SCORES[@]}]
};

function median(arr) {
    const sorted = arr.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
}

function mean(arr) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr) {
    const avg = mean(arr);
    const squareDiffs = arr.map(value => Math.pow(value - avg, 2));
    return Math.sqrt(mean(squareDiffs));
}

console.log('\n=== 性能基线统计报告 ===\n');
console.log('测试时间: ' + new Date().toISOString());
console.log('测试次数: ${RUNS}');
console.log('');

['tti', 'lcp', 'tbt', 'score'].forEach(metric => {
    const data = values[metric];
    const med = median(data);
    const avg = mean(data);
    const std = stdDev(data);
    const min = Math.min(...data);
    const max = Math.max(...data);

    const unit = metric === 'tbt' ? 'ms' : (metric === 'score' ? '' : 's');
    const scale = (metric === 'tti' || metric === 'lcp') ? 1000 : 1;

    console.log(\`\${metric.toUpperCase()}:\`);
    console.log(\`  中位数: \${(med / scale).toFixed(3)}\${unit}\`);
    console.log(\`  平均值: \${(avg / scale).toFixed(3)}\${unit}\`);
    console.log(\`  标准差: \${(std / scale).toFixed(3)}\${unit}\`);
    console.log(\`  范围: \${(min / scale).toFixed(3)} - \${(max / scale).toFixed(3)}\${unit}\`);
    console.log('');
});

console.log('=== 稳定性评估 ===\n');
const ttiStd = stdDev(values.tti);
if (ttiStd < 50) {
    console.log('✓ TTI 稳定性: 优秀 (标准差 < 50ms)');
} else if (ttiStd < 100) {
    console.log('⚠ TTI 稳定性: 良好 (标准差 < 100ms)');
} else {
    console.log('✗ TTI 稳定性: 较差 (标准差 >= 100ms)');
    console.log('  建议: 增加测试次数或检查系统负载');
}
console.log('');
" | tee "${OUTPUT_DIR}/report_${TIMESTAMP}.txt"

# 清理
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}测试完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "结果文件保存在: ${OUTPUT_DIR}/"
echo "  - 性能报告: report_${TIMESTAMP}.txt"
echo "  - Lighthouse 数据: lighthouse_run*_${TIMESTAMP}.json"
echo "  - 构建日志: build_${TIMESTAMP}.log"
echo "  - 服务日志: server_${TIMESTAMP}.log"
echo "  - 系统状态: system_${TIMESTAMP}.log"
echo ""
echo "停止服务进程 (PID: ${SERVER_PID})..."
kill ${SERVER_PID} 2>/dev/null || echo "进程已停止"
echo ""
echo -e "${GREEN}✓ 全部完成${NC}"
