#!/bin/bash

# Vitest 警告批量清理脚本
# 清理测试文件中的 console.log 输出

echo "🧹 开始清理测试文件中的 console 输出"
echo "======================================="

# 统计当前console调用
TOTAL_CONSOLE=$(grep -r "console\." tests/ --include="*.test.ts" --include="*.test.tsx" | wc -l)
echo "📊 当前统计："
echo "  - 总计 console 调用: $TOTAL_CONSOLE"

# 分类统计
CONSOLE_LOG=$(grep -r "console\.log" tests/ --include="*.test.ts" --include="*.test.tsx" | wc -l)
CONSOLE_ERROR=$(grep -r "console\.error" tests/ --include="*.test.ts" --include="*.test.tsx" | wc -l)
CONSOLE_WARN=$(grep -r "console\.warn" tests/ --include="*.test.ts" --include="*.test.tsx" | wc -l)

echo "  - console.log: $CONSOLE_LOG"
echo "  - console.error: $CONSOLE_ERROR"
echo "  - console.warn: $CONSOLE_WARN"

echo ""
echo "🔨 执行清理策略："
echo "  1. 注释掉 console.log（保留调试信息）"
echo "  2. 保留 console.error（错误信息重要）"
echo "  3. 评估 console.warn（根据具体情况）"

# 创建备份
echo ""
echo "📦 创建备份..."
cp -r tests/ tests.backup.$(date +%Y%m%d_%H%M%S)/

# 批量处理console.log
echo ""
echo "🔧 开始处理 console.log..."

# 查找所有包含console.log的测试文件
FILES_WITH_CONSOLE=$(grep -r "console\.log" tests/ --include="*.test.ts" --include="*.test.tsx" -l)

for file in $FILES_WITH_CONSOLE; do
    echo "  处理: $file"
    # 将 console.log 替换为 // console.log（注释掉但保留）
    sed -i 's/^\([[:space:]]*\)console\.log/\1\/\/ console.log/' "$file"
done

echo ""
echo "✅ 清理完成！"

# 重新统计
NEW_CONSOLE_LOG=$(grep -r "^[^/]*console\.log" tests/ --include="*.test.ts" --include="*.test.tsx" | wc -l)
echo ""
echo "📈 清理结果："
echo "  - 清理前 console.log: $CONSOLE_LOG"
echo "  - 清理后 console.log: $NEW_CONSOLE_LOG"
echo "  - 已清理: $((CONSOLE_LOG - NEW_CONSOLE_LOG))"

echo ""
echo "💡 后续建议："
echo "  1. 运行测试验证：pnpm test"
echo "  2. 检查是否有必要的日志被误注释"
echo "  3. 考虑使用专门的测试日志工具"