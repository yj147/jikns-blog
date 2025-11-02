/**
 * 数据库种子数据脚本
 * 用于初始化数据库基础数据
 */

import { PrismaClient, Role, UserStatus } from "@prisma/client"
import bcrypt from "bcrypt"

const prisma = new PrismaClient()

async function main() {
  console.log("🌱 开始播种数据库...")

  // 清理现有数据（保证幂等性）
  console.log("🧹 清理现有数据...")
  await prisma.$transaction([
    prisma.follow.deleteMany(),
    prisma.bookmark.deleteMany(),
    prisma.like.deleteMany(),
    prisma.comment.deleteMany(),
    prisma.activity.deleteMany(),
    prisma.postTag.deleteMany(),
    prisma.post.deleteMany(),
    prisma.series.deleteMany(),
    prisma.tag.deleteMany(),
    prisma.user.deleteMany(),
  ])

  // 创建管理员用户
  console.log("👤 创建管理员用户...")
  const adminPassword = await bcrypt.hash("admin123456", 10)
  const adminUser = await prisma.user.create({
    data: {
      email: "admin@example.com",
      name: "系统管理员",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=admin",
      bio: "博客系统管理员，负责内容发布和系统维护。",
      socialLinks: {
        github: "https://github.com",
        website: "https://example.com",
      },
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      passwordHash: adminPassword,
      lastLoginAt: new Date(),
    },
  })
  console.log(`✅ 创建管理员用户: ${adminUser.email}`)

  // 创建普通用户
  console.log("👤 创建普通用户...")
  const userPassword = await bcrypt.hash("user123456", 10)
  const normalUser = await prisma.user.create({
    data: {
      email: "user@example.com",
      name: "示例用户",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=user",
      bio: "热爱技术，喜欢分享。",
      socialLinks: {
        github: "https://github.com/user",
      },
      role: Role.USER,
      status: UserStatus.ACTIVE,
      passwordHash: userPassword,
      lastLoginAt: new Date(),
    },
  })
  console.log(`✅ 创建普通用户: ${normalUser.email}`)

  // 创建标签
  console.log("🏷️ 创建标签...")
  const techTag = await prisma.tag.create({
    data: {
      name: "技术",
      slug: "tech",
      description: "技术相关文章",
      color: "#3B82F6",
      postsCount: 0,
    },
  })
  console.log(`✅ 创建标签: ${techTag.name}`)

  const lifeTag = await prisma.tag.create({
    data: {
      name: "生活",
      slug: "life",
      description: "生活感悟与分享",
      color: "#10B981",
      postsCount: 0,
    },
  })
  console.log(`✅ 创建标签: ${lifeTag.name}`)

  // 创建示例系列（可选）
  console.log("📚 创建示例系列...")
  const series = await prisma.series.create({
    data: {
      title: "Next.js 全栈开发指南",
      slug: "nextjs-fullstack-guide",
      description: "从零开始学习 Next.js 全栈开发，包括前端、后端和部署。",
      coverUrl: "https://picsum.photos/seed/series/800/400",
      sortOrder: 1,
      authorId: adminUser.id,
    },
  })
  console.log(`✅ 创建系列: ${series.title}`)

  // 创建示例博客文章
  console.log("📝 创建示例博客文章...")
  const post = await prisma.post.create({
    data: {
      slug: "welcome-to-blog",
      title: "欢迎来到我的博客",
      content: `# 欢迎来到我的博客

这是一篇示例文章，用于展示博客系统的功能。

## 功能特性

- **Markdown 支持**: 文章内容支持 Markdown 格式
- **代码高亮**: 支持多种编程语言的代码高亮
- **评论系统**: 读者可以发表评论和互动
- **标签分类**: 文章可以打上多个标签

## 代码示例

\`\`\`javascript
function sayHello(name) {
  console.log(\`Hello, \${name}!\`);
}

sayHello('World');
\`\`\`

## 结语

感谢您的访问，希望您能在这里找到有价值的内容！`,
      excerpt: "这是博客系统的第一篇文章，介绍了系统的主要功能特性。",
      published: true,
      isPinned: true,
      canonicalUrl: "http://localhost:3000/blog/welcome-to-blog",
      seoTitle: "欢迎来到我的博客 | 技术分享与生活感悟",
      seoDescription:
        "探索技术世界，分享生活感悟。这里有前端开发、后端架构、数据库设计等技术文章。",
      viewCount: 42,
      publishedAt: new Date(),
      authorId: adminUser.id,
      seriesId: series.id,
    },
  })
  console.log(`✅ 创建博客文章: ${post.title}`)

  // 关联文章标签
  console.log("🔗 关联文章标签...")
  await prisma.postTag.create({
    data: {
      postId: post.id,
      tagId: techTag.id,
    },
  })

  // 更新标签计数
  await prisma.tag.update({
    where: { id: techTag.id },
    data: { postsCount: 1 },
  })
  console.log("✅ 文章标签关联完成")

  // 创建示例动态
  console.log("💬 创建示例动态...")
  const activity = await prisma.activity.create({
    data: {
      content:
        "今天完成了博客系统的数据层设计，使用 Prisma + PostgreSQL 的组合真的很强大！#技术分享",
      imageUrls: ["https://picsum.photos/seed/activity1/600/400"],
      isPinned: false,
      authorId: normalUser.id,
    },
  })
  console.log(`✅ 创建动态: ${activity.content.substring(0, 30)}...`)

  // 创建示例评论
  console.log("💭 创建示例评论...")
  const comment = await prisma.comment.create({
    data: {
      content: "写得很好，期待更多精彩内容！",
      authorId: normalUser.id,
      postId: post.id,
    },
  })
  console.log("✅ 创建评论完成")

  // 创建示例点赞
  console.log("👍 创建示例点赞...")
  await prisma.like.create({
    data: {
      authorId: normalUser.id,
      postId: post.id,
    },
  })
  console.log("✅ 创建点赞记录")

  // 创建示例收藏
  console.log("⭐ 创建示例收藏...")
  await prisma.bookmark.create({
    data: {
      userId: normalUser.id,
      postId: post.id,
    },
  })
  console.log("✅ 创建收藏记录")

  // 创建关注关系
  console.log("👥 创建关注关系...")
  await prisma.follow.create({
    data: {
      followerId: normalUser.id,
      followingId: adminUser.id,
    },
  })
  console.log("✅ 普通用户关注了管理员")

  console.log("\n✨ 数据库种子数据播种完成！")
  console.log("📊 数据统计:")
  console.log(`  - 用户: 2 个 (1 管理员, 1 普通用户)`)
  console.log(`  - 标签: 2 个`)
  console.log(`  - 系列: 1 个`)
  console.log(`  - 文章: 1 篇`)
  console.log(`  - 动态: 1 条`)
  console.log(`  - 评论: 1 条`)
  console.log(`  - 点赞: 1 个`)
  console.log(`  - 收藏: 1 个`)
  console.log(`  - 关注: 1 个关系`)

  console.log("\n🔑 测试账号:")
  console.log("  管理员: admin@example.com / admin123456")
  console.log("  普通用户: user@example.com / user123456")
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error("❌ 种子数据播种失败:", e)
    await prisma.$disconnect()
    process.exit(1)
  })
