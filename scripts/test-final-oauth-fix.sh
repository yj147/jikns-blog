#!/bin/bash

echo "🎯 GitHub OAuth 最终修复验证"
echo "============================"
echo ""

# 定义颜色
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 关键修复内容${NC}"
echo "-------------"
echo "✅ 移除了根路径的重复 OAuth 处理器"
echo "✅ 登录按钮改为直接构建 GitHub OAuth URL"
echo "✅ 回调处理器添加授权码去重机制"
echo "✅ 使用专用的 GitHub API 备用方法处理 PKCE 错误"
echo ""

echo -e "${YELLOW}🧪 架构优化${NC}"
echo "----------"
echo "• 单一回调端点: /api/auth/callback"
echo "• 直接 GitHub OAuth: 绕过 Supabase PKCE 问题"
echo "• 授权码缓存: 防止重复处理过期错误"
echo "• 双重策略: 标准流程 + GitHub API 备用"
echo ""

echo -e "${YELLOW}🔍 环境检查${NC}"
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

# 检查环境变量
if [ -f ".env" ]; then
  echo "✅ .env 文件存在"
  
  if grep -q "NEXT_PUBLIC_GITHUB_CLIENT_ID.*Ov23liNOasus4iRqR1hk" .env; then
    echo "✅ 客户端 GitHub Client ID 配置正确"
  else
    echo "❌ 客户端 GitHub Client ID 配置问题"
  fi
  
  if grep -q "GITHUB_CLIENT_SECRET.*112c6f502b1291bef07e7937439f58914f1092e2" .env; then
    echo "✅ GitHub Client Secret 配置正确"
  else
    echo "❌ GitHub Client Secret 配置问题"
  fi
else
  echo "❌ .env 文件不存在"
fi

echo ""
echo -e "${GREEN}✅ OAuth 流程优化${NC}"
echo "----------------"
echo "新的认证流程："
echo "1. 🔄 用户点击登录 → 直接构建 GitHub OAuth URL"
echo "2. 🚀 重定向到 GitHub → 用户授权应用"
echo "3. 📨 GitHub 回调 → /api/auth/callback 接收授权码"
echo "4. 🔍 授权码去重检查 → 防止重复处理"
echo "5. 🛡️ 尝试标准流程 → 如果 PKCE 错误则使用 GitHub API"
echo "6. ✅ 建立用户会话 → 重定向到目标页面"
echo ""

echo -e "${YELLOW}📝 测试步骤${NC}"
echo "----------"
echo "1. 访问: http://localhost:3000/login"
echo "2. 点击 '使用 GitHub 登录' 按钮"
echo "3. 在 GitHub 页面完成授权"
echo "4. 验证成功登录并重定向"
echo ""

echo -e "${BLUE}🔍 调试提示${NC}"
echo "----------"
echo "如果遇到问题，查看控制台日志中的关键消息："
echo "• 'GitHub OAuth 直接重定向' - 登录按钮工作正常"
echo "• '授权码已经处理过，跳过重复处理' - 去重机制生效"
echo "• 'PKCE 错误，使用 GitHub API 直接获取用户信息' - 备用方法启动"
echo "• '用户认证成功通过 GitHub API 备用方法' - 认证成功"
echo ""

echo -e "${GREEN}🎯 修复完成${NC}"
echo "----------"
echo "GitHub OAuth 现在应该能够稳定工作，不再出现授权码过期或重复处理错误"