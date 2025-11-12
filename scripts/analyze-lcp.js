const fs = require('fs');

// 读取 Lighthouse 报告
const reportPath = process.argv[2] || './lighthouse_run2_20251112_123010.json';
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

console.log('=== LCP 元素分析 ===\n');

// LCP 元素信息
const lcpElement = report.audits['largest-contentful-paint-element'];
if (lcpElement && lcpElement.details && lcpElement.details.items) {
    const item = lcpElement.details.items[0];
    console.log('LCP 元素:');
    console.log('  节点: ' + (item.node?.snippet || 'N/A'));
    console.log('  类型: ' + (item.node?.nodeLabel || 'N/A'));
    console.log('  选择器: ' + (item.node?.selector || 'N/A'));
    console.log('');
}

// LCP 时序
const lcp = report.audits['largest-contentful-paint'];
console.log('LCP 时间:');
console.log('  数值: ' + (lcp.numericValue / 1000).toFixed(3) + 's');
console.log('  显示: ' + lcp.displayValue);
console.log('');

// 观测的 LCP（真实浏览器）
const observedLCP = report.audits.metrics?.details?.items?.[0]?.observedLargestContentfulPaint;
if (observedLCP) {
    console.log('观测的 LCP（真实浏览器）: ' + observedLCP + 'ms');
    console.log('模拟的 LCP（Lighthouse）: ' + lcp.numericValue + 'ms');
    console.log('差异: ' + (lcp.numericValue - observedLCP) + 'ms (' +
        ((lcp.numericValue - observedLCP) / observedLCP * 100).toFixed(1) + '%)');
    console.log('');
}

// LCP 是否懒加载
const lcpLazy = report.audits['lcp-lazy-loaded'];
console.log('LCP 元素是否懒加载: ' + (lcpLazy.score === 1 ? '否 ✓' : '是 ✗'));
if (lcpLazy.score !== 1 && lcpLazy.details) {
    console.log('  问题: ' + lcpLazy.displayValue);
}
console.log('');

// 阻塞渲染的资源
console.log('=== 阻塞渲染的资源 ===\n');
const renderBlocking = report.audits['render-blocking-resources'];
if (renderBlocking.details && renderBlocking.details.items && renderBlocking.details.items.length > 0) {
    renderBlocking.details.items.forEach((item, i) => {
        const filename = item.url.split('/').pop();
        console.log(`${i + 1}. ${filename}`);
        console.log(`   大小: ${(item.totalBytes / 1024).toFixed(2)}KB`);
        console.log(`   节省: ${item.wastedMs}ms`);
    });
    console.log(`\n总节省时间: ${renderBlocking.numericValue}ms`);
} else {
    console.log('✓ 无阻塞渲染的资源');
}
console.log('');

// 预加载 LCP 图片
console.log('=== LCP 预加载建议 ===\n');
const lcpPreload = report.audits['preload-lcp-image'];
if (lcpPreload && lcpPreload.score !== 1 && lcpPreload.details && lcpPreload.details.items) {
    console.log('⚠ LCP 图片未预加载');
    lcpPreload.details.items.forEach((item, i) => {
        console.log(`${i + 1}. ${item.url.split('/').pop()}`);
        console.log(`   节省: ${item.wastedMs}ms`);
    });
    console.log(`\n总节省时间: ${lcpPreload.numericValue}ms`);
} else {
    console.log('✓ LCP 元素已优化或无需预加载');
}
console.log('');

// 主线程工作分解
console.log('=== 主线程工作分解 ===\n');
const mainThreadWork = report.audits['mainthread-work-breakdown'];
if (mainThreadWork.details && mainThreadWork.details.items) {
    const items = mainThreadWork.details.items.slice(0, 5);
    items.forEach((item, i) => {
        console.log(`${i + 1}. ${item.groupLabel}`);
        console.log(`   时间: ${(item.duration / 1000).toFixed(3)}s`);
    });
    console.log(`\n总主线程工作: ${(mainThreadWork.numericValue / 1000).toFixed(3)}s`);
}
console.log('');

// 长任务
console.log('=== 长任务分析 ===\n');
const longTasks = report.audits['long-tasks'];
if (longTasks && longTasks.details && longTasks.details.items) {
    console.log(`长任务数量: ${longTasks.details.items.length}`);
    longTasks.details.items.forEach((task, i) => {
        console.log(`${i + 1}. 时长: ${task.duration}ms | 开始: ${task.startTime.toFixed(0)}ms`);
    });
} else {
    console.log('✓ 无长任务（>50ms）');
}
console.log('');

// 网络请求时序分析
console.log('=== 关键资源加载时序 ===\n');
const networkRequests = report.audits['network-requests'];
if (networkRequests.details && networkRequests.details.items) {
    const criticalResources = networkRequests.details.items
        .filter(req => {
            return req.resourceType === 'Document' ||
                   req.resourceType === 'Script' ||
                   req.resourceType === 'Stylesheet' ||
                   req.resourceType === 'Image';
        })
        .sort((a, b) => a.startTime - b.startTime)
        .slice(0, 15);

    criticalResources.forEach((req, i) => {
        const url = req.url.split('/').pop() || req.url.substring(req.url.length - 30);
        const duration = req.endTime - req.startTime;
        console.log(`${i + 1}. ${url.substring(0, 40)}`);
        console.log(`   类型: ${req.resourceType} | 大小: ${(req.transferSize / 1024).toFixed(2)}KB`);
        console.log(`   时序: ${req.startTime.toFixed(0)}ms - ${req.endTime.toFixed(0)}ms (耗时 ${duration.toFixed(0)}ms)`);
    });
}
