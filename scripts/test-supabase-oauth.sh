#!/bin/bash

echo "🔧 Supabase OAuth 配置测试"
echo "=========================="
echo ""

# 定义颜色
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}✅ 修复策略${NC}"
echo "----------"
echo "• 使用 Supabase 标准 OAuth 流程"
echo "• 回调 URL: http://localhost:54321/auth/v1/callback"
echo "• 与现有 GitHub OAuth App 配置匹配"
echo "• Supabase 自动处理 OAuth 流程和会话建立"
echo ""

echo -e "${YELLOW}🔍 系统检查${NC}"
echo "----------"

# 检查服务状态
if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ Next.js 开发服务器运行正常"
else
    echo "❌ Next.js 开发服务器不可访问"
    exit 1
fi

if curl -s http://localhost:54321/auth/v1/settings > /dev/null; then
    echo "✅ Supabase Auth 服务运行正常"
else
    echo "❌ Supabase Auth 服务不可访问"
    echo "请确保运行: supabase start"
    exit 1
fi

# 检查环境变量
if [ -f ".env" ]; then
  echo "✅ .env 文件存在"
  
  if grep -q "NEXT_PUBLIC_SUPABASE_URL.*localhost:54321" .env; then
    echo "✅ Supabase URL 配置正确"
  else
    echo "❌ Supabase URL 配置问题"
  fi
  
  if grep -q "GITHUB_CLIENT_ID.*Ov23liNOasus4iRqR1hk" .env; then
    echo "✅ GitHub Client ID 配置正确"
  else
    echo "❌ GitHub Client ID 配置问题"
  fi
else
  echo "❌ .env 文件不存在"
fi

echo ""
echo -e "${GREEN}🚀 OAuth 流程说明${NC}"
echo "----------------"
echo "1. 点击登录按钮 → Supabase 构建 GitHub OAuth URL"
echo "2. 重定向到 GitHub → 用户在 GitHub 授权"
echo "3. GitHub 回调 → http://localhost:54321/auth/v1/callback"
echo "4. Supabase 处理 → 建立用户会话并设置 Cookie"
echo "5. 重定向回应用 → 根据 redirect_to 参数返回原页面"
echo ""

echo -e "${BLUE}📝 测试步骤${NC}"
echo "----------"
echo "1. 访问: http://localhost:3000/login"
echo "2. 点击 '使用 GitHub 登录' 按钮"
echo "3. 在 GitHub 页面完成授权"
echo "4. 应该自动重定向回应用并建立登录会话"
echo ""

echo -e "${YELLOW}⚠️  注意事项${NC}"
echo "-----------"
echo "• 现在使用的是 Supabase 标准 OAuth 流程"
echo "• 不再需要我们的自定义回调处理器"
echo "• 会话由 Supabase 自动管理"
echo "• 如果仍有问题，可能需要检查 Supabase 的 GitHub 提供商配置"
echo ""

echo -e "${GREEN}🎯 预期结果${NC}"
echo "----------"
echo "登录应该能正常工作，不再出现 redirect_uri 错误"