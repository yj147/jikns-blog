/**
 * 全局认证状态管理 Provider
 * 管理客户端的认证状态和会话变化监听
 */

"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import type { User as SupabaseUser, Session } from "@supabase/supabase-js"
import type { User as DatabaseUser } from "@/lib/generated/prisma"

interface AuthContextType {
  user: DatabaseUser | null
  session: Session | null
  loading: boolean
  isLoading: boolean
  isAdmin: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<DatabaseUser | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const supabase = createClient()

  const isAdmin = user?.role === "ADMIN" && user?.status === "ACTIVE"

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
        return data
      } else {
        // API 返回错误状态，但不是网络错误
        console.warn("用户未认证或API返回错误:", response.status)
        return null
      }
    } catch (error) {
      console.error("获取用户资料失败:", error)
      return null
    }
  }

  useEffect(() => {
    // 获取初始会话状态
    const getInitialSession = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()

        if (error) {
          console.error("获取初始会话失败:", error)
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
        console.error("初始会话查询异常:", error)
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    // 监听认证状态变化
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session)
      if (session?.user) {
        const dbUser = await fetchUserProfile(session.user)
        setUser(dbUser)
      } else {
        setUser(null)
      }
      setLoading(false)

      // 根据认证状态变化刷新路由
      if (event === "SIGNED_IN") {
        router.refresh()
      } else if (event === "SIGNED_OUT") {
        router.refresh()
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase.auth, router])

  const signOut = async () => {
    try {
      setLoading(true)
      const { error } = await supabase.auth.signOut()

      if (error) {
        console.error("登出错误:", error)
        throw error
      }

      // 登出成功后重定向到首页
      router.push("/")
      router.refresh()
    } catch (error) {
      console.error("登出异常:", error)
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
    signOut,
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
