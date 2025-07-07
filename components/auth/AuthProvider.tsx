'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase, type User } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'
import { AuthError } from '@supabase/supabase-js'

// 定义认证响应类型
interface AuthResult {
  data: {
    user: User | null
    session: Session | null
  }
  error: AuthError | { message: string } | null
}

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<AuthResult>
  signUp: (email: string, password: string, metadata?: object) => Promise<AuthResult>
  signOut: () => Promise<AuthResult>
  signInWithOAuth: (provider: 'github' | 'google' | 'discord' | 'qq') => Promise<AuthResult>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  // 获取或创建用户资料的统一函数
  const fetchOrCreateUser = async (authUser: import('@supabase/supabase-js').User) => {
    try {
      // 首先尝试获取现有用户数据
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (!userError && userData) {
        setUser(userData)
        return
      }

      // 如果用户不存在，创建新用户资料
      if (userError && userError.code === 'PGRST116') {
        const newUserData = {
          id: authUser.id,
          email: authUser.email,
          display_name:
            authUser.user_metadata?.full_name ||
            authUser.user_metadata?.display_name ||
            authUser.user_metadata?.name ||
            authUser.user_metadata?.preferred_username ||
            authUser.user_metadata?.user_name ||
            authUser.email?.split('@')[0],
          avatar_url: authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture,
          last_login_at: new Date().toISOString(),
        }

        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert(newUserData)
          .select()
          .single()

        if (!createError && newUser) {
          setUser(newUser)
        }
      } else if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching user data:', userError)
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error in fetchOrCreateUser:', error)
      }
    }
  }

  useEffect(() => {
    // 获取初始会话
    const getInitialSession = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession()

      if (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error getting session:', error)
        }
      } else {
        setSession(session)
        if (session?.user) {
          // 获取用户详细信息
          await fetchOrCreateUser(session.user)
        }
      }

      setLoading(false)
    }

    getInitialSession()

    // 监听认证状态变化
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session)

      if (session?.user) {
        // 获取或创建用户资料
        await fetchOrCreateUser(session.user)
      } else {
        setUser(null)
      }

      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string): Promise<AuthResult> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { data: { user: data.user as User | null, session: data.session }, error }
  }

  const signUp = async (
    email: string,
    password: string,
    metadata?: object
  ): Promise<AuthResult> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    })
    return { data: { user: data.user as User | null, session: data.session }, error }
  }

  const signOut = async (): Promise<AuthResult> => {
    const { error } = await supabase.auth.signOut()
    return { data: { user: null, session: null }, error }
  }

  const signInWithOAuth = async (
    provider: 'github' | 'google' | 'discord' | 'qq'
  ): Promise<AuthResult> => {
    if (provider === 'qq') {
      // QQ登录使用自定义流程
      const qqAppId = process.env.NEXT_PUBLIC_QQ_APP_ID
      if (!qqAppId) {
        return {
          data: { user: null, session: null },
          error: { message: 'QQ登录配置错误：缺少App ID' },
        }
      }

      const redirectUri = encodeURIComponent(`${window.location.origin}/auth/qq/callback`)
      const state = Math.random().toString(36).substring(2, 15)

      // 保存state到sessionStorage用于验证
      sessionStorage.setItem('qq_oauth_state', state)

      const qqAuthUrl = `https://graph.qq.com/oauth2.0/authorize?response_type=code&client_id=${qqAppId}&redirect_uri=${redirectUri}&scope=get_user_info&state=${state}`

      // 跳转到QQ授权页面
      window.location.href = qqAuthUrl

      return { data: { user: null, session: null }, error: null }
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    return { data: { user: null, session: null }, error }
  }

  const value: AuthContextType = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    signInWithOAuth,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
