import { prisma } from "../lib/prisma"

async function main() {
  const admin = await prisma.user.findFirst({ where: { email: "admin@example.com" } })
  if (!admin) throw new Error("Admin user not found")

  // 创建 10 个标签
  const tagPromises = Array.from({ length: 10 }, (_, i) =>
    prisma.tag.create({
      data: {
        name: `Tag ${i + 1}`,
        slug: `tag-${i + 1}-${Date.now()}`,
        description: `Description for tag ${i + 1}`,
        color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
        postsCount: 0,
      }
    })
  )
  const tags = await Promise.all(tagPromises)
  console.log(`✅ 创建了 ${tags.length} 个标签`)

  // 创建 10 篇文章
  const postPromises = Array.from({ length: 10 }, (_, i) =>
    prisma.post.create({
      data: {
        title: `Search Test Post ${i + 1}`,
        content: `This is content for search test post ${i + 1}. It contains various keywords for testing.`,
        excerpt: `Excerpt for post ${i + 1}`,
        slug: `search-post-${i + 1}-${Date.now()}`,
        published: true,
        publishedAt: new Date(Date.now() - i * 86400000),
        authorId: admin.id,
      }
    })
  )
  const posts = await Promise.all(postPromises)
  console.log(`✅ 创建了 ${posts.length} 篇文章`)

  // 创建 10 条动态
  const activityPromises = Array.from({ length: 10 }, (_, i) =>
    prisma.activity.create({
      data: {
        content: `Search test activity ${i + 1} with various keywords`,
        authorId: admin.id,
        imageUrls: [],
      }
    })
  )
  const activities = await Promise.all(activityPromises)
  console.log(`✅ 创建了 ${activities.length} 条动态`)

  console.log(`\n📊 搜索测试数据创建完成`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
