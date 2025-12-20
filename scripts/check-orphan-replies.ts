import { prisma } from "@/lib/prisma"

async function checkOrphanReplies() {
  const targetId = "7dd73c82-3851-4e90-ac6f-f02a2f59a199"

  // 查找所有评论（包括有 parentId 的）
  const allComments = await prisma.comment.findMany({
    where: {
      postId: targetId,
      deletedAt: null,
    },
    select: {
      id: true,
      parentId: true,
      content: true,
      deletedAt: true,
    },
    orderBy: { createdAt: "asc" },
  })

  console.log(`=== 文章 ${targetId} 的所有未软删除评论 ===`)
  console.log(`总数: ${allComments.length}\n`)

  allComments.forEach((c, idx) => {
    console.log(
      `${idx + 1}. ID: ${c.id.slice(0, 8)}... | parentId: ${c.parentId ? c.parentId.slice(0, 8) + "..." : "null"} | content: ${c.content.slice(0, 20)}`
    )
  })

  // 检查孤儿回复（parentId 指向已删除的评论）
  const orphans = []
  for (const comment of allComments) {
    if (comment.parentId) {
      const parent = await prisma.comment.findUnique({
        where: { id: comment.parentId },
        select: { deletedAt: true },
      })

      if (!parent || parent.deletedAt) {
        orphans.push(comment)
      }
    }
  }

  console.log(`\n=== 孤儿回复（父评论已删除）===`)
  console.log(`总数: ${orphans.length}\n`)

  orphans.forEach((c, idx) => {
    console.log(
      `${idx + 1}. ID: ${c.id.slice(0, 8)}... | parentId: ${c.parentId!.slice(0, 8)}... | content: ${c.content.slice(0, 20)}`
    )
  })

  await prisma.$disconnect()
}

checkOrphanReplies().catch(console.error)
