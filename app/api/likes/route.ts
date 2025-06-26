import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { z } from 'zod'

// 点赞请求验证模式
const likeSchema = z.object({
  post_slug: z.string().min(1, '文章标识不能为空'),
  user_id: z.string().uuid().optional(),
})

// 获取客户端IP地址
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const remoteAddr = request.headers.get('remote-addr')

  let ip = '127.0.0.1' // 默认IP

  if (forwarded) {
    ip = forwarded.split(',')[0].trim()
  } else if (realIP) {
    ip = realIP
  } else if (remoteAddr) {
    ip = remoteAddr
  }

  // 验证IP格式
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/

  if (!ipv4Regex.test(ip) && !ipv6Regex.test(ip)) {
    ip = '127.0.0.1' // 如果IP格式无效，使用默认值
  }

  return ip
}

// POST - 点赞/取消点赞
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 验证输入数据
    const validatedData = likeSchema.parse(body)
    const userIP = getClientIP(request)

    try {
      // 检查是否已经点赞
      let existingLike
      if (validatedData.user_id) {
        // 已登录用户：基于用户ID检查
        const { data, error } = await supabase
          .from('likes')
          .select('id')
          .eq('post_slug', validatedData.post_slug)
          .eq('user_id', validatedData.user_id)
          .single()

        if (error && error.code !== 'PGRST116') {
          // PGRST116 = no rows returned
          throw error
        }
        existingLike = data
      } else {
        // 匿名用户：基于IP检查
        const { data, error } = await supabase
          .from('likes')
          .select('id')
          .eq('post_slug', validatedData.post_slug)
          .eq('user_ip', userIP)
          .is('user_id', null)
          .single()

        if (error && error.code !== 'PGRST116') {
          throw error
        }
        existingLike = data
      }

      if (existingLike) {
        // 已经点赞，执行取消点赞
        const { error: deleteError } = await supabase
          .from('likes')
          .delete()
          .eq('id', existingLike.id)

        if (deleteError) {
          throw deleteError
        }

        // 获取更新后的点赞数
        const { count } = await supabase
          .from('likes')
          .select('*', { count: 'exact', head: true })
          .eq('post_slug', validatedData.post_slug)

        return NextResponse.json({
          success: true,
          liked: false,
          count: count || 0,
          message: '取消点赞成功',
        })
      } else {
        // 未点赞，执行点赞
        const { error: insertError } = await supabase.from('likes').insert({
          post_slug: validatedData.post_slug,
          user_ip: validatedData.user_id ? null : userIP,
          user_id: validatedData.user_id || null,
        })

        if (insertError) {
          throw insertError
        }

        // 获取更新后的点赞数
        const { count } = await supabase
          .from('likes')
          .select('*', { count: 'exact', head: true })
          .eq('post_slug', validatedData.post_slug)

        return NextResponse.json({
          success: true,
          liked: true,
          count: count || 0,
          message: '点赞成功',
        })
      }
    } catch (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.json({ error: '操作失败，请稍后重试' }, { status: 500 })
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }

    console.error('Unexpected error:', error)
    return NextResponse.json({ error: '服务器错误，请稍后重试' }, { status: 500 })
  }
}
