import { PrismaClient } from "@/lib/generated/prisma"

const prisma = new PrismaClient()

async function main() {
  console.log('🧹 清理文章 "nextjs-blog" 的测试数据...\n')

  const post = await prisma.post.findUnique({
    where: { slug: "nextjs-blog" },
  })

  if (!post) {
    console.log("❌ 文章不存在")
    return
  }

  console.log(`找到文章: ${post.title}`)
  console.log(`当前浏览量: ${post.viewCount}`)

  // 1. 删除所有评论
  const deletedComments = await prisma.comment.deleteMany({
    where: { postId: post.id },
  })
  console.log(`✅ 删除了 ${deletedComments.count} 条评论`)

  // 2. 重置浏览量
  await prisma.post.update({
    where: { id: post.id },
    data: { viewCount: 0 },
  })
  console.log(`✅ 浏览量重置为 0`)

  console.log("\n✨ 清理完成！")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
