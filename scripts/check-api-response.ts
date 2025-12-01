import { listComments } from '@/lib/interactions/comments'

async function checkApiResponse() {
  // 测试 listComments 函数的返回值
  const result = await listComments({
    targetType: 'post',
    targetId: '7dd73c82-3851-4e90-ac6f-f02a2f59a199',
    limit: 10,
    includeAuthor: true,
    includeReplies: false,
  })

  console.log('=== API 响应格式检查 ===')
  console.log('返回的评论数量:', result.comments.length)
  console.log('totalCount (总评论数):', result.totalCount)
  console.log('hasMore:', result.hasMore)
  console.log('nextCursor:', result.nextCursor)

  if (result.comments.length > 0) {
    const firstComment = result.comments[0]
    console.log('\n第一条评论的字段：')
    console.log('- id:', firstComment.id.slice(0, 8) + '...')
    console.log('- _count:', JSON.stringify(firstComment._count))
    console.log('- childrenCount:', firstComment.childrenCount)
    console.log('- replies:', firstComment.replies ? '存在' : '不存在')
    console.log('- author:', firstComment.author ? '存在' : '不存在')

    console.log('\n完整的第一条评论对象：')
    console.log(JSON.stringify(firstComment, null, 2))
  }
}

checkApiResponse().catch(console.error)
