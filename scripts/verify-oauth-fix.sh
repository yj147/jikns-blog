#!/bin/bash

echo "🔧 GitHub OAuth 修复验证脚本"
echo "============================"

echo ""
echo "1️⃣  检查 Supabase 服务状态"
echo "----------------------------"
if curl -s http://localhost:54321/auth/v1/settings > /dev/null; then
    echo "✅ Supabase Auth 服务运行正常"
else
    echo "❌ Supabase Auth 服务不可访问"
    exit 1
fi

echo ""
echo "2️⃣  检查环境变量加载"
echo "--------------------"
ENV_CHECK=$(curl -s http://localhost:3000/api/auth-debug | grep -o '"GITHUB_CLIENT_ID":"✅ 已配置"')
if [ ! -z "$ENV_CHECK" ]; then
    echo "✅ 环境变量正确加载"
else
    echo "❌ 环境变量未正确加载"
    exit 1
fi

echo ""
echo "3️⃣  检查 GitHub OAuth 配置"
echo "-------------------------"
CLIENT_ID=$(curl -s http://localhost:3000/api/auth-debug | grep -o '"configuredClientId":"✅ Ov23liNOasus4iRqR1hk"')
if [ ! -z "$CLIENT_ID" ]; then
    echo "✅ GitHub Client ID 不是占位符 (Ov23liNOasus4iRqR1hk)"
else
    echo "❌ GitHub Client ID 仍然是占位符"
    exit 1
fi

echo ""
echo "4️⃣  检查 OAuth 授权 URL"
echo "----------------------"
AUTH_URL=$(curl -s "http://localhost:54321/auth/v1/authorize?provider=github&redirect_to=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fauth%2Fcallback" -w "%{redirect_url}" -o /dev/null)

if [[ "$AUTH_URL" == *"client_id=Ov23liNOasus4iRqR1hk"* ]]; then
    echo "✅ OAuth URL 包含正确的 client_id"
else
    echo "❌ OAuth URL 仍包含占位符 client_id"
    exit 1
fi

if [[ "$AUTH_URL" == *"redirect_uri=http%3A%2F%2Flocalhost%3A54321%2Fauth%2Fv1%2Fcallback"* ]]; then
    echo "✅ OAuth URL 包含正确的 redirect_uri"
else
    echo "❌ OAuth URL 的 redirect_uri 不正确"
    exit 1
fi

echo ""
echo "5️⃣  检查应用程序回调端点"
echo "----------------------"
if curl -s http://localhost:3000/api/auth/callback -w "%{http_code}" -o /dev/null | grep -q "307"; then
    echo "✅ 回调端点响应正常 (重定向到错误页面，因为缺少授权码)"
else
    echo "❌ 回调端点无响应"
    exit 1
fi

echo ""
echo "🎉 验收标准检查"
echo "==============="
echo "✅ authorize URL 中的 client_id 不再为 'your-github-client-id-placeholder'"
echo "✅ OAuth 回调配置正确对齐"
echo "✅ 环境变量正确加载，无占位符"

echo ""
echo "🚀 测试结果：所有关键问题已修复！"
echo ""
echo "📋 下一步测试流程："
echo "1. 访问：http://localhost:3000/login"
echo "2. 点击 'GitHub 登录' 按钮"
echo "3. 完成 GitHub OAuth 授权"
echo "4. 验证成功重定向并建立会话"
echo ""
echo "🔗 完整的 GitHub OAuth URL："
echo "$AUTH_URL"