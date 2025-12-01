const fs = require('fs');

const files = [
  'phase2-font_run1_20251112.json',
  'phase2-font_run2_20251112.json',
  'phase2-font_run3_20251112.json',
  'phase2-font_run4_20251112.json',
  'phase2-font_run5_20251112.json'
];

const results = [];

files.forEach((file, i) => {
  const data = JSON.parse(fs.readFileSync(`perf-results/${file}`, 'utf8'));

  const fontDisplay = data.audits['font-display'];
  const mainThread = data.audits['mainthread-work-breakdown'];
  const tti = data.audits.interactive.numericValue;
  const lcp = data.audits['largest-contentful-paint'].numericValue;
  const tbt = data.audits['total-blocking-time'].numericValue;
  const score = data.categories.performance.score * 100;

  let styleLayout = 0;
  if (mainThread?.details?.items) {
    const item = mainThread.details.items.find(x => x.group === 'styleLayout');
    styleLayout = item ? item.duration : 0;
  }

  results.push({
    run: i + 1,
    fontDisplayPassed: fontDisplay?.score === 1,
    fontDisplayScore: fontDisplay?.score || 0,
    styleLayout: Math.round(styleLayout),
    tti: Math.round(tti),
    lcp: Math.round(lcp),
    tbt: Math.round(tbt),
    score: Math.round(score)
  });
});

// 计算中位数
const median = (arr) => {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const medians = {
  styleLayout: Math.round(median(results.map(r => r.styleLayout))),
  tti: Math.round(median(results.map(r => r.tti))),
  lcp: Math.round(median(results.map(r => r.lcp))),
  tbt: Math.round(median(results.map(r => r.tbt))),
  score: Math.round(median(results.map(r => r.score)))
};

// 生成报告
let report = `# Phase 2: 字体优化验证报告

## 测试环境
- **测试页面**: 首页 (http://localhost:3999/)
- **测试时间**: 2025-11-12
- **测试次数**: 5次
- **Lighthouse配置**: Desktop预设, 模拟节流, 仅性能类别

## 字体优化措施
1. ✅ 所有@font-face添加 \`font-display: swap\`
2. ✅ 添加系统字体fallback栈: \`-apple-system, BlinkMacSystemFont, Segoe UI, system-ui\`
3. ✅ GeistSans迁移至本地字体 (next/font/local)

## font-display审计结果

| 测试轮次 | font-display通过 | 审计分数 |
|---------|------------------|---------|
`;

results.forEach(r => {
  report += `| Run ${r.run} | ${r.fontDisplayPassed ? '✅ 通过' : '❌ 失败'} | ${r.fontDisplayScore} |\n`;
});

const allPassed = results.every(r => r.fontDisplayPassed);
report += `\n**结论**: ${allPassed ? '✅ 所有测试轮次的font-display审计均通过' : '⚠️ 部分测试未通过font-display审计'}\n`;

report += `\n## 性能指标对比

| 指标 | Run 1 | Run 2 | Run 3 | Run 4 | Run 5 | 中位数 |
|------|-------|-------|-------|-------|-------|--------|
| Style & Layout (ms) | ${results[0].styleLayout} | ${results[1].styleLayout} | ${results[2].styleLayout} | ${results[3].styleLayout} | ${results[4].styleLayout} | ${medians.styleLayout} |
| TTI (ms) | ${results[0].tti} | ${results[1].tti} | ${results[2].tti} | ${results[3].tti} | ${results[4].tti} | ${medians.tti} |
| LCP (ms) | ${results[0].lcp} | ${results[1].lcp} | ${results[2].lcp} | ${results[3].lcp} | ${results[4].lcp} | ${medians.lcp} |
| TBT (ms) | ${results[0].tbt} | ${results[1].tbt} | ${results[2].tbt} | ${results[3].tbt} | ${results[4].tbt} | ${medians.tbt} |
| Performance Score | ${results[0].score} | ${results[1].score} | ${results[2].score} | ${results[3].score} | ${results[4].score} | ${medians.score} |

## 关键发现

### 1. font-display审计
${allPassed ?
  '- ✅ **所有轮次通过**: 确认 `display: "swap"` 配置生效，避免了字体加载阻塞首屏渲染' :
  '- ⚠️ **部分轮次未通过**: 需检查font-display配置是否完全生效'}

### 2. Style & Layout性能
- **中位数**: ${medians.styleLayout}ms
- **说明**: 由于测试页面从Feed切换到首页（组件复杂度不同），此数据无法直接与Phase 1.2基准（190.36ms）对比
- **下一步**: 建议在关键CSS内联优化后，重新测试Feed页面以获得可比较的数据

### 3. 核心Web Vitals
- **TTI中位数**: ${medians.tti}ms
- **LCP中位数**: ${medians.lcp}ms
- **TBT中位数**: ${medians.tbt}ms
- **性能分数**: ${medians.score}/100

## 下一步行动

1. ✅ 字体优化验证完成
2. 🔄 启动关键CSS内联实验
3. 📊 完成关键CSS优化后，重新测试Feed页面以获得可比数据
4. 📝 更新 \`perf-results/phase2-longtask-analysis.md\` 记录优化轨迹
`;

fs.writeFileSync('perf-results/phase2-font-optimization-results.md', report);
console.log('报告已生成: perf-results/phase2-font-optimization-results.md');
console.log('\n=== 关键指标摘要 ===');
console.log(`font-display审计: ${allPassed ? '✅ 全部通过' : '⚠️ 部分未通过'}`);
console.log(`Style & Layout中位数: ${medians.styleLayout}ms`);
console.log(`性能分数中位数: ${medians.score}/100`);
