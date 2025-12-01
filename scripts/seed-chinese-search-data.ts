import { prisma } from "../lib/prisma"

async function main() {
  const admin = await prisma.user.findFirst({ where: { email: "admin@example.com" } })
  if (!admin) throw new Error("Admin user not found")

  // 创建中文标签
  const chineseTags = [
    { name: "前端开发", description: "前端技术相关的文章和讨论" },
    { name: "后端架构", description: "后端系统架构设计与实践" },
    { name: "数据库优化", description: "数据库性能优化技巧" },
    { name: "人工智能", description: "AI 和机器学习相关内容" },
    { name: "云计算", description: "云服务和分布式系统" },
  ]

  const tagPromises = chineseTags.map((tag, i) =>
    prisma.tag.create({
      data: {
        name: tag.name,
        slug: `chinese-tag-${i + 1}-${Date.now()}`,
        description: tag.description,
        color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
        postsCount: 0,
      }
    })
  )
  const tags = await Promise.all(tagPromises)
  console.log(`✅ 创建了 ${tags.length} 个中文标签`)

  // 创建中文文章
  const chinesePosts = [
    {
      title: "深入理解 React Hooks 原理",
      content: "React Hooks 是 React 16.8 引入的新特性，它允许我们在函数组件中使用状态和其他 React 特性。本文将深入探讨 Hooks 的实现原理和最佳实践。",
      excerpt: "探索 React Hooks 的核心原理和使用技巧"
    },
    {
      title: "Node.js 性能优化实战指南",
      content: "本文介绍 Node.js 应用性能优化的各种技巧，包括事件循环优化、内存管理、数据库查询优化等实战经验。",
      excerpt: "提升 Node.js 应用性能的最佳实践"
    },
    {
      title: "PostgreSQL 全文搜索深度解析",
      content: "PostgreSQL 提供了强大的全文搜索功能，支持中文分词、相关度排序等高级特性。本文详细介绍 FTS 的配置和优化技巧。",
      excerpt: "掌握 PostgreSQL 全文搜索的核心技术"
    },
    {
      title: "微服务架构设计模式",
      content: "微服务架构已成为大型应用的主流设计模式。本文讨论服务拆分、通信机制、数据一致性等关键问题。",
      excerpt: "微服务架构的设计原则和实践经验"
    },
    {
      title: "TypeScript 高级类型系统",
      content: "TypeScript 的类型系统非常强大，支持泛型、联合类型、条件类型等高级特性。本文深入讲解类型系统的使用技巧。",
      excerpt: "掌握 TypeScript 类型系统的核心概念"
    },
  ]

  const postPromises = chinesePosts.map((post, i) =>
    prisma.post.create({
      data: {
        title: post.title,
        content: post.content,
        excerpt: post.excerpt,
        slug: `chinese-post-${i + 1}-${Date.now()}`,
        published: true,
        publishedAt: new Date(Date.now() - i * 86400000),
        authorId: admin.id,
      }
    })
  )
  const posts = await Promise.all(postPromises)
  console.log(`✅ 创建了 ${posts.length} 篇中文文章`)

  // 创建中文动态
  const chineseActivities = [
    "今天学习了 React 的新特性，感觉很有用！",
    "分享一个 Node.js 性能优化的小技巧：使用连接池可以大幅提升数据库查询效率。",
    "正在研究 PostgreSQL 的全文搜索功能，中文分词效果不错。",
    "微服务架构虽然复杂，但带来的灵活性和可扩展性是值得的。",
    "TypeScript 的类型推断真的很强大，能帮我们避免很多运行时错误。",
  ]

  const activityPromises = chineseActivities.map((content) =>
    prisma.activity.create({
      data: {
        content,
        authorId: admin.id,
        imageUrls: [],
      }
    })
  )
  const activities = await Promise.all(activityPromises)
  console.log(`✅ 创建了 ${activities.length} 条中文动态`)

  console.log(`\n📊 中文搜索测试数据创建完成`)
  console.log(`测试关键词：React, Node, PostgreSQL, 微服务, TypeScript, 前端, 后端, 数据库, 人工智能, 云计算`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
