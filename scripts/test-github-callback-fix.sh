#!/bin/bash

echo "🔧 GitHub OAuth 回调 URL 修复验证"
echo "==============================="

echo ""
echo "🔍 当前配置分析"
echo "---------------"

# 获取完整的授权 URL
AUTH_URL=$(curl -s "http://localhost:54321/auth/v1/authorize?provider=github&redirect_to=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fauth%2Fcallback" -w "%{redirect_url}" -o /dev/null)

echo "完整授权 URL："
echo "$AUTH_URL"

echo ""
echo "🎯 关键参数提取"
echo "---------------"

# 提取并解码 redirect_uri
REDIRECT_URI=$(echo "$AUTH_URL" | grep -o 'redirect_uri=[^&]*' | cut -d'=' -f2 | python3 -c "import sys, urllib.parse; print(urllib.parse.unquote(sys.stdin.read().strip()))")

echo "Supabase 发送的 redirect_uri: $REDIRECT_URI"

# 提取 client_id
CLIENT_ID=$(echo "$AUTH_URL" | grep -o 'client_id=[^&]*' | cut -d'=' -f2)

echo "GitHub Client ID: $CLIENT_ID"

echo ""
echo "📋 需要的 GitHub OAuth App 配置"
echo "==============================="
echo ""
echo "1. 访问: https://github.com/settings/developers"
echo "2. 找到 Client ID: $CLIENT_ID"
echo "3. 设置 Authorization callback URL 为:"
echo "   → $REDIRECT_URI"
echo ""

echo "⚠️  当前错误原因:"
echo "   GitHub OAuth App 的回调 URL 配置与实际请求的 redirect_uri 不匹配"
echo ""

echo "✅ 修复后的预期流程:"
echo "   1. 用户点击 GitHub 登录"
echo "   2. 重定向到 GitHub 授权页面"
echo "   3. GitHub 验证 redirect_uri 匹配"
echo "   4. 授权后重定向到 Supabase"
echo "   5. Supabase 处理后重定向到应用程序"

echo ""
echo "🧪 测试命令 (修复后运行):"
echo "curl -I \"$AUTH_URL\""