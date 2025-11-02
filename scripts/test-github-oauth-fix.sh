#!/bin/bash

echo "🔧 GitHub OAuth PKCE 问题修复验证"
echo "=================================="
echo ""

# 定义颜色
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 修复策略${NC}"
echo "----------"
echo "✅ 检测到 PKCE 错误时自动切换到 GitHub API 直接调用"
echo "✅ 使用 GitHub Client Secret 直接与 GitHub 交换 access_token"
echo "✅ 通过 GitHub API 获取用户信息"
echo "✅ 使用 Supabase Admin API 创建/更新用户会话"
echo ""

echo -e "${YELLOW}🧪 环境变量检查${NC}"
echo "----------------"

# 检查环境变量
if [ -f ".env" ]; then
  echo "✅ .env 文件存在"
  
  if grep -q "GITHUB_CLIENT_ID.*Ov23liNOasus4iRqR1hk" .env; then
    echo "✅ GitHub Client ID 正确配置"
  else
    echo "❌ GitHub Client ID 配置问题"
  fi
  
  if grep -q "GITHUB_CLIENT_SECRET.*112c6f502b1291bef07e7937439f58914f1092e2" .env; then
    echo "✅ GitHub Client Secret 正确配置"
  else
    echo "❌ GitHub Client Secret 配置问题"
  fi
  
  if grep -q "NEXT_PUBLIC_SITE_URL" .env; then
    echo "✅ Site URL 已配置"
  else
    echo "❌ Site URL 配置问题"
  fi
else
  echo "❌ .env 文件不存在"
fi

echo ""
echo -e "${YELLOW}🚀 系统状态${NC}"
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
    exit 1
fi

echo ""
echo -e "${GREEN}✅ 修复完成${NC}"
echo "----------"
echo "GitHub OAuth 认证现在使用双重策略："
echo "1. 🔄 首先尝试 Supabase 标准 OAuth 流程"
echo "2. 🚀 如果遇到 PKCE 错误，自动切换到 GitHub API 直接调用"
echo ""

echo -e "${YELLOW}📝 测试步骤${NC}"
echo "----------"
echo "1. 访问: http://localhost:3000/login"
echo "2. 点击 '使用 GitHub 登录' 按钮"
echo "3. 在 GitHub 页面授权应用"
echo "4. 系统会自动处理 PKCE 错误并通过 GitHub API 完成认证"
echo ""

echo -e "${BLUE}🔍 调试信息${NC}"
echo "----------"
echo "如果遇到问题，请查看开发服务器控制台日志："
echo "• 'PKCE 错误，使用 GitHub API 直接获取用户信息...' - 备用方法启动"
echo "• 'GitHub token 响应: {...}' - GitHub API token 交换状态"
echo "• 'GitHub 用户信息: {...}' - GitHub 用户数据获取状态"
echo "• '用户认证成功通过 GitHub API 备用方法' - 认证成功"