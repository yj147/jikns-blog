import { prisma } from "@/lib/prisma"

async function checkAllComments() {
  // 检查所有文章的评论
  const posts = await prisma.post.findMany({
    select: {
      id: true,
      title: true,
      slug: true,
    },
    take: 5,
    orderBy: { createdAt: "desc" },
  })

  console.log("=== 检查所有文章的评论 ===")

  for (const post of posts) {
    const topLevel = await prisma.comment.count({
      where: { postId: post.id, parentId: null, deletedAt: null },
    })

    const total = await prisma.comment.count({
      where: { postId: post.id, deletedAt: null },
    })

    console.log(`\n文章: ${post.title.slice(0, 30)}...`)
    console.log(`  ID: ${post.id}`)
    console.log(`  顶层评论: ${topLevel}`)
    console.log(`  总评论: ${total}`)
  }

  // 检查特定的 post
  const targetId = "7dd73c82-3851-4e90-ac6f-f02a2f59a199"
  const targetComments = await prisma.comment.findMany({
    where: {
      postId: targetId,
      parentId: null,
      deletedAt: null,
    },
    select: {
      id: true,
      content: true,
      deletedAt: true,
      _count: {
        select: { replies: true },
      },
    },
  })

  console.log(`\n\n=== 目标文章 ${targetId} 的顶层评论 ===`)
  targetComments.forEach((c, idx) => {
    console.log(
      `${idx + 1}. ${c.id.slice(0, 8)}... | deletedAt: ${c.deletedAt} | replies: ${c._count.replies}`
    )
  })

  await prisma.$disconnect()
}

checkAllComments().catch(console.error)
