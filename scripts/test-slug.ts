#!/usr/bin/env tsx

import { createSlug } from "@/lib/utils/slug"

// 测试各种中文标题的 slug 生成
const testTitles = [
  "现代前端开发最佳实践",
  "JavaScript 性能优化指南",
  "深入理解 React Hooks",
  "构建高性能的 Web 应用",
  "最佳代码实践分享",
]

console.log("测试 Slug 生成功能:\n")
console.log("=".repeat(60))

testTitles.forEach((title) => {
  const slug = createSlug(title)
  console.log(`标题: ${title}`)
  console.log(`Slug: ${slug}`)
  console.log("-".repeat(60))
})

// 特别测试"佳"字
console.log('\n特别测试"佳"字的转换:')
const testPhrase = "最佳实践"
const slugResult = createSlug(testPhrase)
console.log(`输入: ${testPhrase}`)
console.log(`输出: ${slugResult}`)
console.log(`预期: zui-jia-shi-jian`)
console.log(`结果: ${slugResult === "zui-jia-shi-jian" ? "✅ 通过" : "❌ 失败"}`)
