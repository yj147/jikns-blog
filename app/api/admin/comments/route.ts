import { NextRequest, NextResponse } from 'next/server'
import { supabase, type CommentRow, rowToComment } from '@/lib/supabase'

// GET - 获取所有评论（管理员）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter') || 'all'

    let query = supabase.from('comments').select('*')

    if (filter === 'pending') {
      query = query.eq('is_approved', false)
    } else if (filter === 'approved') {
      query = query.eq('is_approved', true)
    }

    const { data: commentsData, error } = await query.order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    const comments = (commentsData || []).map((row) => rowToComment(row as CommentRow))

    return NextResponse.json({
      success: true,
      comments,
    })
  } catch (error) {
    console.error('Database error:', error)
    return NextResponse.json({ error: '获取评论失败' }, { status: 500 })
  }
}
