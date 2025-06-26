'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase, type User } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signUp: (email: string, password: string, metadata?: any) => Promise<{ error: any }>
  signOut: () => Promise<{ error: any }>
  signInWithOAuth: (provider: 'github' | 'google' | 'discord' | 'qq') => Promise<{ error: any }>
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
  const fetchOrCreateUser = async (authUser: any) => {
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
        console.log('Creating new user profile for:', authUser.email)

        // 调试：打印用户元数据
        console.log('GitHub user metadata:', authUser.user_metadata)
        console.log('Available avatar URLs:', {
          avatar_url: authUser.user_metadata?.avatar_url,
          picture: authUser.user_metadata?.picture,
          user_name: authUser.user_metadata?.user_name,
          preferred_username: authUser.user_metadata?.preferred_username,
        })

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
          console.log('User profile created successfully:', newUser)
          setUser(newUser)
        } else {
          console.error('Error creating user profile:', createError)
        }
      } else {
        console.error('Error fetching user data:', userError)
      }
    } catch (error) {
      console.error('Error in fetchOrCreateUser:', error)
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
        console.error('Error getting session:', error)
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
      console.log('Auth state changed:', event, session)

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

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error }
  }

  const signUp = async (email: string, password: string, metadata?: any) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    })
    return { error }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    return { error }
  }

  const signInWithOAuth = async (provider: 'github' | 'google' | 'discord' | 'qq') => {
    if (provider === 'qq') {
      // QQ登录使用自定义流程
      return await signInWithQQ()
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    return { error }
  }

  const signInWithQQ = async () => {
    try {
      // 构建QQ OAuth授权URL
      const qqAppId = process.env.NEXT_PUBLIC_QQ_APP_ID
      if (!qqAppId) {
        return { error: { message: 'QQ登录配置错误：缺少App ID' } }
      }

      const redirectUri = encodeURIComponent(`${window.location.origin}/auth/qq/callback`)
      const state = Math.random().toString(36).substring(2, 15)

      // 保存state到sessionStorage用于验证
      sessionStorage.setItem('qq_oauth_state', state)

      const qqAuthUrl = `https://graph.qq.com/oauth2.0/authorize?response_type=code&client_id=${qqAppId}&redirect_uri=${redirectUri}&scope=get_user_info&state=${state}`

      // 跳转到QQ授权页面
      window.location.href = qqAuthUrl

      return { error: null }
    } catch (error) {
      console.error('QQ OAuth error:', error)
      return { error: { message: 'QQ登录初始化失败' } }
    }
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
