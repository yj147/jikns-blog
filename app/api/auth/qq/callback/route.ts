import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { z } from 'zod'

// QQ回调验证模式
const qqCallbackSchema = z.object({
  code: z.string().min(1, '授权码不能为空'),
})

// QQ用户信息接口
interface QQUserInfo {
  openid: string
  nickname: string
  figureurl_qq_1?: string
  figureurl_qq_2?: string
  gender?: string
}

// POST - 处理QQ OAuth回调
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code } = qqCallbackSchema.parse(body)

    // 获取环境变量
    const qqAppId = process.env.NEXT_PUBLIC_QQ_APP_ID
    const qqAppSecret = process.env.QQ_APP_SECRET
    const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}/auth/qq/callback`

    if (!qqAppId || !qqAppSecret) {
      return NextResponse.json({ error: 'QQ登录配置错误' }, { status: 500 })
    }

    // 第一步：使用授权码获取access_token
    const tokenUrl = `https://graph.qq.com/oauth2.0/token?grant_type=authorization_code&client_id=${qqAppId}&client_secret=${qqAppSecret}&code=${code}&redirect_uri=${encodeURIComponent(redirectUri)}`

    const tokenResponse = await fetch(tokenUrl)
    const tokenText = await tokenResponse.text()

    if (!tokenResponse.ok) {
      throw new Error('获取QQ access_token失败')
    }

    // 解析access_token（QQ返回的是URL参数格式）
    const tokenParams = new URLSearchParams(tokenText)
    const accessToken = tokenParams.get('access_token')

    if (!accessToken) {
      throw new Error('QQ access_token解析失败')
    }

    // 第二步：获取用户的openid
    const openidUrl = `https://graph.qq.com/oauth2.0/me?access_token=${accessToken}`
    const openidResponse = await fetch(openidUrl)
    const openidText = await openidResponse.text()

    if (!openidResponse.ok) {
      throw new Error('获取QQ openid失败')
    }

    // 解析openid（QQ返回的是JSONP格式）
    const openidMatch = openidText.match(/{"client_id":".*?","openid":"(.*?)"}/)
    const openid = openidMatch?.[1]

    if (!openid) {
      throw new Error('QQ openid解析失败')
    }

    // 第三步：获取用户信息
    const userInfoUrl = `https://graph.qq.com/user/get_user_info?access_token=${accessToken}&oauth_consumer_key=${qqAppId}&openid=${openid}`
    const userInfoResponse = await fetch(userInfoUrl)
    const userInfo: QQUserInfo = await userInfoResponse.json()

    if (!userInfoResponse.ok || !userInfo.nickname) {
      throw new Error('获取QQ用户信息失败')
    }

    // 第四步：在Supabase中创建或更新用户
    const email = `qq_${openid}@qq.oauth.local` // 为QQ用户生成虚拟邮箱
    const displayName = userInfo.nickname
    const avatarUrl = userInfo.figureurl_qq_2 || userInfo.figureurl_qq_1

    // 检查用户是否已存在（通过auth.users表查询）
    const { data: authUsers } = await supabase.auth.admin.listUsers()
    const existingAuthUser = authUsers?.users?.find((u: any) => u.email === email)

    let existingUser: any = null
    if (existingAuthUser) {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', existingAuthUser.id)
        .single()
      existingUser = data
    }

    let userId: string

    if (existingUser) {
      // 用户已存在，更新信息
      userId = existingUser.id
      await supabase
        .from('users')
        .update({
          display_name: displayName,
          avatar_url: avatarUrl,
          last_login_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
    } else {
      // 创建新用户
      // 首先在auth.users中创建用户
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          display_name: displayName,
          avatar_url: avatarUrl,
          provider: 'qq',
          qq_openid: openid,
        },
      })

      if (authError || !authUser.user) {
        throw new Error('创建Supabase用户失败: ' + authError?.message)
      }

      userId = authUser.user.id

      // 在public.users表中创建用户记录
      await supabase.from('users').insert({
        id: userId,
        email,
        display_name: displayName,
        avatar_url: avatarUrl,
        last_login_at: new Date().toISOString(),
      })
    }

    // 第五步：生成Supabase会话
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })

    if (sessionError || !sessionData.properties?.action_link) {
      throw new Error('生成登录链接失败')
    }

    return NextResponse.json({
      success: true,
      message: 'QQ登录成功',
      redirect_url: sessionData.properties.action_link,
    })
  } catch (error) {
    console.error('QQ OAuth callback error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'QQ登录处理失败',
        success: false,
      },
      { status: 500 }
    )
  }
}
