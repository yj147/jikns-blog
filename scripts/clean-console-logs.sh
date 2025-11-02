#!/bin/bash

# 清理调试用的 console.log 语句的脚本
# 保留 console.error 和 console.warn（错误处理）
# 删除 console.log（调试语句）

echo "开始清理 console.log 语句..."

# 查找所有包含 console.log 的文件并处理
find ./app ./components ./lib -name "*.ts" -o -name "*.tsx" | while read file; do
    if grep -q "console\.log" "$file"; then
        echo "清理文件: $file"
        # 删除整行包含 console.log 的行
        sed -i '/console\.log/d' "$file"
        
        # 清理可能留下的空行（连续超过2个空行压缩为1个）
        sed -i '/^[[:space:]]*$/N;/\n[[:space:]]*$/d' "$file"
    fi
done

echo "console.log 清理完成！"

# 显示剩余的 console 语句统计
echo "剩余的 console 语句统计："
echo "console.error: $(find ./app ./components ./lib -name "*.ts" -o -name "*.tsx" | xargs grep -c "console\.error" 2>/dev/null | wc -l)"
echo "console.warn: $(find ./app ./components ./lib -name "*.ts" -o -name "*.tsx" | xargs grep -c "console\.warn" 2>/dev/null | wc -l)"
echo "console.log: $(find ./app ./components ./lib -name "*.ts" -o -name "*.tsx" | xargs grep -c "console\.log" 2>/dev/null | wc -l)"