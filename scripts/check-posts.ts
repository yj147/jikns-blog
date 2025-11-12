/**
 * 检查数据库中的文章状态
 */
import { PrismaClient } from "@/lib/generated/prisma"

const prisma = new PrismaClient()

async function checkPosts() {
  try {
    console.log("检查数据库中的文章...")

    // 查找所有文章
    const allPosts = await prisma.post.findMany({
      include: {
        author: {
          select: {
            name: true,
            email: true,
          },
        },
        tags: {
          include: {
            tag: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    console.log(`\n找到 ${allPosts.length} 篇文章:\n`)

    allPosts.forEach((post, index) => {
      console.log(`${index + 1}. 标题: ${post.title}`)
      console.log(`   Slug: ${post.slug}`)
      console.log(`   已发布: ${post.published}`)
      console.log(`   发布时间: ${post.publishedAt}`)
      console.log(`   作者: ${post.author.name} (${post.author.email})`)
      console.log(`   内容长度: ${post.content.length} 字符`)
      console.log(`   摘要: ${post.excerpt || "无摘要"}`)
      console.log(`   标签: ${post.tags.map((pt) => pt.tag.name).join(", ") || "无标签"}`)
      console.log(`   访问链接: http://localhost:3999/blog/${post.slug}`)
      console.log(`   创建时间: ${post.createdAt}`)
      console.log(`   ---`)
    })

    // 单独查找可能有问题的 slug
    const targetSlug = "xian-dai-qian-duan-kai-fa-zui-佳-shi-jian-4"
    const postBySlug = await prisma.post.findUnique({
      where: { slug: targetSlug },
      include: {
        author: true,
        tags: {
          include: {
            tag: true,
          },
        },
      },
    })

    if (postBySlug) {
      console.log(`\n✅ 找到目标文章 (${targetSlug}):`)
      console.log(`   标题: ${postBySlug.title}`)
      console.log(`   已发布: ${postBySlug.published}`)
      console.log(`   发布时间: ${postBySlug.publishedAt}`)
    } else {
      console.log(`\n❌ 未找到目标文章 (${targetSlug})`)
    }
  } catch (error) {
    console.error("❌ 检查文章失败:", error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

checkPosts()
  .then(() => {
    console.log("\n🎉 检查完成")
    process.exit(0)
  })
  .catch((error) => {
    console.error("💥 检查失败:", error)
    process.exit(1)
  })
