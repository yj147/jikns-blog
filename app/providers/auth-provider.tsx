/**
 * 全局认证状态管理 Provider
 * 管理客户端的认证状态和会话变化监听
 */

"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { logger } from "@/lib/utils/logger"
import { useRouter } from "next/navigation"
import type { User as SupabaseUser, Session, SupabaseClient } from "@supabase/supabase-js"
import type { User as DatabaseUser } from "@/lib/generated/prisma"

interface AuthContextType {
  user: DatabaseUser | null
  session: Session | null
  loading: boolean
  isLoading: boolean
  isAdmin: boolean
  supabase: SupabaseClient | null
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<DatabaseUser | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null)
  const router = useRouter()

  useEffect(() => {
    let isMounted = true

    const initSupabase = async () => {
      try {
        const { createClient } = await import("@/lib/supabase")
        if (!isMounted) return
        setSupabase(createClient())
      } catch (error) {
        logger.error("Supabase 客户端初始化失败", { module: "AuthProvider.init" }, error)
        if (isMounted) {
          setSupabase(null)
          setLoading(false)
        }
      }
    }

    initSupabase()

    return () => {
      isMounted = false
    }
  }, [])

  const isAdmin = user?.role === "ADMIN" && user?.status === "ACTIVE"

  const refreshUser = async () => {
    if (!supabase) return

    try {
      const {
        data: { session: nextSession },
        error,
      } = await supabase.auth.getSession()

      if (error) {
        logger.error("刷新会话失败", { module: "AuthProvider.refreshUser" }, error)
        return
      }

      setSession(nextSession)

      if (nextSession?.user) {
        const dbUser = await fetchUserProfile(nextSession.user)
        setUser(dbUser)
      } else {
        setUser(null)
      }
    } catch (error) {
      logger.error("刷新用户资料失败", { module: "AuthProvider.refreshUser" }, error)
    }
  }

  // 从数据库获取用户完整信息
  const fetchUserProfile = async (supabaseUser: SupabaseUser): Promise<DatabaseUser | null> => {
    try {
      const response = await fetch("/api/user", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        const { user: data } = await response.json()
        if (data) {
          data.avatarUrl = data.avatarSignedUrl || data.avatarUrl || null
        }
        return data
      } else {
        logger.warn("用户未认证或 API 返回错误", {
          module: "AuthProvider.fetchUserProfile",
          status: response.status,
        })
        return null
      }
    } catch (error) {
      logger.error("获取用户资料失败", { module: "AuthProvider.fetchUserProfile" }, error)
      return null
    }
  }

  useEffect(() => {
    if (!supabase) return

    let isMounted = true
    let subscription: { unsubscribe: () => void } | null = null

    // 获取初始会话状态
    const getInitialSession = async () => {
      setLoading(true)
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()

        if (error) {
          logger.error("获取初始会话失败", { module: "AuthProvider.getInitialSession" }, error)
        } else {
          setSession(session)
          if (session?.user) {
            const dbUser = await fetchUserProfile(session.user)
            setUser(dbUser)
          } else {
            setUser(null)
          }
        }
      } catch (error) {
        logger.error("初始会话查询异常", { module: "AuthProvider.getInitialSession" }, error)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    getInitialSession()

    // 监听认证状态变化
    const { data } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (!isMounted) return

      setSession(nextSession)
      if (nextSession?.user) {
        const dbUser = await fetchUserProfile(nextSession.user)
        setUser(dbUser)
      } else {
        setUser(null)
      }
      setLoading(false)

      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        router.refresh()
      }
    })
    subscription = data.subscription

    return () => {
      isMounted = false
      subscription?.unsubscribe()
    }
  }, [router, supabase])

  const signOut = async () => {
    if (!supabase) return
    try {
      setLoading(true)
      const { error } = await supabase.auth.signOut()

      if (error) {
        logger.error("登出错误", { module: "AuthProvider.signOut" }, error)
        throw error
      }

      // 登出成功后重定向到首页
      router.push("/")
      router.refresh()
    } catch (error) {
      logger.error("登出异常", { module: "AuthProvider.signOut" }, error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const value = {
    user,
    session,
    loading,
    isLoading: loading, // 兼容现有组件
    isAdmin,
    supabase,
    signOut,
    refreshUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * 使用认证上下文的 Hook
 */
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

/**
 * 检查用户是否已认证的 Hook
 */
export const useRequireAuth = () => {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
    }
  }, [user, loading, router])

  return { user, loading }
}

/**
 * 检查用户是否为管理员的 Hook
 */
export const useRequireAdmin = () => {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login")
      } else if (user.role !== "ADMIN") {
        router.push("/unauthorized")
      }
    }
  }, [user, loading, router])

  return { user, loading, isAdmin: user?.role === "ADMIN" }
}
