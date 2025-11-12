#!/usr/bin/env tsx
/**
 * Phase 11 / M1 / T1.3: 验证全文搜索功能
 *
 * 此脚本用于测试 PostgreSQL 全文搜索功能是否正常工作
 * 包括：
 * 1. 插入测试数据（中英文内容）
 * 2. 执行全文搜索查询
 * 3. 验证搜索结果和相关性排序
 * 4. 清理测试数据
 *
 * 注意：
 * - 数据写入前会由 nodejieba 生成 token，数据库中使用 to_tsvector('simple', tokens)
 * - Supabase 托管环境不支持 zhparser，此脚本默认验证应用层分词方案
 * - 如迁移到自托 Postgres，可在此基础上再评估 zhparser/Meilisearch
 */

import { PrismaClient } from "@/lib/generated/prisma"

const prisma = new PrismaClient()

const log = (message = "") => {
  process.stdout.write(`${message}\n`)
}

const logError = (message = "") => {
  process.stderr.write(`${message}\n`)
}

// 测试数据
const testPosts = [
  {
    title: "Next.js 15 新特性详解",
    content:
      "Next.js 15 带来了许多令人兴奋的新特性，包括改进的 App Router、更快的构建速度和更好的开发体验。本文将详细介绍这些新特性。",
    excerpt: "探索 Next.js 15 的最新功能和改进",
    seoDescription: "深入了解 Next.js 15 的新特性、性能优化和最佳实践",
    slug: "nextjs-15-features",
  },
  {
    title: "React Server Components 实战指南",
    content:
      "React Server Components (RSC) 是 React 的一个革命性特性，它允许我们在服务器端渲染组件，从而提高性能和用户体验。本文将通过实际案例展示如何使用 RSC。",
    excerpt: "学习如何在实际项目中使用 React Server Components",
    seoDescription: "React Server Components 完整教程，包含实战案例和最佳实践",
    slug: "react-server-components-guide",
  },
  {
    title: "TypeScript 高级类型技巧",
    content:
      "TypeScript 的类型系统非常强大，掌握高级类型技巧可以让你的代码更加类型安全和易于维护。本文介绍条件类型、映射类型、模板字面量类型等高级特性。",
    excerpt: "掌握 TypeScript 的高级类型系统",
    seoDescription: "TypeScript 高级类型完全指南，提升代码质量和开发效率",
    slug: "typescript-advanced-types",
  },
  {
    title: "Building Modern Web Applications",
    content:
      "Modern web applications require a solid understanding of frontend frameworks, backend APIs, and database design. This article covers the essential technologies and best practices for building scalable web apps.",
    excerpt: "Learn how to build modern, scalable web applications",
    seoDescription:
      "Complete guide to building modern web applications with React, Next.js, and TypeScript",
    slug: "building-modern-web-apps",
  },
]

async function main() {
  log("🔍 开始测试全文搜索功能...\n")

  // 创建测试用户
  log("1️⃣ 创建测试用户...")
  const testUser = await prisma.user.upsert({
    where: { email: "search-test@example.com" },
    update: {},
    create: {
      email: "search-test@example.com",
      name: "搜索测试用户",
      role: "ADMIN",
    },
  })
  log(`✅ 测试用户已创建: ${testUser.name} (${testUser.id})\n`)

  // 插入测试文章
  log("2️⃣ 插入测试文章...")
  const createdPosts = []
  for (const postData of testPosts) {
    const post = await prisma.post.create({
      data: {
        ...postData,
        authorId: testUser.id,
        published: true,
        publishedAt: new Date(),
      },
    })
    createdPosts.push(post)
    log(`   ✅ 已创建: ${post.title}`)
  }
  log(`✅ 共创建 ${createdPosts.length} 篇测试文章\n`)

  // 测试全文搜索
  log("3️⃣ 测试全文搜索功能...\n")

  // 测试 1: 搜索中文关键词 "Next.js"
  log("   测试 1: 搜索 'Next.js'")
  const result1 = await prisma.$queryRaw<Array<{ id: string; title: string; rank: number }>>`
    SELECT 
      id, 
      title,
      ts_rank(search_vector, to_tsquery('simple', 'Next.js')) as rank
    FROM posts
    WHERE search_vector @@ to_tsquery('simple', 'Next.js')
    ORDER BY rank DESC
  `
  log(`   ✅ 找到 ${result1.length} 篇文章:`)
  result1.forEach((post, index) => {
    log(`      ${index + 1}. ${post.title} (相关性: ${post.rank})`)
  })
  log()

  // 测试 2: 搜索中文关键词 "React"
  log("   测试 2: 搜索 'React'")
  const result2 = await prisma.$queryRaw<Array<{ id: string; title: string; rank: number }>>`
    SELECT 
      id, 
      title,
      ts_rank(search_vector, to_tsquery('simple', 'React')) as rank
    FROM posts
    WHERE search_vector @@ to_tsquery('simple', 'React')
    ORDER BY rank DESC
  `
  log(`   ✅ 找到 ${result2.length} 篇文章:`)
  result2.forEach((post, index) => {
    log(`      ${index + 1}. ${post.title} (相关性: ${post.rank})`)
  })
  log()

  // 测试 3: 搜索英文关键词 "modern"
  log("   测试 3: 搜索 'modern'")
  const result3 = await prisma.$queryRaw<Array<{ id: string; title: string; rank: number }>>`
    SELECT 
      id, 
      title,
      ts_rank(search_vector, to_tsquery('simple', 'modern')) as rank
    FROM posts
    WHERE search_vector @@ to_tsquery('simple', 'modern')
    ORDER BY rank DESC
  `
  log(`   ✅ 找到 ${result3.length} 篇文章:`)
  result3.forEach((post, index) => {
    log(`      ${index + 1}. ${post.title} (相关性: ${post.rank})`)
  })
  log()

  // 测试 4: 搜索完整词组（中文需要完整匹配）
  log("   测试 4: 搜索 'TypeScript 高级类型技巧'（完整标题）")
  const result4 = await prisma.$queryRaw<Array<{ id: string; title: string; rank: number }>>`
    SELECT
      id,
      title,
      ts_rank(search_vector, to_tsquery('simple', 'TypeScript & 高级类型技巧')) as rank
    FROM posts
    WHERE search_vector @@ to_tsquery('simple', 'TypeScript & 高级类型技巧')
    ORDER BY rank DESC
  `
  log(`   ✅ 找到 ${result4.length} 篇文章:`)
  result4.forEach((post, index) => {
    log(`      ${index + 1}. ${post.title} (相关性: ${post.rank})`)
  })
  log()

  // 测试 5: 测试权重（标题中的关键词应该排名更高）
  log("   测试 5: 验证权重排序（标题权重 > 内容权重）")
  const result5 = await prisma.$queryRaw<Array<{ id: string; title: string; rank: number }>>`
    SELECT 
      id, 
      title,
      ts_rank(search_vector, to_tsquery('simple', 'TypeScript')) as rank
    FROM posts
    WHERE search_vector @@ to_tsquery('simple', 'TypeScript')
    ORDER BY rank DESC
  `
  log(`   ✅ 找到 ${result5.length} 篇文章:`)
  result5.forEach((post, index) => {
    log(`      ${index + 1}. ${post.title} (相关性: ${post.rank})`)
  })
  log()

  // 验证结果
  log("4️⃣ 验证测试结果...\n")
  let allTestsPassed = true

  if (result1.length === 0) {
    log("   ❌ 测试 1 失败: 应该找到包含 'Next.js' 的文章")
    allTestsPassed = false
  } else {
    log("   ✅ 测试 1 通过: 成功搜索到 'Next.js' 相关文章")
  }

  if (result2.length === 0) {
    log("   ❌ 测试 2 失败: 应该找到包含 'React' 的文章")
    allTestsPassed = false
  } else {
    log("   ✅ 测试 2 通过: 成功搜索到 'React' 相关文章")
  }

  if (result3.length === 0) {
    log("   ❌ 测试 3 失败: 应该找到包含 'modern' 的文章")
    allTestsPassed = false
  } else {
    log("   ✅ 测试 3 通过: 成功搜索到 'modern' 相关文章")
  }

  if (result4.length === 0) {
    log("   ❌ 测试 4 失败: 应该找到包含完整标题的文章")
    allTestsPassed = false
  } else {
    log("   ✅ 测试 4 通过: 成功搜索到完整标题匹配的文章")
  }

  if (result5.length > 0 && result5[0].title.includes("TypeScript")) {
    log("   ✅ 测试 5 通过: 标题中的关键词排名更高")
  } else {
    log("   ⚠️  测试 5 警告: 权重排序可能需要调整")
  }

  log()

  // 清理测试数据
  log("5️⃣ 清理测试数据...")
  await prisma.post.deleteMany({
    where: {
      authorId: testUser.id,
    },
  })
  await prisma.user.delete({
    where: {
      id: testUser.id,
    },
  })
  log("✅ 测试数据已清理\n")

  // 最终结果
  if (allTestsPassed) {
    log("🎉 所有测试通过！全文搜索功能正常工作。\n")
  } else {
    log("⚠️  部分测试失败，请检查搜索配置。\n")
    process.exit(1)
  }
}

main()
  .catch((error) => {
    logError("❌ 测试过程中发生错误:")
    logError(error instanceof Error ? (error.stack ?? error.message) : String(error))
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
