import { prisma } from "@/lib/prisma"

async function checkComments() {
  // 统计顶层评论
  const topLevelCount = await prisma.comment.count({
    where: { parentId: null, deletedAt: null },
  })

  // 统计所有评论（包括回复）
  const totalCount = await prisma.comment.count({
    where: { deletedAt: null },
  })

  // 获取前几条顶层评论及其回复计数
  const topComments = await prisma.comment.findMany({
    where: { parentId: null, deletedAt: null },
    take: 5,
    include: {
      _count: {
        select: { replies: true },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  console.log("=== 评论数据诊断 ===")
  console.log("顶层评论数:", topLevelCount)
  console.log("总评论数（含回复）:", totalCount)
  console.log("\n前5条顶层评论的回复数：")
  topComments.forEach((comment, idx) => {
    console.log(
      idx + 1 + ". 评论ID:",
      comment.id.slice(0, 8) + "... | 回复数:",
      comment._count.replies
    )
  })

  await prisma.$disconnect()
}

checkComments().catch(console.error)
