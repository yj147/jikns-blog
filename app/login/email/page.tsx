/**
 * 邮箱密码登录页面
 * 支持邮箱/密码登录和注册功能
 */

import { Suspense } from "react"
import { EmailAuthForm } from "@/components/auth/email-auth-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { LoginButton } from "@/components/auth/login-button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function EmailLoginPage({ searchParams }: PageProps) {
  const params = await searchParams
  const redirect = typeof params.redirect === "string" ? params.redirect : "/"

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-gray-900">
      <div className="w-full max-w-md space-y-4">
        {/* 返回按钮 */}
        <Link
          href="/login"
          className="text-muted-foreground hover:text-foreground flex items-center text-sm transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回登录选项
        </Link>

        {/* 主登录卡片 */}
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">邮箱登录</CardTitle>
            <CardDescription>使用邮箱和密码登录您的账户</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* 邮箱登录表单 */}
            <Suspense fallback={<div>加载中...</div>}>
              <EmailAuthForm redirect={redirect} />
            </Suspense>

            {/* 分隔线 */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background text-muted-foreground px-2">或者</span>
              </div>
            </div>

            {/* GitHub 登录选项 */}
            <LoginButton showEmailOption={false} size="sm" redirect={redirect} />
          </CardContent>
        </Card>

        {/* 注册提示 */}
        <p className="text-muted-foreground text-center text-sm">
          还没有账户？{" "}
          <Link
            href={`/register${redirect !== "/" ? `?redirect=${encodeURIComponent(redirect)}` : ""}`}
            className="text-primary font-medium hover:underline"
          >
            立即注册
          </Link>
        </p>
      </div>
    </div>
  )
}

export const metadata = {
  title: "邮箱登录",
  description: "使用邮箱和密码登录您的账户",
}
