import { NextRequest, NextResponse } from 'next/server'
import {
  supabase,
  type Comment,
  type CommentWithReplies,
  type CommentRow,
  rowToComment,
} from '@/lib/supabase'

// 构建评论树结构
function buildCommentTree(comments: Comment[]): CommentWithReplies[] {
  const commentMap = new Map<string, CommentWithReplies>()
  const rootComments: CommentWithReplies[] = []

  // 首先创建所有评论的映射
  comments.forEach((comment) => {
    commentMap.set(comment.id, { ...comment, replies: [] })
  })

  // 然后构建树结构
  comments.forEach((comment) => {
    const commentWithReplies = commentMap.get(comment.id)!

    if (comment.parent_id) {
      // 这是一个回复
      const parent = commentMap.get(comment.parent_id)
      if (parent) {
        parent.replies!.push(commentWithReplies)
      }
    } else {
      // 这是一个顶级评论
      rootComments.push(commentWithReplies)
    }
  })

  // 按时间排序（最新的在前）
  rootComments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  // 对每个评论的回复也按时间排序（最早的在前）
  function sortReplies(comments: CommentWithReplies[]) {
    comments.forEach((comment) => {
      if (comment.replies && comment.replies.length > 0) {
        comment.replies.sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
        sortReplies(comment.replies)
      }
    })
  }

  sortReplies(rootComments)

  return rootComments
}

// GET - 获取指定文章的评论（支持分页）
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const { searchParams } = new URL(request.url)

    // 获取分页参数
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = (page - 1) * limit

    if (!slug) {
      return NextResponse.json({ error: '文章标识不能为空' }, { status: 400 })
    }

    try {
      // 首先获取总评论数
      const { count: totalCount, error: countError } = await supabase
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('post_slug', slug)
        .eq('is_approved', true)

      if (countError) {
        throw countError
      }

      // 获取所有评论以构建树结构（因为需要保持父子关系）
      const { data, error } = await supabase
        .from('comments')
        .select(
          `
          *,
          users (
            id,
            username,
            display_name,
            avatar_url,
            website
          )
        `
        )
        .eq('post_slug', slug)
        .eq('is_approved', true)
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      // 转换数据库行为 Comment 对象
      const comments: Comment[] = (data || []).map((row) => rowToComment(row as CommentRow))

      // 构建完整的评论树结构
      const fullCommentTree = buildCommentTree(comments)

      // 对顶级评论进行分页
      const paginatedComments = fullCommentTree.slice(offset, offset + limit)

      // 计算分页信息
      const totalPages = Math.ceil(fullCommentTree.length / limit)

      return NextResponse.json({
        success: true,
        comments: paginatedComments,
        pagination: {
          page,
          limit,
          total: totalCount || 0,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      })
    } catch (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.json({ error: '获取评论失败' }, { status: 500 })
    }
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: '服务器错误，请稍后重试' }, { status: 500 })
  }
}
