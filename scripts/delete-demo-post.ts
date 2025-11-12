/**
 * 删除之前创建的测试文章
 */
import { PrismaClient } from "@/lib/generated/prisma"

const prisma = new PrismaClient()

async function deleteDemoPost() {
  try {
    console.log("开始删除测试文章...")

    // 查找并删除测试文章
    const post = await prisma.post.findUnique({
      where: {
        slug: "react-typescript-best-practices-guide",
      },
    })

    if (post) {
      // 删除相关的关联数据
      await prisma.postTag.deleteMany({
        where: { postId: post.id },
      })

      await prisma.comment.deleteMany({
        where: { postId: post.id },
      })

      await prisma.like.deleteMany({
        where: { postId: post.id },
      })

      await prisma.bookmark.deleteMany({
        where: { postId: post.id },
      })

      // 删除文章本身
      await prisma.post.delete({
        where: { id: post.id },
      })

      console.log("✅ 成功删除测试文章:", post.title)
    } else {
      console.log("📝 未找到要删除的测试文章")
    }
  } catch (error) {
    console.error("❌ 删除文章失败:", error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

deleteDemoPost()
  .then(() => {
    console.log("🎉 删除操作完成")
    process.exit(0)
  })
  .catch((error) => {
    console.error("💥 删除操作失败:", error)
    process.exit(1)
  })
