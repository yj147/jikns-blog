import { PrismaClient } from "@/lib/generated/prisma"
import { calculateReadTime } from "@/lib/utils/blog-helpers"

const prisma = new PrismaClient()

async function main() {
  console.log("📊 检查文章摘要长度和阅读时间...\n")

  const posts = await prisma.post.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
  })

  for (const post of posts) {
    const excerptLength = post.excerpt?.length || 0
    const contentLength = post.content.length
    const readTime = calculateReadTime(contentLength)

    console.log("----------------------------------------")
    console.log(`标题: ${post.title}`)
    console.log(`摘要长度: ${excerptLength} 字符`)
    console.log(`内容长度: ${contentLength} 字符`)
    console.log(`计算的阅读时间: ${readTime}`)
    console.log(
      `实际比例: ${excerptLength > 0 ? (contentLength / excerptLength).toFixed(2) : "N/A"}`
    )
    console.log()
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
