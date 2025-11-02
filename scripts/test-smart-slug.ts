#!/usr/bin/env tsx

import { createSmartSlug } from "@/lib/utils/slug-english"

// 测试各种中文标题的智能翻译
const testTitles = [
  "现代前端开发最佳实践",
  "JavaScript 性能优化指南",
  "深入理解 React Hooks",
  "构建高性能的 Web 应用",
  "最佳代码实践分享",
  "如何成为全栈工程师",
  "数据库设计原则与实践",
  "微服务架构详解",
]

console.log("测试智能 Slug 生成功能（中文自动翻译成英文）:\n")
console.log("=".repeat(70))

function runTests() {
  for (const title of testTitles) {
    try {
      const slug = createSmartSlug(title)
      console.log(`\n原始标题: ${title}`)
      console.log(`生成 Slug: ${slug}`)
      console.log("-".repeat(70))
    } catch (error) {
      console.error(`处理 "${title}" 时出错:`, error)
    }
  }

  // 测试英文标题（应该保持不变）
  console.log("\n测试英文标题:")
  console.log("=".repeat(70))

  const englishTitles = [
    "Building Modern Web Applications",
    "React Best Practices 2024",
    "TypeScript Advanced Guide",
  ]

  for (const title of englishTitles) {
    try {
      const slug = createSmartSlug(title)
      console.log(`\n原始标题: ${title}`)
      console.log(`生成 Slug: ${slug}`)
      console.log("-".repeat(70))
    } catch (error) {
      console.error(`处理 "${title}" 时出错:`, error)
    }
  }

  // 测试中英文混合标题
  console.log("\n测试中英文混合标题:")
  console.log("=".repeat(70))

  const mixedTitles = [
    "React 18 新特性详解",
    "使用 TypeScript 构建企业级应用",
    "Next.js 14 完全指南",
  ]

  for (const title of mixedTitles) {
    try {
      const slug = createSmartSlug(title)
      console.log(`\n原始标题: ${title}`)
      console.log(`生成 Slug: ${slug}`)
      console.log("-".repeat(70))
    } catch (error) {
      console.error(`处理 "${title}" 时出错:`, error)
    }
  }
}

// 运行测试
runTests()
console.log("\n✅ 测试完成！")
