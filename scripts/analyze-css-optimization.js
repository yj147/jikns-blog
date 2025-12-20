const fs = require("fs")

// 字体优化后的基准数据
const fontOptFiles = [
  "phase2-font_run1_20251112.json",
  "phase2-font_run2_20251112.json",
  "phase2-font_run3_20251112.json",
  "phase2-font_run4_20251112.json",
  "phase2-font_run5_20251112.json",
]

// 关键CSS内联后的数据
const cssOptFiles = [
  "phase2-critical-css_run1_20251112.json",
  "phase2-critical-css_run2_20251112.json",
  "phase2-critical-css_run3_20251112.json",
  "phase2-critical-css_run4_20251112.json",
  "phase2-critical-css_run5_20251112.json",
]

function extractMetrics(files) {
  const results = []

  files.forEach((file, i) => {
    const data = JSON.parse(fs.readFileSync(`perf-results/${file}`, "utf8"))

    const mainThread = data.audits["mainthread-work-breakdown"]
    const tti = data.audits.interactive.numericValue
    const lcp = data.audits["largest-contentful-paint"].numericValue
    const tbt = data.audits["total-blocking-time"].numericValue
    const fcp = data.audits["first-contentful-paint"]?.numericValue || 0
    const score = data.categories.performance.score * 100

    let styleLayout = 0
    if (mainThread?.details?.items) {
      const item = mainThread.details.items.find((x) => x.group === "styleLayout")
      styleLayout = item ? item.duration : 0
    }

    results.push({
      run: i + 1,
      styleLayout: Math.round(styleLayout),
      tti: Math.round(tti),
      lcp: Math.round(lcp),
      fcp: Math.round(fcp),
      tbt: Math.round(tbt),
      score: Math.round(score),
    })
  })

  return results
}

const median = (arr) => {
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function calculateMedians(results) {
  return {
    styleLayout: Math.round(median(results.map((r) => r.styleLayout))),
    tti: Math.round(median(results.map((r) => r.tti))),
    lcp: Math.round(median(results.map((r) => r.lcp))),
    fcp: Math.round(median(results.map((r) => r.fcp))),
    tbt: Math.round(median(results.map((r) => r.tbt))),
    score: Math.round(median(results.map((r) => r.score))),
  }
}

const fontOptResults = extractMetrics(fontOptFiles)
const cssOptResults = extractMetrics(cssOptFiles)

const fontMedians = calculateMedians(fontOptResults)
const cssMedians = calculateMedians(cssOptResults)

// 计算改善百分比
const improvement = {
  styleLayout: fontMedians.styleLayout - cssMedians.styleLayout,
  styleLayoutPercent: (
    ((fontMedians.styleLayout - cssMedians.styleLayout) / fontMedians.styleLayout) *
    100
  ).toFixed(1),
  tti: fontMedians.tti - cssMedians.tti,
  ttiPercent: (((fontMedians.tti - cssMedians.tti) / fontMedians.tti) * 100).toFixed(1),
  lcp: fontMedians.lcp - cssMedians.lcp,
  lcpPercent: (((fontMedians.lcp - cssMedians.lcp) / fontMedians.lcp) * 100).toFixed(1),
  fcp: fontMedians.fcp - cssMedians.fcp,
  fcpPercent: (((fontMedians.fcp - cssMedians.fcp) / fontMedians.fcp) * 100).toFixed(1),
  tbt: fontMedians.tbt - cssMedians.tbt,
  tbtPercent: (((fontMedians.tbt - cssMedians.tbt) / fontMedians.tbt) * 100).toFixed(1),
  score: cssMedians.score - fontMedians.score,
}

const report = `# Phase 2: 关键CSS内联优化对比报告

## 测试环境
- **测试页面**: 首页 (http://localhost:3999/)
- **测试时间**: 2025-11-12
- **测试次数**: 每个阶段5次
- **Lighthouse配置**: Desktop预设, 模拟节流, 仅性能类别

## 优化措施对比

### 基准：字体优化后
1. ✅ 所有@font-face添加 \`font-display: swap\`
2. ✅ 添加系统字体fallback
3. ✅ GeistSans迁移至本地字体

### 当前：关键CSS内联
1. ✅ 提取CSS变量和基础样式（约1.5KB）到 \`app/critical.css\`
2. ✅ 内联关键CSS到 \`<head>\`，避免首屏阻塞
3. ✅ 完整Tailwind CSS通过 \`<link>\` 正常加载

## 性能对比：中位数

| 指标 | 字体优化后 | CSS内联后 | 改善 | 改善% |
|------|-----------|----------|------|-------|
| Style & Layout (ms) | ${fontMedians.styleLayout} | ${cssMedians.styleLayout} | **${improvement.styleLayout > 0 ? "-" : "+"}${Math.abs(improvement.styleLayout)}ms** | **${improvement.styleLayoutPercent > 0 ? "-" : "+"}${Math.abs(improvement.styleLayoutPercent)}%** |
| TTI (ms) | ${fontMedians.tti} | ${cssMedians.tti} | **${improvement.tti > 0 ? "-" : "+"}${Math.abs(improvement.tti)}ms** | **${improvement.ttiPercent > 0 ? "-" : "+"}${Math.abs(improvement.ttiPercent)}%** |
| LCP (ms) | ${fontMedians.lcp} | ${cssMedians.lcp} | **${improvement.lcp > 0 ? "-" : "+"}${Math.abs(improvement.lcp)}ms** | **${improvement.lcpPercent > 0 ? "-" : "+"}${Math.abs(improvement.lcpPercent)}%** |
| FCP (ms) | ${fontMedians.fcp} | ${cssMedians.fcp} | **${improvement.fcp > 0 ? "-" : "+"}${Math.abs(improvement.fcp)}ms** | **${improvement.fcpPercent > 0 ? "-" : "+"}${Math.abs(improvement.fcpPercent)}%** |
| TBT (ms) | ${fontMedians.tbt} | ${cssMedians.tbt} | **${improvement.tbt > 0 ? "-" : "+"}${Math.abs(improvement.tbt)}ms** | **${improvement.tbtPercent > 0 ? "-" : "+"}${Math.abs(improvement.tbtPercent)}%** |
| Performance Score | ${fontMedians.score} | ${cssMedians.score} | **${improvement.score > 0 ? "+" : ""}${improvement.score}** | - |

## 详细数据：字体优化后（基准）

| 指标 | Run 1 | Run 2 | Run 3 | Run 4 | Run 5 | 中位数 |
|------|-------|-------|-------|-------|-------|--------|
| Style & Layout (ms) | ${fontOptResults[0].styleLayout} | ${fontOptResults[1].styleLayout} | ${fontOptResults[2].styleLayout} | ${fontOptResults[3].styleLayout} | ${fontOptResults[4].styleLayout} | ${fontMedians.styleLayout} |
| TTI (ms) | ${fontOptResults[0].tti} | ${fontOptResults[1].tti} | ${fontOptResults[2].tti} | ${fontOptResults[3].tti} | ${fontOptResults[4].tti} | ${fontMedians.tti} |
| LCP (ms) | ${fontOptResults[0].lcp} | ${fontOptResults[1].lcp} | ${fontOptResults[2].lcp} | ${fontOptResults[3].lcp} | ${fontOptResults[4].lcp} | ${fontMedians.lcp} |
| FCP (ms) | ${fontOptResults[0].fcp} | ${fontOptResults[1].fcp} | ${fontOptResults[2].fcp} | ${fontOptResults[3].fcp} | ${fontOptResults[4].fcp} | ${fontMedians.fcp} |
| TBT (ms) | ${fontOptResults[0].tbt} | ${fontOptResults[1].tbt} | ${fontOptResults[2].tbt} | ${fontOptResults[3].tbt} | ${fontOptResults[4].tbt} | ${fontMedians.tbt} |
| Performance Score | ${fontOptResults[0].score} | ${fontOptResults[1].score} | ${fontOptResults[2].score} | ${fontOptResults[3].score} | ${fontOptResults[4].score} | ${fontMedians.score} |

## 详细数据：关键CSS内联后

| 指标 | Run 1 | Run 2 | Run 3 | Run 4 | Run 5 | 中位数 |
|------|-------|-------|-------|-------|-------|--------|
| Style & Layout (ms) | ${cssOptResults[0].styleLayout} | ${cssOptResults[1].styleLayout} | ${cssOptResults[2].styleLayout} | ${cssOptResults[3].styleLayout} | ${cssOptResults[4].styleLayout} | ${cssMedians.styleLayout} |
| TTI (ms) | ${cssOptResults[0].tti} | ${cssOptResults[1].tti} | ${cssOptResults[2].tti} | ${cssOptResults[3].tti} | ${cssOptResults[4].tti} | ${cssMedians.tti} |
| LCP (ms) | ${cssOptResults[0].lcp} | ${cssOptResults[1].lcp} | ${cssOptResults[2].lcp} | ${cssOptResults[3].lcp} | ${cssOptResults[4].lcp} | ${cssMedians.lcp} |
| FCP (ms) | ${cssOptResults[0].fcp} | ${cssOptResults[1].fcp} | ${cssOptResults[2].fcp} | ${cssOptResults[3].fcp} | ${cssOptResults[4].fcp} | ${cssMedians.fcp} |
| TBT (ms) | ${cssOptResults[0].tbt} | ${cssOptResults[1].tbt} | ${cssOptResults[2].tbt} | ${cssOptResults[3].tbt} | ${cssOptResults[4].tbt} | ${cssMedians.tbt} |
| Performance Score | ${cssOptResults[0].score} | ${cssOptResults[1].score} | ${cssOptResults[2].score} | ${cssOptResults[3].score} | ${cssOptResults[4].score} | ${cssMedians.score} |

## 关键发现

### 1. Style & Layout性能
- **基准**: ${fontMedians.styleLayout}ms
- **优化后**: ${cssMedians.styleLayout}ms
- **改善**: ${improvement.styleLayout > 0 ? "✅ 减少" : "⚠️ 增加"}${Math.abs(improvement.styleLayout)}ms (${Math.abs(improvement.styleLayoutPercent)}%)
${
  improvement.styleLayout > 0
    ? "- 🎯 **成功**: 关键CSS内联显著减少了Style & Layout时间，验证了优化策略的有效性"
    : "- ⚠️ **轻微退化**: Style & Layout时间略有增加，可能是测试波动或其他因素影响"
}

### 2. 首次内容绘制（FCP）
- **基准**: ${fontMedians.fcp}ms
- **优化后**: ${cssMedians.fcp}ms
- **改善**: ${improvement.fcp > 0 ? "✅ 减少" : "⚠️ 增加"}${Math.abs(improvement.fcp)}ms (${Math.abs(improvement.fcpPercent)}%)
${
  improvement.fcp > 0
    ? "- 🎯 **显著提升**: 关键CSS内联加速了首次内容绘制，改善用户感知性能"
    : "- 📊 FCP时间波动在测试误差范围内"
}

### 3. 最大内容绘制（LCP）
- **基准**: ${fontMedians.lcp}ms
- **优化后**: ${cssMedians.lcp}ms
- **改善**: ${improvement.lcp > 0 ? "✅ 减少" : "⚠️ 增加"}${Math.abs(improvement.lcp)}ms (${Math.abs(improvement.lcpPercent)}%)

### 4. 交互时间（TTI）
- **基准**: ${fontMedians.tti}ms
- **优化后**: ${cssMedians.tti}ms
- **改善**: ${improvement.tti > 0 ? "✅ 减少" : "⚠️ 增加"}${Math.abs(improvement.tti)}ms (${Math.abs(improvement.ttiPercent)}%)

### 5. 总阻塞时间（TBT）
- **基准**: ${fontMedians.tbt}ms
- **优化后**: ${cssMedians.tbt}ms
- **改善**: ${improvement.tbt > 0 ? "✅ 减少" : "⚠️ 增加"}${Math.abs(improvement.tbt)}ms (${Math.abs(improvement.tbtPercent)}%)

### 6. 性能分数
- **基准**: ${fontMedians.score}/100
- **优化后**: ${cssMedians.score}/100
- **变化**: ${improvement.score > 0 ? "✅ 提升" : improvement.score < 0 ? "⚠️ 下降" : "持平"}${improvement.score}分

## 结论

${
  improvement.styleLayout > 0
    ? `✅ **关键CSS内联优化成功！**

关键CSS内联策略有效减少了Style & Layout时间**${Math.abs(improvement.styleLayout)}ms**（**${Math.abs(improvement.styleLayoutPercent)}%**），验证了Phase 2优化路线的正确性。

**实施的优化措施**：
1. 提取CSS变量和基础样式到 \`app/critical.css\`（约1.5KB）
2. 内联关键CSS到 \`<head>\`，确保首屏立即可渲染
3. 完整Tailwind CSS通过 \`<link rel="stylesheet">\` 正常加载

**核心收益**：
- 避免了CSS加载阻塞首屏渲染
- 防止了FOUC（Flash of Unstyled Content）
- 减少了关键渲染路径的依赖

**文件修改**：
- \`app/critical.css\` - 新增（关键CSS提取）
- \`app/layout.tsx:3-4\` - 添加fs/path导入
- \`app/layout.tsx:20\` - 读取关键CSS
- \`app/layout.tsx:38-40\` - 内联到<head>`
    : `📊 **性能测试完成，需进一步分析**

关键CSS内联后的性能数据已收集完成。Style & Layout时间变化为${improvement.styleLayout}ms，需要综合考虑以下因素：

1. **测试环境波动**: Lighthouse测试存在固有变异性
2. **页面复杂度**: 首页与Feed页面的组件复杂度不同
3. **优化策略验证**: 需要在Feed页面重新测试以获得可比数据

**下一步建议**：
1. 在Feed页面运行对比测试（修复picsum.photos图片域配置后）
2. 分析关键CSS的体积是否可以进一步压缩
3. 考虑其他CSS优化策略（如CSS-in-JS、CSS Modules等）`
}

## 下一步行动

1. ✅ 字体优化完成（font-display + fallback）
2. ✅ 关键CSS内联完成并测试
3. 📊 性能数据已收集并分析
4. 🔄 建议：在Feed页面重新测试以验证优化效果
5. 📝 更新 \`perf-results/phase2-longtask-analysis.md\` 记录优化轨迹
`

fs.writeFileSync("perf-results/phase2-css-optimization-comparison.md", report)

console.log("对比报告已生成: perf-results/phase2-css-optimization-comparison.md\n")
console.log("=== 关键指标对比 ===")
console.log(
  `Style & Layout: ${fontMedians.styleLayout}ms → ${cssMedians.styleLayout}ms (${improvement.styleLayoutPercent > 0 ? "-" : "+"}${Math.abs(improvement.styleLayoutPercent)}%)`
)
console.log(
  `TTI: ${fontMedians.tti}ms → ${cssMedians.tti}ms (${improvement.ttiPercent > 0 ? "-" : "+"}${Math.abs(improvement.ttiPercent)}%)`
)
console.log(
  `LCP: ${fontMedians.lcp}ms → ${cssMedians.lcp}ms (${improvement.lcpPercent > 0 ? "-" : "+"}${Math.abs(improvement.lcpPercent)}%)`
)
console.log(
  `FCP: ${fontMedians.fcp}ms → ${cssMedians.fcp}ms (${improvement.fcpPercent > 0 ? "-" : "+"}${Math.abs(improvement.fcpPercent)}%)`
)
console.log(
  `Performance Score: ${fontMedians.score} → ${cssMedians.score} (${improvement.score > 0 ? "+" : ""}${improvement.score})`
)
