/**
 * 评论系统测试脚本
 * 用于测试评论 API 的基本功能
 */

const API_BASE = 'http://localhost:3000/api'

// 测试数据
const testComment = {
  post_slug: 'test-article',
  author_name: '测试用户',
  author_email: 'test@example.com',
  author_website: 'https://example.com',
  content: '这是一条测试评论，用于验证评论系统的功能。',
}

const testReply = {
  post_slug: 'test-article',
  author_name: '回复用户',
  author_email: 'reply@example.com',
  content: '这是一条回复评论。',
}

// 测试函数
async function testCreateComment() {
  console.log('🧪 测试创建评论...')

  try {
    const response = await fetch(`${API_BASE}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testComment),
    })

    const data = await response.json()

    if (data.success) {
      console.log('✅ 评论创建成功:', data.comment.id)
      return data.comment.id
    } else {
      console.log('❌ 评论创建失败:', data.error)
      return null
    }
  } catch (error) {
    console.log('❌ 网络错误:', error.message)
    return null
  }
}

async function testCreateReply(parentId) {
  console.log('🧪 测试创建回复...')

  try {
    const response = await fetch(`${API_BASE}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...testReply,
        parent_id: parentId,
      }),
    })

    const data = await response.json()

    if (data.success) {
      console.log('✅ 回复创建成功:', data.comment.id)
      return data.comment.id
    } else {
      console.log('❌ 回复创建失败:', data.error)
      return null
    }
  } catch (error) {
    console.log('❌ 网络错误:', error.message)
    return null
  }
}

async function testGetComments(slug) {
  console.log('🧪 测试获取评论...')

  try {
    const response = await fetch(`${API_BASE}/comments/${encodeURIComponent(slug)}`)
    const data = await response.json()

    if (data.success) {
      console.log('✅ 评论获取成功, 总数:', data.total)
      console.log('📝 评论列表:')
      data.comments.forEach((comment, index) => {
        console.log(
          `  ${index + 1}. ${comment.author_name}: ${comment.content.substring(0, 50)}...`
        )
        if (comment.replies && comment.replies.length > 0) {
          comment.replies.forEach((reply, replyIndex) => {
            console.log(
              `    └─ ${replyIndex + 1}. ${reply.author_name}: ${reply.content.substring(0, 30)}...`
            )
          })
        }
      })
      return data.comments
    } else {
      console.log('❌ 评论获取失败:', data.error)
      return null
    }
  } catch (error) {
    console.log('❌ 网络错误:', error.message)
    return null
  }
}

async function testSpamDetection() {
  console.log('🧪 测试垃圾评论检测...')

  const spamComment = {
    post_slug: 'test-article',
    author_name: 'Spammer',
    author_email: 'spam@example.com',
    content:
      'Click here to win free money! Visit https://spam1.com https://spam2.com https://spam3.com https://spam4.com for more details!',
  }

  try {
    const response = await fetch(`${API_BASE}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(spamComment),
    })

    const data = await response.json()

    if (data.success) {
      console.log('✅ 垃圾评论检测正常:', data.message)
    } else {
      console.log('❌ 垃圾评论检测失败:', data.error)
    }
  } catch (error) {
    console.log('❌ 网络错误:', error.message)
  }
}

async function testValidation() {
  console.log('🧪 测试数据验证...')

  const invalidComment = {
    post_slug: '',
    author_name: '',
    author_email: 'invalid-email',
    content: '',
  }

  try {
    const response = await fetch(`${API_BASE}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invalidComment),
    })

    const data = await response.json()

    if (!data.success) {
      console.log('✅ 数据验证正常:', data.error)
    } else {
      console.log('❌ 数据验证失败: 应该拒绝无效数据')
    }
  } catch (error) {
    console.log('❌ 网络错误:', error.message)
  }
}

// 主测试函数
async function runTests() {
  console.log('🚀 开始评论系统测试...\n')

  // 测试创建评论
  const commentId = await testCreateComment()
  console.log('')

  if (commentId) {
    // 测试创建回复
    await testCreateReply(commentId)
    console.log('')
  }

  // 测试获取评论
  await testGetComments('test-article')
  console.log('')

  // 测试垃圾评论检测
  await testSpamDetection()
  console.log('')

  // 测试数据验证
  await testValidation()
  console.log('')

  console.log('🏁 测试完成!')
}

// 如果直接运行此脚本
import fetch from 'node-fetch'

// 如果直接运行此脚本
if (typeof window === 'undefined') {
  // Node.js 环境
  runTests()
} else {
  // 浏览器环境
  window.testComments = runTests
  console.log('💡 在浏览器控制台中运行 testComments() 来开始测试')
}
