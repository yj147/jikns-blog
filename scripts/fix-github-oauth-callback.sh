#!/bin/bash

echo "🔧 GitHub OAuth 回调 URL 配置修复指南"
echo "====================================="
echo ""

# 定义颜色
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${RED}❌ 问题诊断${NC}"
echo "----------"
echo "GitHub 显示错误: 'The redirect_uri is not associated with this application'"
echo "这表明 GitHub OAuth App 的回调 URL 配置与我们发送的不匹配"
echo ""

echo -e "${BLUE}🔍 当前配置分析${NC}"
echo "---------------"
echo "我们的应用发送的回调 URL: http://localhost:3000/api/auth/callback"
echo "GitHub OAuth App 配置的回调 URL: http://localhost:54321/auth/v1/callback (Supabase 默认)"
echo ""
echo "❌ 两个 URL 不匹配，导致 GitHub 拒绝重定向"
echo ""

echo -e "${YELLOW}🛠️ 修复方案${NC}"
echo "---------"
echo "需要在 GitHub OAuth App 设置中更新 Authorization callback URL"
echo ""
echo "步骤："
echo "1. 访问 https://github.com/settings/applications/"
echo "2. 找到你的 OAuth App (Client ID: Ov23liNOasus4iRqR1hk)"
echo "3. 点击应用名称进入设置页面"
echo "4. 在 'Authorization callback URL' 字段中输入:"
echo -e "   ${GREEN}http://localhost:3000/api/auth/callback${NC}"
echo "5. 点击 'Update application' 保存更改"
echo ""

echo -e "${BLUE}📋 备选方案${NC}"
echo "----------"
echo "如果你希望支持多个回调 URL，可以添加多行："
echo "http://localhost:3000/api/auth/callback"
echo "http://localhost:54321/auth/v1/callback"
echo ""

echo -e "${GREEN}✅ 验证步骤${NC}"
echo "----------"
echo "修复后，重新测试登录流程："
echo "1. 访问: http://localhost:3000/login"
echo "2. 点击 '使用 GitHub 登录'"
echo "3. 应该能正常进入 GitHub 授权页面"
echo "4. 授权后应该重定向回我们的应用"
echo ""

echo -e "${YELLOW}⚠️  重要提醒${NC}"
echo "-----------"
echo "• GitHub OAuth App 配置更改通常会立即生效"
echo "• 如果仍有缓存问题，可以尝试无痕浏览模式"
echo "• 确保回调 URL 完全匹配，包括协议 (http://) 和端口号"
echo ""

echo -e "${BLUE}🔗 快速访问链接${NC}"
echo "---------------"
echo "GitHub OAuth Apps 设置: https://github.com/settings/applications/"
echo "需要配置的回调 URL: http://localhost:3000/api/auth/callback"