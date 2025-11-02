/**
 * 受保护路由组件
 * 用于包装需要认证的页面内容
 */

"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/app/providers/auth-provider"

interface ProtectedRouteProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  redirectTo?: string
  showLoading?: boolean
}

export function ProtectedRoute({
  children,
  fallback,
  redirectTo = "/login",
  showLoading = true,
}: ProtectedRouteProps) {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  React.useEffect(() => {
    if (!isLoading && !user && redirectTo) {
      // 获取当前路径用于登录后重定向
      const currentPath = window.location.pathname + window.location.search
      const loginUrl = `${redirectTo}?redirect=${encodeURIComponent(currentPath)}`
      router.replace(loginUrl)
    }
  }, [user, isLoading, redirectTo, router])

  // 显示加载状态
  if (isLoading && showLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center" data-testid="loading">
        <div className="flex flex-col items-center space-y-4">
          <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
          <p className="text-muted-foreground">验证身份中...</p>
        </div>
      </div>
    )
  }

  // 未认证用户处理
  if (!user) {
    if (fallback) {
      return <>{fallback}</>
    }

    return (
      <div
        className="flex min-h-[300px] flex-col items-center justify-center space-y-4"
        data-testid="unauthorized"
      >
        <div className="text-center">
          <h2 className="text-foreground mb-2 text-2xl font-semibold">需要登录</h2>
          <p className="text-muted-foreground mb-4">此页面需要登录后才能访问</p>
          <button
            onClick={() => router.push(redirectTo)}
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 transition-colors"
          >
            前往登录
          </button>
        </div>
      </div>
    )
  }

  // 被封禁用户处理
  if (user.status === "BANNED") {
    return (
      <div
        className="flex min-h-[300px] flex-col items-center justify-center space-y-4"
        data-testid="banned"
      >
        <div className="text-center">
          <h2 className="text-destructive mb-2 text-2xl font-semibold">账户已被封禁</h2>
          <p className="text-muted-foreground">您的账户已被管理员封禁，无法访问此页面</p>
        </div>
      </div>
    )
  }

  // 认证通过，渲染子组件
  return <>{children}</>
}
