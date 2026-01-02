/**
 * 未授权访问页面
 * 用户友好的权限错误处理页面
 */

"use client"

import React, { Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

// 内部组件处理搜索参数
function UnauthorizedPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // 获取错误原因和重定向路径
  const reason = searchParams.get("reason") || "unknown"
  const redirectPath = searchParams.get("redirect") || "/"

  // 根据错误原因获取相应的配置
  const getErrorConfig = (reason: string) => {
    switch (reason) {
      case "authentication_required":
        return {
          icon: (
            <svg
              className="text-status-info h-16 w-16"
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
          ),
          title: "需要登录",
          description: "此页面需要登录后才能访问。请先登录您的账户。",
          actions: (
            <>
              <Button asChild className="w-full sm:w-auto">
                <Link href={`/login?redirect=${encodeURIComponent(redirectPath)}`} prefetch={false}>
                  立即登录
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link href="/register" prefetch={false}>
                  注册新账户
                </Link>
              </Button>
            </>
          ),
        }

      case "insufficient_permissions":
        return {
          icon: (
            <svg
              className="text-status-warning h-16 w-16"
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
          ),
          title: "权限不足",
          description: "您没有足够的权限访问此页面。此功能仅限管理员使用。",
          actions: (
            <>
              <Button onClick={() => router.back()} className="w-full sm:w-auto">
                返回上页
              </Button>
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link href="/">返回首页</Link>
              </Button>
            </>
          ),
        }

      case "account_banned":
        return {
          icon: (
            <svg
              className="text-status-error h-16 w-16"
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
          ),
          title: "账户已被封禁",
          description: "您的账户已被管理员封禁，无法访问此页面。如有疑问，请联系网站管理员。",
          actions: (
            <>
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link href="/">返回首页</Link>
              </Button>
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link href="/blog">浏览博客</Link>
              </Button>
            </>
          ),
        }

      case "service_unavailable":
        return {
          icon: (
            <svg
              className="text-muted-foreground h-16 w-16"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          ),
          title: "服务暂时不可用",
          description: "系统正在维护中，请稍后再试。如果问题持续，请联系技术支持。",
          actions: (
            <>
              <Button onClick={() => window.location.reload()} className="w-full sm:w-auto">
                重新加载
              </Button>
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link href="/">返回首页</Link>
              </Button>
            </>
          ),
        }

      default:
        return {
          icon: (
            <svg
              className="text-muted-foreground h-16 w-16"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          ),
          title: "访问被拒绝",
          description: "抱歉，您无法访问此页面。请检查您的权限或联系管理员。",
          actions: (
            <>
              <Button onClick={() => router.back()} className="w-full sm:w-auto">
                返回上页
              </Button>
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link href="/">返回首页</Link>
              </Button>
            </>
          ),
        }
    }
  }

  const errorConfig = getErrorConfig(reason)

  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="pb-4 text-center">
          <div className="mb-4 flex justify-center">{errorConfig.icon}</div>
          <h1 className="text-foreground text-2xl font-bold">{errorConfig.title}</h1>
        </CardHeader>

        <CardContent className="space-y-6 text-center">
          <p className="text-muted-foreground leading-relaxed">{errorConfig.description}</p>

          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            {errorConfig.actions}
          </div>

          {/* 额外信息区域 */}
          <div className="border-border border-t pt-4">
            <p className="text-muted-foreground text-xs">错误代码: {reason.toUpperCase()}</p>
            {redirectPath !== "/" && (
              <p className="text-muted-foreground mt-1 text-xs">原始路径: {redirectPath}</p>
            )}
          </div>

          {/* 帮助链接 */}
          <div className="text-center">
            <Link href="/blog" className="text-primary text-sm hover:underline">
              或者浏览我们的博客内容
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// 加载状态组件
function UnauthorizedPageLoading() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="pb-4 text-center">
          <div className="mb-4 flex justify-center">
            <div className="border-t-primary h-16 w-16 animate-spin rounded-full border-4 border-gray-200" />
          </div>
          <h1 className="text-foreground text-2xl font-bold">加载中...</h1>
        </CardHeader>

        <CardContent className="space-y-6 text-center">
          <p className="text-muted-foreground leading-relaxed">正在验证权限，请稍候...</p>
        </CardContent>
      </Card>
    </div>
  )
}

// 主组件：使用 Suspense 包装
export default function UnauthorizedPage() {
  return (
    <Suspense fallback={<UnauthorizedPageLoading />}>
      <UnauthorizedPageContent />
    </Suspense>
  )
}

// 注意：由于使用了 'use client'，元数据需要通过其他方式设置
// 可以在 layout.tsx 中动态设置或使用 next/head
