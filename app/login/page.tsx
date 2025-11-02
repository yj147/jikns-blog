/**
 * 主登录页面
 * 提供 GitHub OAuth 和邮箱登录选项
 */

import { getAuthenticatedUser } from "@/lib/auth"
import { AuthForm, InlineAuthStatus } from "@/components/auth/auth-form"
import { PenTool } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Suspense } from "react"

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function LoginPage({ searchParams }: PageProps) {
  // 解析搜索参数
  const params = await searchParams
  const redirectPath = typeof params.redirect === "string" ? params.redirect : "/"
  const error = typeof params.error === "string" ? params.error : null

  // 检查用户是否已登录，如果已登录则重定向
  const { user } = await getAuthenticatedUser()
  if (user) {
    redirect(redirectPath)
  }

  // 获取错误信息的用户友好显示
  const getErrorMessage = (errorCode: string) => {
    const messages: Record<string, string> = {
      auth_failed: "认证失败，请重试",
      exchange_failed: "授权验证失败",
      callback_failed: "登录回调处理失败",
      missing_code: "认证信息缺失",
      access_denied: "您取消了授权",
    }
    return messages[errorCode] || "登录过程中发生错误"
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-gray-900">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center">
          <Link
            href="/"
            className="inline-flex items-center space-x-2 transition-opacity hover:opacity-80"
          >
            <div className="bg-primary text-primary-foreground flex h-12 w-12 items-center justify-center rounded-lg">
              <PenTool className="h-6 w-6" />
            </div>
            <span className="text-foreground text-2xl font-bold">现代博客</span>
          </Link>
        </div>

        {/* 错误消息显示 */}
        {error && (
          <div className="mb-4 w-full max-w-md rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            {getErrorMessage(error)}
          </div>
        )}

        {/* 主登录表单 */}
        <Suspense
          fallback={<div className="bg-muted h-64 w-full max-w-md animate-pulse rounded-lg" />}
        >
          <AuthForm
            title="欢迎回来"
            description="选择您偏好的登录方式继续使用"
            redirect={redirectPath}
            showEmailOption={true}
            showTitle={true}
          />
        </Suspense>

        {/* OAuth 状态显示 */}
        <div className="w-full max-w-md">
          <InlineAuthStatus />
        </div>

        {/* 注册提示 */}
        <p className="text-muted-foreground text-center text-sm">
          还没有账户？{" "}
          <Link
            href={`/register${redirectPath !== "/" ? `?redirect=${encodeURIComponent(redirectPath)}` : ""}`}
            className="text-primary font-medium hover:underline"
          >
            立即注册
          </Link>
        </p>

        {/* 服务条款 */}
        <p className="text-muted-foreground text-center text-xs">
          登录即表示您同意我们的{" "}
          <Link href="/terms" className="hover:underline">
            服务条款
          </Link>{" "}
          和{" "}
          <Link href="/privacy" className="hover:underline">
            隐私政策
          </Link>
        </p>
      </div>
    </div>
  )
}

export const metadata = {
  title: "用户登录",
  description: "登录您的账户以继续使用现代博客",
}
