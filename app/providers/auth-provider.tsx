/**
 * 全局认证状态管理 Provider
 * 管理客户端的认证状态和会话变化监听
 */

"use client"

import { createContext, useContext, useEffect, useRef, useState } from "react"
import { logger } from "@/lib/utils/logger"
import { useRouter } from "next/navigation"
import type { Session, SupabaseClient } from "@supabase/supabase-js"
import type { User as DatabaseUser } from "@/lib/generated/prisma"

const AUTH_SESSION_SYNC_COOKIE = "auth_session_sync"
const USER_PROFILE_CACHE_TTL_MS = 60_000

function isSupabaseSessionCookieName(name?: string): boolean {
  if (!name || !name.startsWith("sb-")) return false
  return (
    name.endsWith("-auth-token") ||
    name.endsWith("-auth-token.0") ||
    name.endsWith("-auth-token.1") ||
    name.endsWith("-refresh-token")
  )
}

function hasSupabaseSessionCookieClient(): boolean {
  if (typeof document === "undefined") return false

  const cookieHeader = document.cookie ?? ""
  if (!cookieHeader) return false

  return cookieHeader.split(";").some((pair) => {
    const [rawName, rawValue] = pair.trim().split("=")
    const name = rawName?.trim() ?? ""
    const value = rawValue?.trim() ?? ""
    if (!isSupabaseSessionCookieName(name)) return false
    return value.length > 0
  })
}

function consumeClientCookie(name: string): boolean {
  if (typeof document === "undefined") return false

  const cookies = document.cookie.split(";").map((cookie) => cookie.trim())
  const exists = cookies.some((cookie) => cookie.startsWith(`${name}=`))
  if (!exists) return false

  document.cookie = `${name}=; Max-Age=0; path=/`
  return true
}

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
  const userProfileRequestRef = useRef<Promise<DatabaseUser | null> | null>(null)
  const userProfileCacheRef = useRef<{ user: DatabaseUser | null; expiresAt: number } | null>(null)

  const debug = (message: string, payload?: Record<string, any>) => {
    if (typeof window === "undefined" || !(window as any).__AUTH_DEBUG__) return
    console.log(`[AuthProvider] ${message}`, payload)
  }

  useEffect(() => {
    let isMounted = true

    const initSupabase = async () => {
      const currentPath = typeof window !== "undefined" ? window.location.pathname : ""
      const protectedPaths = ["/profile", "/settings", "/admin", "/notifications"]
      const shouldInitSupabase =
        hasSupabaseSessionCookieClient() ||
        document.cookie.includes(`${AUTH_SESSION_SYNC_COOKIE}=`) ||
        protectedPaths.some((path) => currentPath.startsWith(path))

      if (!shouldInitSupabase) {
        if (isMounted) {
          setLoading(false)
        }
        return
      }

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
      await loadUserProfile(nextSession, { force: true })
    } catch (error) {
      logger.error("刷新用户资料失败", { module: "AuthProvider.refreshUser" }, error)
    }
  }

  // 从数据库获取用户完整信息
  const fetchUserProfile = async (): Promise<DatabaseUser | null> => {
    try {
      const response = await fetch("/api/user", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        const { user: data } = await response.json()
        if (data) {
          data.avatarUrl = data.avatarSignedUrl || data.avatarUrl || null
          data.coverImage = data.coverImageSignedUrl || data.coverImage || null
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

  const loadUserProfile = async (
    nextSession: Session | null,
    options?: { force?: boolean }
  ): Promise<DatabaseUser | null> => {
    if (!nextSession?.user) {
      userProfileRequestRef.current = null
      userProfileCacheRef.current = null
      setUser(null)
      return null
    }

    const force = options?.force === true
    if (!force) {
      const cached = userProfileCacheRef.current
      if (cached && cached.expiresAt > Date.now()) {
        setUser(cached.user)
        return cached.user
      }
    }

    if (!userProfileRequestRef.current) {
      userProfileRequestRef.current = fetchUserProfile().finally(() => {
        userProfileRequestRef.current = null
      })
    }

    const dbUser = await userProfileRequestRef.current
    userProfileCacheRef.current = {
      user: dbUser,
      expiresAt: Date.now() + USER_PROFILE_CACHE_TTL_MS,
    }
    setUser(dbUser)
    return dbUser
  }

  // 从服务端 Cookie 同步 Supabase 会话到客户端
  const syncSessionFromServer = async (client?: SupabaseClient): Promise<Session | null> => {
    const activeClient = client ?? supabase
    if (!activeClient) return null
    try {
      const response = await fetch("/api/auth/session", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      })

      if (!response.ok) {
        debug("syncSessionFromServer: response not ok", { status: response.status })
        return null
      }

      const data = await response.json()
      const serverSession = data?.session as Session | undefined
      if (!serverSession?.access_token || !serverSession?.refresh_token) {
        debug("syncSessionFromServer: missing tokens")
        return null
      }

      const { data: setResult, error: setError } = await activeClient.auth.setSession({
        access_token: serverSession.access_token,
        refresh_token: serverSession.refresh_token,
      })

      if (setError) {
        logger.error(
          "同步 Supabase 客户端会话失败",
          { module: "AuthProvider.syncSession" },
          setError
        )
        return null
      }

      const finalSession = setResult.session ?? serverSession
      debug("syncSessionFromServer: setSession success", {
        hasUser: Boolean(finalSession?.user),
        expires_at: finalSession?.expires_at,
      })

      if (typeof window !== "undefined") {
        ;(window as any).__AUTH_SESSION__ = finalSession
      }

      return finalSession
    } catch (error) {
      logger.error("同步客户端会话异常", { module: "AuthProvider.syncSession" }, error)
      debug("syncSessionFromServer: exception", { error })
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
        }

        let activeSession = session

        // 当 Supabase 客户端缺少本地会话（登录通过后端完成）时，尝试从服务端同步
        if (!activeSession) {
          const currentPath = window.location.pathname
          const protectedPaths = ["/profile", "/settings", "/admin", "/notifications"]
          const shouldSyncFromServer =
            consumeClientCookie(AUTH_SESSION_SYNC_COOKIE) ||
            protectedPaths.some((path) => currentPath.startsWith(path))

          if (shouldSyncFromServer) {
            debug("getInitialSession: local session empty, syncing from server", {
              currentPath,
            })
            activeSession = await syncSessionFromServer()
          } else {
            debug("getInitialSession: local session empty, skip server sync", { currentPath })
          }
        }

        setSession(activeSession)

        const dbUser = await loadUserProfile(activeSession)
        if (dbUser) {
          debug("getInitialSession: fetched user profile")
        } else {
          debug("getInitialSession: user profile null")
        }
      } catch (error) {
        logger.error("初始会话查询异常", { module: "AuthProvider.getInitialSession" }, error)
        debug("getInitialSession: exception", { error })
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
      if (event === "INITIAL_SESSION") return

      if (event === "SIGNED_OUT" || !nextSession?.user) {
        userProfileRequestRef.current = null
        userProfileCacheRef.current = null
        setUser(null)
        setLoading(false)

        if (event === "SIGNED_OUT") {
          const currentPath = window.location.pathname
          const protectedPaths = ["/profile", "/settings", "/admin"]

          if (protectedPaths.some((path) => currentPath.startsWith(path))) {
            router.push("/")
          }

          router.refresh()
        }

        return
      }

      debug("onAuthStateChange", { event })

      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        await loadUserProfile(nextSession, event === "USER_UPDATED" ? { force: true } : undefined)
      }

      setLoading(false)
    })
    subscription = data.subscription

    return () => {
      isMounted = false
      subscription?.unsubscribe()
    }
  }, [router, supabase])

  useEffect(() => {
    const handleServerLogin = async () => {
      setLoading(true)
      try {
        let activeSupabase = supabase
        if (!activeSupabase) {
          const { createClient } = await import("@/lib/supabase")
          activeSupabase = createClient()
          setSupabase(activeSupabase)
        }

        const nextSession =
          (await syncSessionFromServer(activeSupabase)) ??
          (await activeSupabase.auth.getSession()).data.session
        setSession(nextSession)
        await loadUserProfile(nextSession)
      } finally {
        setLoading(false)
      }
    }

    window.addEventListener("auth:server-login", handleServerLogin)
    return () => window.removeEventListener("auth:server-login", handleServerLogin)
  }, [supabase])

  const signOut = async () => {
    try {
      setLoading(true)
      // 先清理后端会话与 Cookie，再同步客户端状态
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
      if (supabase) {
        await supabase.auth.signOut()
      }

      // 登出成功后重定向到首页
      router.push("/")
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
