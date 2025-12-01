/**
 * 数据库种子数据脚本
 * 支持多种场景（默认 / feed），通过 --scenario=feed 追加活动流基线
 */

import { PrismaClient, Role, UserStatus } from "@/lib/generated/prisma"
import { randomUUID } from "node:crypto"
import bcrypt from "bcrypt"
import { createClient } from "@supabase/supabase-js"

import { seedFeedScenario, type FeedSeedContext } from "@/scripts/seed/activities"

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    },
  },
})

// 初始化 Supabase Admin 客户端（用于创建认证账号）
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321"
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

if (!supabaseServiceKey) {
  console.warn("⚠️  未找到 SUPABASE_SERVICE_ROLE_KEY，将跳过 Supabase Auth 账号创建")
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

type SeedScenario = "default" | "feed"

function resolveSeedScenario(): SeedScenario {
  const args = process.argv.slice(2)
  let scenario: string | undefined

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === "--scenario" && args[i + 1]) {
      scenario = args[i + 1]
      break
    }
    if (arg.startsWith("--scenario=")) {
      scenario = arg.split("=")[1]
      break
    }
  }

  if (scenario && scenario.toLowerCase() === "feed") {
    return "feed"
  }
  return "default"
}

/**
 * 创建用户（同时创建 Supabase Auth 和 Prisma 记录）
 */
async function createUserWithAuth(
  email: string,
  password: string,
  userData: {
    name: string
    avatarUrl: string
    bio: string
    socialLinks: any
    role: Role
    status: UserStatus
  }
) {
  // 1. 先在 Supabase Auth 创建认证账号
  console.log(`  → 创建 Supabase Auth 账号: ${email}`)
  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // 自动确认邮箱（开发环境）
    user_metadata: {
      name: userData.name,
    },
  })

  if (authError) {
    // 如果账号已存在，尝试获取现有账号
    if (authError.message.includes("already registered")) {
      console.log(`  ⚠️  账号已存在，尝试查询现有记录: ${email}`)
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
      const existing = existingUsers?.users.find((u) => u.email === email)
      if (existing) {
        console.log(`  ✓ 找到现有 Auth 账号，使用 ID: ${existing.id}`)
        // 使用现有账号 ID 创建/更新 Prisma 记录
        const passwordHash = await bcrypt.hash(password, 10)
        return await prisma.user.upsert({
          where: { id: existing.id },
          update: { ...userData, passwordHash, updatedAt: new Date() },
          create: {
            id: existing.id,
            email,
            passwordHash,
            ...userData,
            lastLoginAt: new Date(),
            updatedAt: new Date(),
          },
        })
      }
    }
    throw new Error(`Supabase Auth 创建失败: ${authError.message}`)
  }

  if (!authUser?.user) {
    throw new Error("Supabase Auth 返回空用户")
  }

  console.log(`  ✓ Supabase Auth 账号创建成功，ID: ${authUser.user.id}`)

  // 2. 用 Auth 账号的 ID 创建 Prisma 记录
  console.log(`  → 创建 Prisma 用户记录: ${email}`)
  const passwordHash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: {
      id: authUser.user.id, // 使用 Supabase Auth 的 ID
      email,
      passwordHash,
      ...userData,
      lastLoginAt: new Date(),
      updatedAt: new Date(),
    },
  })

  console.log(`  ✓ Prisma 用户创建成功: ${user.email}`)
  return user
}

async function resetDatabase(db: PrismaClient) {
  console.log("🧹 清理现有数据...")

  // 先清理 Supabase Auth 账号（如果存在）
  if (supabaseServiceKey) {
    console.log("  → 清理 Supabase Auth 测试账号...")
    const { data: users } = await supabaseAdmin.auth.admin.listUsers()
    const testEmails = ["admin@example.com", "user@example.com"]

    for (const email of testEmails) {
      const user = users?.users.find((u) => u.email === email)
      if (user) {
        await supabaseAdmin.auth.admin.deleteUser(user.id)
        console.log(`  ✓ 删除 Auth 账号: ${email}`)
      }
    }
  }

  // 清理 Prisma 数据
  await db.$transaction([
    db.systemSetting.deleteMany(),
    db.follow.deleteMany(),
    db.bookmark.deleteMany(),
    db.like.deleteMany(),
    db.comment.deleteMany(),
    db.activityTagCandidate.deleteMany(),
    db.activity.deleteMany(),
    db.postTag.deleteMany(),
    db.post.deleteMany(),
    db.series.deleteMany(),
    db.tag.deleteMany(),
    db.user.deleteMany(),
  ])
}

async function seedBaseline(db: PrismaClient): Promise<FeedSeedContext> {
  console.log("👤 创建管理员用户...")
  const adminUser = await createUserWithAuth("admin@example.com", "admin123456", {
    name: "系统管理员",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=admin",
    bio: "博客系统管理员，负责内容发布和系统维护。",
    socialLinks: {
      github: "https://github.com",
      website: "https://example.com",
    },
    role: Role.ADMIN,
    status: UserStatus.ACTIVE,
  })
  console.log(`✅ 管理员用户创建完成: ${adminUser.email}`)

  console.log("👤 创建普通用户...")
  const normalUser = await createUserWithAuth("user@example.com", "user123456", {
    name: "示例用户",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=user",
    bio: "热爱技术，喜欢分享。",
    socialLinks: {
      github: "https://github.com/user",
    },
    role: Role.USER,
    status: UserStatus.ACTIVE,
  })
  console.log(`✅ 普通用户创建完成: ${normalUser.email}`)

  console.log("🏷️ 创建标签...")
  const techTag = await db.tag.create({
    data: {
      id: randomUUID(),
      name: "技术",
      slug: "tech",
      description: "技术相关文章",
      color: "#3B82F6",
      postsCount: 0,
      updatedAt: new Date(),
    },
  })
  console.log(`✅ 创建标签: ${techTag.name}`)

  const lifeTag = await db.tag.create({
    data: {
      id: randomUUID(),
      name: "生活",
      slug: "life",
      description: "生活感悟与分享",
      color: "#10B981",
      postsCount: 0,
      updatedAt: new Date(),
    },
  })
  console.log(`✅ 创建标签: ${lifeTag.name}`)

  console.log("📚 创建示例系列...")
  const series = await db.series.create({
    data: {
      id: randomUUID(),
      title: "Next.js 全栈开发指南",
      slug: "nextjs-fullstack-guide",
      description: "从零开始学习 Next.js 全栈开发，包括前端、后端和部署。",
      coverUrl: "https://picsum.photos/seed/series/800/400",
      sortOrder: 1,
      authorId: adminUser.id,
      updatedAt: new Date(),
    },
  })
  console.log(`✅ 创建系列: ${series.title}`)

  console.log("📝 创建示例博客文章...")
  const post = await db.post.create({
    data: {
      id: randomUUID(),
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
      updatedAt: new Date(),
    },
  })
  console.log(`✅ 创建博客文章: ${post.title}`)

  console.log("🔗 关联文章标签...")
  await db.postTag.create({
    data: {
      postId: post.id,
      tagId: techTag.id,
    },
  })

  await db.tag.update({
    where: { id: techTag.id },
    data: { postsCount: 1 },
  })
  console.log("✅ 文章标签关联完成")

  console.log("💬 创建示例动态...")
  const activity = await db.activity.create({
    data: {
      id: randomUUID(),
      content:
        "今天完成了博客系统的数据层设计，使用 Prisma + PostgreSQL 的组合真的很强大！#技术分享",
      imageUrls: ["https://picsum.photos/seed/activity1/600/400"],
      isPinned: false,
      authorId: normalUser.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })
  console.log(`✅ 创建动态: ${activity.content.substring(0, 30)}...`)

  console.log("💭 创建示例评论...")
  await db.comment.create({
    data: {
      id: randomUUID(),
      content: "写得很好，期待更多精彩内容！",
      authorId: normalUser.id,
      postId: post.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })
  console.log("✅ 创建评论完成")

  console.log("👍 创建示例点赞...")
  await db.like.create({
    data: {
      id: randomUUID(),
      authorId: normalUser.id,
      postId: post.id,
    },
  })
  console.log("✅ 创建点赞记录")

  console.log("⭐ 创建示例收藏...")
  await db.bookmark.create({
    data: {
      id: randomUUID(),
      userId: normalUser.id,
      postId: post.id,
    },
  })
  console.log("✅ 创建收藏记录")

  console.log("👥 创建关注关系...")
  await db.follow.create({
    data: {
      followerId: normalUser.id,
      followingId: adminUser.id,
    },
  })
  console.log("✅ 普通用户关注了管理员")

  console.log("🏷️ 创建待审核标签候选...")
  const tagCandidates = [
    {
      name: "React",
      slug: "react",
      occurrences: 3,
      lastSeenActivityId: activity.id,
    },
    {
      name: "TypeScript",
      slug: "typescript",
      occurrences: 2,
      lastSeenActivityId: activity.id,
    },
    {
      name: "Next.js",
      slug: "nextjs",
      occurrences: 5,
      lastSeenActivityId: activity.id,
    },
    {
      name: "Prisma",
      slug: "prisma",
      occurrences: 4,
      lastSeenActivityId: activity.id,
    },
    {
      name: "数据库设计",
      slug: "database-design",
      occurrences: 1,
      lastSeenActivityId: activity.id,
    },
  ]

  for (const candidate of tagCandidates) {
      await db.activityTagCandidate.create({
      data: { id: randomUUID(), ...candidate, updatedAt: new Date() },
    })
  }
  console.log(`✅ 创建了 ${tagCandidates.length} 个待审核标签候选`)

  console.log("\n📊 基础数据统计:")
  console.log("  - 用户: 2 个 (1 管理员, 1 普通用户)")
  console.log("  - 标签: 2 个")
  console.log("  - 系列: 1 个")
  console.log("  - 文章: 1 篇")
  console.log("  - 动态: 1 条")
  console.log("  - 评论: 1 条")
  console.log("  - 点赞: 1 个")
  console.log("  - 收藏: 1 个")
  console.log("  - 关注: 1 个关系")
  console.log(`  - 待审核标签: ${tagCandidates.length} 个`)

  console.log("\n🔑 测试账号:")
  console.log("  管理员: admin@example.com / admin123456")
  console.log("  普通用户: user@example.com / user123456")

  console.log("\n⚙️ 初始化系统设置...")
  const systemSettings = [
    {
      key: "seo.meta",
      value: {
        title: "Jikns Blog",
        description: "A modern full-stack blog for experiments and learning.",
        keywords: [] as string[],
      },
    },
    {
      key: "registration.toggle",
      value: {
        enabled: true,
      },
    },
  ]

  for (const setting of systemSettings) {
    await db.systemSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value, updatedById: adminUser.id },
      create: { key: setting.key, value: setting.value, updatedById: adminUser.id },
    })
  }

  console.log("✅ 系统设置初始化完成")

  return {
    adminUserId: adminUser.id,
    defaultUserId: normalUser.id,
    featuredPostId: post.id,
  }
}

async function main() {
  const scenario = resolveSeedScenario()
  console.log(`🌱 开始播种数据库（场景: ${scenario}）...`)

  await resetDatabase(prisma)
  const baselineReference = await seedBaseline(prisma)

  if (scenario === "feed") {
    await seedFeedScenario(prisma, baselineReference)
  }

  console.log("\n✨ 数据库种子执行完成。")
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
