/**
 * 认证必需组件
 * 包装需要用户登录才能使用的功能
 */

"use client"

import React from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/app/providers/auth-provider"

interface AuthRequiredProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  redirectTo?: string
  showFallback?: boolean
  message?: string
}

export function AuthRequired({
  children,
  fallback,
  redirectTo = "/login",
  showFallback = true,
  message = "此功能需要登录后使用",
}: AuthRequiredProps) {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  // 处理自动重定向
  React.useEffect(() => {
    if (!isLoading && !user && redirectTo) {
      const currentUrl = pathname + window.location.search
      const loginUrl = `${redirectTo}?redirect=${encodeURIComponent(currentUrl)}`
      router.replace(loginUrl)
    }
  }, [user, isLoading, redirectTo, router, pathname])

  // 加载状态
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8" data-testid="loading">
        <div className="flex flex-col items-center space-y-2">
          <div className="border-primary h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
          <p className="text-muted-foreground text-sm">正在验证身份...</p>
        </div>
      </div>
    )
  }

  // 未认证用户
  if (!user) {
    // 如果指定了自定义 fallback
    if (fallback) {
      return <>{fallback}</>
    }

    // 如果禁用了 fallback 显示
    if (!showFallback) {
      return null
    }

    // 默认的认证提示界面
    return (
      <div
        className="flex flex-col items-center justify-center space-y-4 px-6 py-12"
        data-testid="auth-required"
      >
        <div className="max-w-md text-center">
          <div className="bg-primary/10 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
            <svg
              className="text-primary h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>

          <h3 className="text-foreground mb-2 text-lg font-semibold">需要登录</h3>

          <p className="text-muted-foreground mb-4">{message}</p>

          <div className="flex flex-col justify-center gap-2 sm:flex-row">
            <button
              onClick={() => router.push(redirectTo)}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 transition-colors"
            >
              立即登录
            </button>

            <button
              onClick={() => router.push("/register")}
              className="border-border text-foreground hover:bg-accent rounded-md border px-4 py-2 transition-colors"
            >
              注册账号
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 被封禁用户
  if (user.status === "BANNED") {
    return (
      <div
        className="flex flex-col items-center justify-center px-6 py-12"
        data-testid="banned-user"
      >
        <div className="max-w-md text-center">
          <div className="bg-destructive/10 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
            <svg
              className="text-destructive h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728"
              />
            </svg>
          </div>

          <h3 className="text-destructive mb-2 text-lg font-semibold">账户已被封禁</h3>

          <p className="text-muted-foreground">
            您的账户已被管理员封禁，无法使用此功能。如有疑问，请联系管理员。
          </p>
        </div>
      </div>
    )
  }

  // 认证通过且账户活跃，渲染子组件
  return <>{children}</>
}
