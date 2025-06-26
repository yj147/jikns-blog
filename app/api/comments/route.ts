import { NextRequest, NextResponse } from 'next/server'
import {
  supabase,
  generateAvatarUrl,
  type CommentFormData,
  type CommentRow,
  rowToComment,
} from '@/lib/supabase'
import { commentSchema, isValidationError } from '@/lib/validation'

// 简单的垃圾评论检测
function isSpam(content: string, authorName: string): boolean {
  const spamKeywords = ['viagra', 'casino', 'lottery', 'winner', 'click here', 'free money']
  const text = (content + ' ' + authorName).toLowerCase()

  // 检查垃圾关键词
  if (spamKeywords.some((keyword) => text.includes(keyword))) {
    return true
  }

  // 检查过多链接
  const linkCount = (content.match(/https?:\/\//g) || []).length
  if (linkCount > 3) {
    return true
  }

  // 检查重复字符
  if (/(.)\1{10,}/.test(content)) {
    return true
  }

  return false
}

// POST - 创建新评论
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 验证输入数据
    const validatedData = commentSchema.parse(body)

    // 垃圾评论检测
    const isSpamComment = isSpam(validatedData.content, validatedData.author_name)

    // 获取头像 URL
    let avatarUrl = generateAvatarUrl(validatedData.author_email)

    // 如果是登录用户，尝试获取用户的真实头像
    if (validatedData.user_id && !validatedData.is_anonymous) {
      try {
        const { data: userData } = await supabase
          .from('users')
          .select('avatar_url')
          .eq('id', validatedData.user_id)
          .single()

        if (userData?.avatar_url) {
          avatarUrl = userData.avatar_url
        }
      } catch (error) {
        console.log('Failed to fetch user avatar, using generated avatar')
      }
    }

    try {
      // 使用 Supabase 插入评论
      const { data, error } = await supabase
        .from('comments')
        .insert({
          post_slug: validatedData.post_slug,
          author_name: validatedData.author_name,
          author_email: validatedData.author_email,
          author_website: validatedData.author_website || null,
          content: validatedData.content,
          avatar_url: avatarUrl,
          parent_id: validatedData.parent_id || null,
          user_id: validatedData.user_id || null,
          is_anonymous: validatedData.is_anonymous ?? true,
          is_approved: !isSpamComment,
        })
        .select()
        .single()

      if (error) {
        throw error
      }

      const comment = rowToComment(data as CommentRow)

      return NextResponse.json({
        success: true,
        comment,
        message: isSpamComment ? '评论已提交，正在审核中' : '评论发表成功',
      })
    } catch (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.json({ error: '评论提交失败，请稍后重试' }, { status: 500 })
    }
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }

    console.error('API error:', error)
    return NextResponse.json({ error: '服务器错误，请稍后重试' }, { status: 500 })
  }
}
