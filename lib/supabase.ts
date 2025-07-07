import { createClient } from '@supabase/supabase-js'
import type { Session } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// 创建 Supabase 客户端
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 数据库表结构类型定义
export interface Comment {
  id: string
  post_slug: string
  author_name: string
  author_email: string
  author_website?: string | null
  content: string
  avatar_url?: string | null
  parent_id?: string | null
  user_id?: string | null // 新增：关联登录用户
  is_anonymous: boolean // 新增：是否匿名评论
  is_approved: boolean
  created_at: string
  updated_at: string
}

export interface CommentWithReplies extends Comment {
  replies?: CommentWithReplies[]
  user?: User | null // 新增：用户信息
}

// 用户类型定义
export interface User {
  id: string
  email?: string
  username?: string
  display_name?: string
  avatar_url?: string
  bio?: string
  website?: string
  preferences?: Record<string, unknown>
  is_active?: boolean
  last_login_at?: string
  created_at?: string
  updated_at?: string
}

// 评论表单数据类型
export interface CommentFormData {
  author_name: string
  author_email: string
  author_website?: string
  content: string
  parent_id?: string
  user_id?: string // 新增：用户ID（如果已登录）
  is_anonymous?: boolean // 新增：是否匿名
}

// Supabase 查询结果类型（与数据库字段完全匹配）
export interface CommentRow {
  id: string
  post_slug: string
  author_name: string
  author_email: string
  author_website: string | null
  content: string
  avatar_url: string | null
  parent_id: string | null
  user_id: string | null
  is_anonymous: boolean
  is_approved: boolean
  created_at: string
  updated_at: string
}

// 转换数据库行为 Comment 对象
export function rowToComment(row: CommentRow): Comment {
  return {
    ...row,
    author_website: row.author_website || undefined,
    avatar_url: row.avatar_url || undefined,
    parent_id: row.parent_id || undefined,
    user_id: row.user_id || undefined,
  }
}

// 生成头像 URL（使用 Gravatar）
export function generateAvatarUrl(email: string): string {
  const hash = crypto.createHash('md5').update(email.toLowerCase().trim()).digest('hex')
  return `https://www.gravatar.com/avatar/${hash}?d=identicon&s=80`
}

// 检查用户是否已登录
export async function getCurrentUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  return { user, error }
}

// 用户认证相关函数
export const auth = {
  // 用户注册
  signUp: async (email: string, password: string, metadata?: object) => {
    return await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    })
  },

  // 用户登录
  signIn: async (email: string, password: string) => {
    return await supabase.auth.signInWithPassword({
      email,
      password,
    })
  },

  // OAuth 登录
  signInWithOAuth: async (provider: 'github' | 'google' | 'discord' | 'qq') => {
    if (provider === 'qq') {
      // QQ登录使用自定义流程
      const qqAppId = process.env.NEXT_PUBLIC_QQ_APP_ID
      if (!qqAppId) {
        return { error: { message: 'QQ登录配置错误：缺少App ID' } }
      }

      const redirectUri = encodeURIComponent(`${window.location.origin}/auth/qq/callback`)
      const state = Math.random().toString(36).substring(2, 15)

      // 保存state到sessionStorage用于验证
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('qq_oauth_state', state)
      }

      const qqAuthUrl = `https://graph.qq.com/oauth2.0/authorize?response_type=code&client_id=${qqAppId}&redirect_uri=${redirectUri}&scope=get_user_info&state=${state}`

      // 跳转到QQ授权页面
      if (typeof window !== 'undefined') {
        window.location.href = qqAuthUrl
      }

      return { error: null }
    }

    return await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  },

  // 用户登出
  signOut: async () => {
    return await supabase.auth.signOut()
  },

  // 获取当前用户
  getUser: async () => {
    return await supabase.auth.getUser()
  },

  // 监听认证状态变化
  onAuthStateChange: (callback: (event: string, session: Session | null) => void) => {
    return supabase.auth.onAuthStateChange(callback)
  },
}
