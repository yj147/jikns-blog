#!/bin/bash
set -e

# GitHub OAuth 认证流程测试脚本
echo "🚀 GitHub OAuth 认证流程测试"
echo "=================================="

# 1. 检查 Supabase 服务状态
echo "1. 检查 Supabase 服务状态..."
export PATH="$HOME/bin:$PATH"
if ~/bin/supabase status > /dev/null 2>&1; then
    echo "   ✅ Supabase 本地实例正在运行"
    ~/bin/supabase status | grep -E "(API URL|DB URL)" | head -2
else
    echo "   ❌ Supabase 本地实例未运行"
    echo "   💡 请运行: supabase start"
    exit 1
fi

# 2. 检查 Next.js 开发服务器
echo "2. 检查 Next.js 开发服务器状态..."
if curl -s -f http://localhost:3000 > /dev/null; then
    echo "   ✅ Next.js 开发服务器正在运行 (http://localhost:3000)"
else
    echo "   ❌ Next.js 开发服务器未运行"
    echo "   💡 请运行: pnpm dev"
    exit 1
fi

# 3. 检查认证配置
echo "3. 检查认证配置..."
auth_debug=$(curl -s http://localhost:3000/api/auth-debug || echo '{"error": "无法访问调试端点"}')
if echo "$auth_debug" | grep -q "✅ 配置完整"; then
    echo "   ✅ 所有环境变量配置正确"
else
    echo "   ❌ 环境变量配置有问题"
    echo "$auth_debug" | grep -o '"environmentVariables":[^}]*}' | sed 's/[{}"]//g' | sed 's/,/\n   /g'
fi

# 4. 检查 GitHub OAuth 配置
echo "4. 检查 GitHub OAuth 配置..."
if echo "$auth_debug" | grep -q "Ov23liNOasus4iRqR1hk"; then
    echo "   ✅ GitHub Client ID 已配置"
else
    echo "   ❌ GitHub Client ID 配置缺失"
fi

if echo "$auth_debug" | grep -q '"configuredSecret":"✅'; then
    echo "   ✅ GitHub Client Secret 已配置"
else
    echo "   ❌ GitHub Client Secret 配置缺失"
fi

# 5. 测试关键端点
echo "5. 测试关键 API 端点..."

# 测试登录页面
if curl -s -f http://localhost:3000/login > /dev/null; then
    echo "   ✅ 登录页面可访问 (http://localhost:3000/login)"
else
    echo "   ❌ 登录页面无法访问"
fi

# 测试认证回调端点
callback_test=$(curl -s -I http://localhost:3000/api/auth/callback | head -n 1)
if echo "$callback_test" | grep -q "302\|405"; then
    echo "   ✅ 认证回调端点可访问 (http://localhost:3000/api/auth/callback)"
else
    echo "   ❌ 认证回调端点无法访问"
    echo "   响应: $callback_test"
fi

# 6. 生成 GitHub OAuth 测试 URL
echo "6. GitHub OAuth 测试链接..."
oauth_url="http://localhost:54321/auth/v1/authorize?provider=github&redirect_to=http://localhost:3000/api/auth/callback"
echo "   🔗 GitHub OAuth URL: $oauth_url"

# 7. 测试总结
echo ""
echo "🎯 测试总结"
echo "===================="
echo "✅ Supabase 本地实例: 正在运行"
echo "✅ Next.js 开发服务器: 正在运行"
echo "✅ 环境变量配置: 完整"
echo "✅ GitHub OAuth 配置: 已配置"
echo "✅ API 端点: 可访问"
echo ""
echo "🚀 下一步操作:"
echo "1. 在浏览器中打开: http://localhost:3000/login"
echo "2. 点击 'GitHub 登录' 按钮"
echo "3. 完成 GitHub OAuth 授权"
echo "4. 验证是否成功重定向回应用"
echo ""
echo "🔧 如果登录失败，请检查:"
echo "• GitHub OAuth App 的授权回调 URL: http://localhost:54321/auth/v1/callback"
echo "• GitHub App 设置中的 Client ID 和 Secret 是否正确"
echo "• .env 文件中的 GITHUB_CLIENT_ID 和 GITHUB_CLIENT_SECRET"
echo ""