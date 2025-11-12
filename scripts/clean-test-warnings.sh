#!/bin/bash

# Vitest 警告清理脚本
# 任务C执行工具

echo "🧹 Vitest 警告清理工具"
echo "========================"

# 1. 查找所有测试文件中的 console.* 调用
echo "📋 扫描 console 输出..."
CONSOLE_COUNT=$(grep -r "console\." tests/ --include="*.test.ts" --include="*.test.tsx" | wc -l)
echo "  发现 $CONSOLE_COUNT 处 console 调用"

# 2. 查找未 await 的异步调用
echo "📋 扫描未等待的 Promise..."
grep -r "it(" tests/ --include="*.test.ts" | grep -v "async" | grep "await" > /tmp/promise-warnings.txt || true
PROMISE_COUNT=$(wc -l < /tmp/promise-warnings.txt)
echo "  发现 $PROMISE_COUNT 处可疑的异步调用"

# 3. 生成清理任务列表
echo ""
echo "📝 清理任务列表："
echo "  优先级1：移除或注释非必要的 console 输出"
echo "  优先级2：为异步测试添加 async 关键字"
echo "  优先级3：确保所有 Promise 都有 await"

# 4. 提供自动修复选项
echo ""
echo "🔧 自动修复选项："
echo "  1. 注释掉所有 console.log (保留 console.error)"
echo "  2. 检查并修复 async/await 配对"
echo "  3. 生成详细的修复报告"

# 5. 运行测试并统计警告
echo ""
echo "📊 当前测试警告统计："
pnpm test --run 2>&1 | grep -c "Warning:" || echo "0"