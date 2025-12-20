import { PrismaClient } from "@/lib/generated/prisma"

const prisma = new PrismaClient()

async function main() {
  console.log("📊 查询文章数据...\n")

  const posts = await prisma.post.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    include: {
      _count: {
        select: {
          comments: true,
          likes: true,
          bookmarks: true,
        },
      },
    },
  })

  for (const post of posts) {
    console.log("----------------------------------------")
    console.log(`标题: ${post.title}`)
    console.log(`Slug: ${post.slug}`)
    console.log(`浏览量: ${post.viewCount}`)
    console.log(`评论数 (数据库_count): ${post._count.comments}`)
    console.log(`点赞数 (数据库_count): ${post._count.likes}`)
    console.log(`发布时间: ${post.publishedAt ? post.publishedAt.toISOString() : "未发布"}`)
    console.log(`创建时间: ${post.createdAt.toISOString()}`)
    console.log(`发布状态: ${post.published ? "已发布" : "草稿"}`)
    console.log()
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
