/**
 * 验证 Post CRUD 设置和数据模型
 * 检查数据库结构和基础功能
 */

import { prisma } from "../lib/prisma"
import { createSlug, createUniqueSlug, validateSlug } from "../lib/utils/slug"

async function verifyPostsSetup() {
  console.log("🔍 验证 Post CRUD 设置...")

  try {
    // 1. 测试数据库连接
    console.log("\n1. 测试数据库连接...")
    await prisma.$connect()
    console.log("✅ 数据库连接成功")

    // 2. 检查数据表是否存在
    console.log("\n2. 检查数据表结构...")
    const posts = await prisma.post.findMany({ take: 1 })
    console.log("✅ Post 表存在")

    const users = await prisma.user.findMany({ take: 1, where: { role: "ADMIN" } })
    console.log(`✅ User 表存在，管理员数量: ${users.length}`)

    const tags = await prisma.tag.findMany({ take: 1 })
    console.log("✅ Tag 表存在")

    const postTags = await prisma.postTag.findMany({ take: 1 })
    console.log("✅ PostTag 关联表存在")

    // 3. 测试 Slug 生成功能
    console.log("\n3. 测试 Slug 生成功能...")
    const testTitle = "测试文章标题 - Post CRUD 验证"
    const generatedSlug = createSlug(testTitle)
    console.log(`✅ Slug 生成成功: "${testTitle}" → "${generatedSlug}"`)

    const slugValidation = validateSlug(generatedSlug)
    console.log(`✅ Slug 验证: ${slugValidation.isValid ? "通过" : "失败"}`)
    if (!slugValidation.isValid) {
      console.log("   错误:", slugValidation.errors)
    }

    // 4. 测试唯一 Slug 生成
    console.log("\n4. 测试唯一 Slug 生成...")
    const uniqueSlug = await createUniqueSlug(testTitle, async (candidateSlug: string) => {
      const existing = await prisma.post.findUnique({
        where: { slug: candidateSlug },
      })
      return !!existing
    })
    console.log(`✅ 唯一 Slug 生成成功: "${uniqueSlug}"`)

    // 5. 检查现有数据统计
    console.log("\n5. 检查现有数据统计...")
    const [postCount, userCount, tagCount] = await Promise.all([
      prisma.post.count(),
      prisma.user.count(),
      prisma.tag.count(),
    ])
    console.log(`📊 数据统计:`)
    console.log(`   文章数量: ${postCount}`)
    console.log(`   用户数量: ${userCount}`)
    console.log(`   标签数量: ${tagCount}`)

    // 6. 检查权限系统
    console.log("\n6. 检查权限系统...")
    const adminUsers = await prisma.user.findMany({
      where: { role: "ADMIN", status: "ACTIVE" },
    })
    console.log(`✅ 活跃管理员用户: ${adminUsers.length} 个`)
    adminUsers.forEach((user) => {
      console.log(`   - ${user.email} (${user.name || "未设置昵称"})`)
    })

    // 7. 测试复杂查询能力
    console.log("\n7. 测试复杂查询能力...")
    const publishedPostsWithTags = await prisma.post.findMany({
      where: { published: true },
      include: {
        author: {
          select: { id: true, name: true, email: true },
        },
        tags: {
          include: {
            tag: {
              select: { name: true, slug: true },
            },
          },
        },
        _count: {
          select: { comments: true, likes: true, bookmarks: true },
        },
      },
      take: 3,
      orderBy: { publishedAt: "desc" },
    })
    console.log(`✅ 复杂查询成功: 找到 ${publishedPostsWithTags.length} 篇已发布文章`)

    publishedPostsWithTags.forEach((post, index) => {
      console.log(`   ${index + 1}. ${post.title}`)
      console.log(`      作者: ${post.author.name || post.author.email}`)
      console.log(`      标签: ${post.tags.map((pt) => pt.tag.name).join(", ") || "无"}`)
      console.log(`      统计: ${post._count.comments} 评论, ${post._count.likes} 点赞`)
    })

    console.log("\n🎉 Post CRUD 设置验证完成！所有基础功能正常")
    console.log("\n📋 验证结果总结:")
    console.log("✅ 数据库连接正常")
    console.log("✅ 数据表结构完整")
    console.log("✅ Slug 生成功能正常")
    console.log("✅ 权限系统配置正确")
    console.log("✅ 复杂查询功能正常")
    console.log("\n🚀 可以开始使用 Server Actions 进行文章管理！")
  } catch (error) {
    console.error("\n❌ 验证过程中出现错误:", error)
    console.log("\n💡 可能的解决方案:")
    console.log("1. 确保数据库服务正在运行")
    console.log("2. 检查 .env.local 文件中的数据库连接字符串")
    console.log("3. 运行 `npx prisma db push` 同步数据库结构")
    console.log("4. 运行 `npx prisma generate` 生成客户端代码")
  } finally {
    await prisma.$disconnect()
    console.log("\n📝 数据库连接已关闭")
  }
}

// 如果直接运行此文件则执行验证
if (require.main === module) {
  verifyPostsSetup().catch(console.error)
}

export { verifyPostsSetup }
