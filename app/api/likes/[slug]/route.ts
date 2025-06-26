import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

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

// GET - 获取指定文章的点赞数据
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    const userIP = getClientIP(request)

    if (!slug) {
      return NextResponse.json({ error: '文章标识不能为空' }, { status: 400 })
    }

    try {
      // 获取总点赞数
      const { count: totalCount, error: countError } = await supabase
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('post_slug', slug)

      if (countError) {
        throw countError
      }

      // 检查当前用户是否已点赞
      let isLiked = false
      if (userId) {
        // 已登录用户：基于用户ID检查
        const { data, error } = await supabase
          .from('likes')
          .select('id')
          .eq('post_slug', slug)
          .eq('user_id', userId)
          .single()

        if (error && error.code !== 'PGRST116') {
          throw error
        }
        isLiked = !!data
      } else {
        // 匿名用户：基于IP检查
        const { data, error } = await supabase
          .from('likes')
          .select('id')
          .eq('post_slug', slug)
          .eq('user_ip', userIP)
          .is('user_id', null)
          .single()

        if (error && error.code !== 'PGRST116') {
          throw error
        }
        isLiked = !!data
      }

      return NextResponse.json({
        success: true,
        count: totalCount || 0,
        liked: isLiked,
      })
    } catch (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.json({ error: '获取点赞数据失败' }, { status: 500 })
    }
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: '服务器错误，请稍后重试' }, { status: 500 })
  }
}
