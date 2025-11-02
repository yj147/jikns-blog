/**
 * 客户端认证状态监听组件
 * 监听 Supabase Auth 状态变化，在登录/登出时刷新页面
 */

"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClientSupabaseClient } from "@/lib/supabase"

export function AuthStateListener() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClientSupabaseClient()

    // 监听认证状态变化
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // 在登录或登出时刷新页面，确保服务端组件获取最新状态
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        // 使用 router.refresh() 而不是 window.location.reload()
        // 这样可以保持页面状态，只刷新服务端数据
        router.refresh()
      }

      // 特殊处理：如果用户登出且当前在受保护页面，重定向到首页
      if (event === "SIGNED_OUT") {
        const currentPath = window.location.pathname
        const protectedPaths = ["/profile", "/settings", "/admin"]

        if (protectedPaths.some((path) => currentPath.startsWith(path))) {
          router.push("/")
        }
      }
    })

    // 清理监听器
    return () => {
      subscription.unsubscribe()
    }
  }, [router])

  // 这是一个纯逻辑组件，不渲染任何内容
  return null
}

export default AuthStateListener
