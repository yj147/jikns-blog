#!/bin/bash

# API 错误处理迁移脚本
# 任务A执行工具

echo "🔄 API 错误处理迁移工具"
echo "=========================="

# 1. 扫描需要迁移的文件
echo "📋 扫描需要迁移的API文件..."
echo ""
echo "用户API路由："
ls -la app/api/user/**/*.ts 2>/dev/null || echo "  无文件"
echo ""
echo "管理员API路由："
ls -la app/api/admin/**/*.ts 2>/dev/null || echo "  无文件"

# 2. 检查当前错误处理模式
echo ""
echo "🔍 当前错误处理模式分析："
echo ""
echo "使用旧 ErrorHandler 的文件："
grep -l "ErrorHandler" app/api/**/*.ts 2>/dev/null || echo "  无"
echo ""
echo "使用裸 Error 的文件："
grep -l "throw new Error" app/api/**/*.ts 2>/dev/null || echo "  无"
echo ""
echo "使用 NextResponse.json({error}) 的文件："
grep -l "NextResponse\.json.*error" app/api/**/*.ts 2>/dev/null || echo "  无"

# 3. 生成迁移计划
echo ""
echo "📝 迁移计划："
echo "  批次1：认证相关 (login, logout, verify)"
echo "  批次2：用户资料 (profile, settings)"
echo "  批次3：管理员功能 (users, posts)"

# 4. 生成迁移模板
cat << 'EOF' > /tmp/migration-template.ts
// 迁移前：
// throw new Error("未授权访问")
// return NextResponse.json({ error: "未授权访问" }, { status: 401 })

// 迁移后：
import { AuthError } from "@/lib/error-handling/auth-error"
import { classifyAndFormatError } from "@/lib/error-handling/classify-auth-error"

// 在 catch 块中：
const { code, message } = classifyAndFormatError(error)
return NextResponse.json(
  { error: { code, message } },
  { status: getStatusCodeForError(code) }
)
EOF

echo ""
echo "✅ 迁移模板已生成到 /tmp/migration-template.ts"
echo ""
echo "下一步操作："
echo "  1. 审查需要迁移的文件列表"
echo "  2. 按批次执行迁移"
echo "  3. 为每个批次编写测试"