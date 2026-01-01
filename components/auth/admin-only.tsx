/**
 * 管理员专用组件
 * 用于包装需要管理员权限的内容和功能
 */

"use client"

import React from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/app/providers/auth-provider"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface AdminOnlyProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  redirectTo?: string
  showFallback?: boolean
  requireActive?: boolean
  message?: string
}

export function AdminOnly({
  children,
  fallback,
  redirectTo = "/unauthorized",
  showFallback = true,
  requireActive = true,
  message = "此功能仅限管理员使用",
}: AdminOnlyProps) {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  // 处理重定向逻辑
  React.useEffect(() => {
    if (
      !isLoading &&
      (!user || user.role !== "ADMIN" || (requireActive && user.status !== "ACTIVE"))
    ) {
      if (redirectTo) {
        let redirectUrl = redirectTo

        // 根据错误类型设置不同的重定向参数
        if (!user) {
          redirectUrl = `/unauthorized?reason=authentication_required&redirect=${encodeURIComponent(pathname)}`
        } else if (user.status === "BANNED") {
          redirectUrl = `/unauthorized?reason=account_banned&redirect=${encodeURIComponent(pathname)}`
        } else if (user.role !== "ADMIN") {
          redirectUrl = `/unauthorized?reason=insufficient_permissions&redirect=${encodeURIComponent(pathname)}`
        }

        router.replace(redirectUrl)
      }
    }
  }, [user, isLoading, redirectTo, router, pathname, requireActive])

  // 加载状态
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8" data-testid="admin-loading">
        <div className="flex flex-col items-center space-y-2">
          <div className="border-primary h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
          <p className="text-muted-foreground text-sm">验证管理员权限...</p>
        </div>
      </div>
    )
  }

  // 未认证用户
  if (!user) {
    if (fallback) {
      return <>{fallback}</>
    }

    if (!showFallback) {
      return null
    }

    return (
      <Card className="mx-auto max-w-md" data-testid="admin-auth-required">
        <CardContent className="flex flex-col items-center justify-center space-y-4 px-6 py-12">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/20">
            <svg
              className="h-6 w-6 text-orange-600 dark:text-orange-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>

          <div className="space-y-2 text-center">
            <h3 className="text-foreground text-lg font-semibold">需要管理员权限</h3>

            <p className="text-muted-foreground">{message}</p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row">
            <Button asChild className="flex-1">
              <Link href="/login" prefetch={false}>
                管理员登录
              </Link>
            </Button>

            <Button asChild variant="outline" className="flex-1">
              <Link href="/">返回首页</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // 被封禁用户
  if (user.status === "BANNED") {
    if (fallback) {
      return <>{fallback}</>
    }

    if (!showFallback) {
      return null
    }

    return (
      <Card className="mx-auto max-w-md" data-testid="admin-banned">
        <CardContent className="flex flex-col items-center justify-center space-y-4 px-6 py-12">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
            <svg
              className="h-6 w-6 text-red-600 dark:text-red-400"
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

          <div className="space-y-2 text-center">
            <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">账户已被封禁</h3>

            <p className="text-muted-foreground">
              管理员账户已被封禁，无法访问管理功能。请联系超级管理员。
            </p>
          </div>

          <Button asChild variant="outline" className="w-full">
            <Link href="/">返回首页</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  // 非管理员用户
  if (user.role !== "ADMIN") {
    if (fallback) {
      return <>{fallback}</>
    }

    if (!showFallback) {
      return null
    }

    return (
      <Card className="mx-auto max-w-md" data-testid="admin-insufficient-permissions">
        <CardContent className="flex flex-col items-center justify-center space-y-4 px-6 py-12">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/20">
            <svg
              className="h-6 w-6 text-amber-600 dark:text-amber-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>

          <div className="space-y-2 text-center">
            <h3 className="text-foreground text-lg font-semibold">权限不足</h3>

            <p className="text-muted-foreground">
              您当前是普通用户，无法访问管理员专用功能。如需管理员权限，请联系系统管理员。
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row">
            <Button asChild className="flex-1">
              <Link href="/profile">查看个人资料</Link>
            </Button>

            <Button asChild variant="outline" className="flex-1">
              <Link href="/">返回首页</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // 管理员权限验证通过，渲染子组件
  return <>{children}</>
}

/**
 * 管理员权限检查 Hook
 * 用于在组件内部快速检查管理员权限
 */
export function useAdminCheck() {
  const { user, isLoading } = useAuth()

  const isAdmin = React.useMemo(() => {
    return !isLoading && user && user.role === "ADMIN" && user.status === "ACTIVE"
  }, [user, isLoading])

  const hasAdminRole = React.useMemo(() => {
    return !isLoading && user && user.role === "ADMIN"
  }, [user, isLoading])

  const isActiveAdmin = React.useMemo(() => {
    return !isLoading && user && user.role === "ADMIN" && user.status === "ACTIVE"
  }, [user, isLoading])

  return {
    isAdmin,
    hasAdminRole,
    isActiveAdmin,
    isLoading,
    user,
  }
}
