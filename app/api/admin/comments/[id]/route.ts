import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { z } from 'zod'

// 更新评论状态的验证模式
const updateSchema = z.object({
  is_approved: z.boolean(),
})

// PATCH - 更新评论状态
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: commentId } = await params
    const body = await request.json()

    // 验证输入数据
    const validatedData = updateSchema.parse(body)

    // 更新评论状态
    const { error } = await supabase
      .from('comments')
      .update({ is_approved: validatedData.is_approved })
      .eq('id', commentId)

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      message: '评论状态更新成功',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }

    console.error('Database error:', error)
    return NextResponse.json({ error: '更新失败，请稍后重试' }, { status: 500 })
  }
}

// DELETE - 删除评论
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: commentId } = await params

    // 删除评论（会级联删除子评论）
    const { error } = await supabase.from('comments').delete().eq('id', commentId)

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      message: '评论删除成功',
    })
  } catch (error) {
    console.error('Database error:', error)
    return NextResponse.json({ error: '删除失败，请稍后重试' }, { status: 500 })
  }
}
