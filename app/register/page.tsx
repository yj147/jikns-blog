/**
 * 用户注册页面
 * 使用 EmailAuthForm 组件，默认为注册模式
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

export default async function RegisterPage({ searchParams }: PageProps) {
  const params = await searchParams
  const redirect = typeof params.redirect === "string" ? params.redirect : "/"

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-gray-900">
      <div className="w-full max-w-md space-y-4">
        {/* 返回按钮 */}
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground flex items-center text-sm transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回首页
        </Link>

        {/* 主注册卡片 */}
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">创建账户</CardTitle>
            <CardDescription>加入我们的社区，开始你的创作之旅</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* 注册表单 */}
            <Suspense fallback={<div>加载中...</div>}>
              <EmailAuthForm redirect={redirect} mode="register" />
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

            {/* GitHub 注册选项 */}
            <LoginButton showEmailOption={false} size="sm" redirect={redirect} />
          </CardContent>
        </Card>

        {/* 登录提示 */}
        <p className="text-muted-foreground text-center text-sm">
          已有账户？{" "}
          <Link
            href={`/login${redirect !== "/" ? `?redirect=${encodeURIComponent(redirect)}` : ""}`}
            className="text-primary font-medium hover:underline"
          >
            立即登录
          </Link>
        </p>
      </div>
    </div>
  )
}

export const metadata = {
  title: "创建账户",
  description: "注册新账户，加入我们的社区",
}
