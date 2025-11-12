/**
 * 客户端认证状态监听组件
 * 监听 Supabase Auth 状态变化，在登录/登出时刷新页面
 */

"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/app/providers/auth-provider"

export function AuthStateListener() {
  const router = useRouter()
  const { supabase } = useAuth()

  useEffect(() => {
    if (!supabase) return

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        router.refresh()
      }

      if (event === "SIGNED_OUT") {
        const currentPath = window.location.pathname
        const protectedPaths = ["/profile", "/settings", "/admin"]

        if (protectedPaths.some((path) => currentPath.startsWith(path))) {
          router.push("/")
        }
      }
    })

    return () => {
      data.subscription.unsubscribe()
    }
  }, [router, supabase])

  return null
}

export default AuthStateListener
