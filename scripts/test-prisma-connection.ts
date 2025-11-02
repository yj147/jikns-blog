/**
 * 测试 Prisma 连接和基础查询功能
 */

import { prisma } from "../lib/prisma"

async function testConnection() {
  console.log("🔗 测试 Prisma 数据库连接...\n")

  try {
    // 1. 测试基础连接
    console.log("1. 测试数据库连接...")
    await prisma.$connect()
    console.log("✅ 数据库连接成功\n")

    // 2. 查询用户数据
    console.log("2. 查询用户数据...")
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
      },
    })
    console.log("✅ 用户查询成功:")
    users.forEach((user) => {
      console.log(`  - ${user.name} (${user.email}) [${user.role}]`)
    })
    console.log("")

    // 3. 查询文章数据（包含关联）
    console.log("3. 查询文章数据（包含关联）...")
    const posts = await prisma.post.findMany({
      select: {
        id: true,
        title: true,
        slug: true,
        published: true,
        viewCount: true,
        seoTitle: true,
        seoDescription: true,
        author: {
          select: { name: true, email: true },
        },
        series: {
          select: { title: true },
        },
        tags: {
          select: {
            tag: {
              select: { name: true, color: true },
            },
          },
        },
        _count: {
          select: {
            comments: true,
            likes: true,
            bookmarks: true,
          },
        },
      },
    })

    console.log("✅ 文章查询成功:")
    posts.forEach((post) => {
      console.log(`  - "${post.title}" (slug: ${post.slug})`)
      console.log(`    作者: ${post.author.name}`)
      console.log(`    系列: ${post.series?.title || "无"}`)
      console.log(`    SEO标题: ${post.seoTitle || "无"}`)
      console.log(`    标签: ${post.tags.map((t) => t.tag.name).join(", ")}`)
      console.log(
        `    统计: ${post._count.comments}评论, ${post._count.likes}点赞, ${post._count.bookmarks}收藏`
      )
      console.log(`    发布: ${post.published ? "已发布" : "草稿"}, 浏览: ${post.viewCount}`)
    })
    console.log("")

    // 4. 查询标签数据
    console.log("4. 查询标签数据...")
    const tags = await prisma.tag.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        color: true,
        postsCount: true,
      },
      orderBy: {
        postsCount: "desc",
      },
    })

    console.log("✅ 标签查询成功:")
    tags.forEach((tag) => {
      console.log(`  - ${tag.name} (${tag.slug}) [${tag.color}] - ${tag.postsCount}篇文章`)
    })
    console.log("")

    // 5. 测试复杂查询：获取用户的社交统计
    console.log("5. 测试复杂查询：用户社交统计...")
    const userStats = await prisma.user.findMany({
      select: {
        name: true,
        email: true,
        _count: {
          select: {
            posts: true,
            activities: true,
            comments: true,
            likes: true,
            bookmarks: true,
            followers: true,
            following: true,
          },
        },
      },
    })

    console.log("✅ 用户统计查询成功:")
    userStats.forEach((user) => {
      console.log(`  - ${user.name} (${user.email}):`)
      console.log(`    内容: ${user._count.posts}篇文章, ${user._count.activities}条动态`)
      console.log(`    互动: ${user._count.comments}条评论, ${user._count.likes}个点赞`)
      console.log(`    社交: ${user._count.followers}粉丝, ${user._count.following}关注`)
      console.log(`    收藏: ${user._count.bookmarks}个`)
    })
    console.log("")

    console.log("🎉 所有测试通过！数据库连接和查询功能正常工作。")
  } catch (error) {
    console.error("❌ 测试失败:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

testConnection()
