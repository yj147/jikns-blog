const fs = require('fs');

// 读取CSS优化后的一个样本文件
const data = JSON.parse(fs.readFileSync('perf-results/phase2-critical-css_run3_20251112.json', 'utf8'));

const mainThread = data.audits['mainthread-work-breakdown'];

console.log('=== Phase 2 CSS优化后的主线程工作分解 ===\n');

if (mainThread?.details?.items) {
  const items = mainThread.details.items;
  const total = items.reduce((sum, item) => sum + item.duration, 0);

  console.log('| 工作类型 | 耗时(ms) | 占比(%) |');
  console.log('|---------|---------|---------|');

  items
    .sort((a, b) => b.duration - a.duration)
    .forEach(item => {
      const percent = (item.duration / total * 100).toFixed(1);
      console.log(`| ${item.groupLabel} | ${Math.round(item.duration)} | ${percent}% |`);
    });

  console.log(`\n总主线程时间: ${Math.round(total)}ms`);

  // 识别主要瓶颈（>5%）
  console.log('\n=== Phase 3 潜在优化目标（占比>5%）===\n');
  items
    .filter(item => item.duration / total > 0.05)
    .sort((a, b) => b.duration - a.duration)
    .forEach(item => {
      const percent = (item.duration / total * 100).toFixed(1);
      console.log(`- ${item.groupLabel}: ${Math.round(item.duration)}ms (${percent}%)`);
    });
}

// 检查JavaScript相关指标
console.log('\n=== JavaScript性能指标 ===\n');
console.log(`- Bootup Time: ${Math.round(data.audits['bootup-time'].numericValue)}ms`);
console.log(`- Total Byte Weight: ${Math.round(data.audits['total-byte-weight'].numericValue / 1024)}KB`);

// 检查DOM相关指标
if (data.audits['dom-size']) {
  console.log('\n=== DOM复杂度 ===\n');
  console.log(`- DOM节点数: ${data.audits['dom-size'].numericValue}`);
  if (data.audits['dom-size'].details?.items?.[0]) {
    const domStats = data.audits['dom-size'].details.items[0];
    console.log(`- 最大深度: ${domStats.value?.value || 'N/A'}`);
  }
}

// 检查未使用的代码
if (data.audits['unused-javascript']) {
  console.log('\n=== 未使用的JavaScript ===\n');
  const wastedBytes = data.audits['unused-javascript'].details?.overallSavingsBytes || 0;
  const wastedMs = data.audits['unused-javascript'].details?.overallSavingsMs || 0;
  console.log(`- 可节省大小: ${Math.round(wastedBytes / 1024)}KB`);
  console.log(`- 可节省时间: ${Math.round(wastedMs)}ms`);
}

// 检查第三方代码
if (data.audits['third-party-summary']) {
  console.log('\n=== 第三方代码影响 ===\n');
  const thirdParty = data.audits['third-party-summary'];
  if (thirdParty.details?.items?.length > 0) {
    thirdParty.details.items
      .sort((a, b) => b.blockingTime - a.blockingTime)
      .slice(0, 5)
      .forEach(item => {
        console.log(`- ${item.entity}: ${Math.round(item.blockingTime)}ms阻塞时间`);
      });
  }
}

// 检查长任务
if (data.audits['long-tasks']) {
  console.log('\n=== 长任务 ===\n');
  const longTasks = data.audits['long-tasks'];
  if (longTasks.details?.items?.length > 0) {
    console.log(`- 长任务数量: ${longTasks.details.items.length}`);
    console.log(`- 总阻塞时间: ${Math.round(longTasks.numericValue)}ms`);
  } else {
    console.log('- ✅ 无长任务（所有任务<50ms）');
  }
}
