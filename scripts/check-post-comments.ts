import { PrismaClient } from '@/lib/generated/prisma'

const prisma = new PrismaClient()

async function main() {
  console.log('📊 检查文章 "nextjs-blog" 的评论数据...\n')

  const post = await prisma.post.findUnique({
    where: { slug: 'nextjs-blog' },
    include: {
      comments: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
      },
      _count: {
        select: {
          comments: true,
        }
      }
    }
  })

  if (!post) {
    console.log('❌ 文章不存在')
    return
  }

  console.log(`文章: ${post.title}`)
  console.log(`浏览量: ${post.viewCount}`)
  console.log(`评论总数 (_count): ${post._count.comments}`)
  console.log(`未删除的评论数: ${post.comments.length}\n`)

  if (post.comments.length > 0) {
    console.log('评论列表:')
    for (const comment of post.comments.slice(0, 5)) {
      console.log(`- [${comment.createdAt.toISOString()}] ${comment.content.substring(0, 50)}...`)
    }
    if (post.comments.length > 5) {
      console.log(`... 还有 ${post.comments.length - 5} 条评论`)
    }
  } else {
    console.log('没有找到评论数据')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
