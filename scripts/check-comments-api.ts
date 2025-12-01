import { prisma } from '@/lib/prisma'

async function checkCommentApi() {
  // 找到一个有回复的评论的 target
  const commentWithReplies = await prisma.comment.findFirst({
    where: {
      parentId: null,
      deletedAt: null,
      replies: {
        some: {
          deletedAt: null
        }
      }
    },
    include: {
      _count: {
        select: { replies: true }
      }
    }
  })

  if (!commentWithReplies) {
    console.log('没有找到有回复的评论')
    await prisma.$disconnect()
    return
  }

  const targetType = commentWithReplies.postId ? 'post' : 'activity'
  const targetId = commentWithReplies.postId || commentWithReplies.activityId

  console.log('=== API 测试参数 ===')
  console.log('targetType:', targetType)
  console.log('targetId:', targetId)
  console.log('该目标下的评论ID:', commentWithReplies.id.slice(0, 8) + '...')
  console.log('回复数:', commentWithReplies._count.replies)
  console.log('\n现在可以测试 API:')
  console.log(`curl "http://localhost:3000/api/comments?targetType=${targetType}&targetId=${targetId}&limit=10"`)

  await prisma.$disconnect()
}

checkCommentApi().catch(console.error)
