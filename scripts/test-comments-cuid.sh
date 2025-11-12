#!/bin/bash

# 评论系统 CUID 回归测试脚本
# 验证评论 API 能正确处理 CUID 格式的 ID

echo "=========================================="
echo "评论系统 CUID 回归测试"
echo "=========================================="

# 测试环境
API_URL="http://localhost:3999/api"

# 测试用 CUID（模拟真实的 Prisma 生成的 ID）
POST_ID="clh3x2d1m0000jxub9yz5a1b2"
ACTIVITY_ID="clh3x2d1m0001jxub7yz5a1b3"
COMMENT_ID="clh3x2d1m0002jxub8yz5a1b4"

echo ""
echo "1. 测试查询文章评论（使用 CUID）..."
echo "   URL: GET $API_URL/comments?targetType=post&targetId=$POST_ID"

# 查询文章评论
curl -s -X GET "$API_URL/comments?targetType=post&targetId=$POST_ID" \
  -H "Content-Type: application/json" | jq '.' 2>/dev/null || echo "请求失败或服务器未启动"

echo ""
echo "2. 测试查询动态评论（使用 CUID）..."
echo "   URL: GET $API_URL/comments?targetType=activity&targetId=$ACTIVITY_ID"

# 查询动态评论
curl -s -X GET "$API_URL/comments?targetType=activity&targetId=$ACTIVITY_ID" \
  -H "Content-Type: application/json" | jq '.' 2>/dev/null || echo "请求失败或服务器未启动"

echo ""
echo "3. 测试带有父评论ID的查询（使用 CUID）..."
echo "   URL: GET $API_URL/comments?targetType=post&targetId=$POST_ID&parentId=$COMMENT_ID"

# 查询子评论
curl -s -X GET "$API_URL/comments?targetType=post&targetId=$POST_ID&parentId=$COMMENT_ID" \
  -H "Content-Type: application/json" | jq '.' 2>/dev/null || echo "请求失败或服务器未启动"

echo ""
echo "4. 测试无效的 ID 格式..."
echo "   URL: GET $API_URL/comments?targetType=post&targetId=invalid-id-format"

# 使用无效 ID 格式
curl -s -X GET "$API_URL/comments?targetType=post&targetId=invalid-id-format" \
  -H "Content-Type: application/json" | jq '.' 2>/dev/null || echo "请求失败或服务器未启动"

echo ""
echo "=========================================="
echo "回归测试完成"
echo ""
echo "预期结果："
echo "- 测试 1-3 应该返回 200 或 404（取决于数据是否存在）"
echo "- 测试 4 应该返回 400（参数验证失败）"
echo ""
echo "如果看到 'success: false' 和错误信息 '无效的ID格式'，"
echo "说明 CUID 验证正在正常工作。"
echo "=========================================="