/**
 * GitHub OAuth 测试页面
 * 用于快速测试 OAuth 流程而不依赖复杂的业务逻辑
 */

"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase"
import { logger } from "@/lib/utils/logger"
import { Github, CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react"
import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"

// 内部组件处理搜索参数
function TestOAuthPageContent() {
  const [loading, setLoading] = useState(false)
  const [session, setSession] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [testStatus, setTestStatus] = useState<{
    supabase: "pending" | "success" | "error"
    env: "pending" | "success" | "error"
  }>({ supabase: "pending", env: "pending" })

  const searchParams = useSearchParams()
  const supabase = createClient()

  // 检查环境配置和 Supabase 连接
  useEffect(() => {
    async function checkConfiguration() {
      // 检查环境变量
      const hasEnv = !!(
        process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      )
      setTestStatus((prev) => ({ ...prev, env: hasEnv ? "success" : "error" }))

      try {
        // 检查 Supabase 连接
        const { data, error } = await supabase.auth.getSession()
        if (error) throw error

        setSession(data.session)
        setTestStatus((prev) => ({ ...prev, supabase: "success" }))
      } catch (err) {
        logger.error("Supabase 连接检查失败", { module: "TestOAuth.checkConfiguration" }, err)
        setTestStatus((prev) => ({ ...prev, supabase: "error" }))
      }
    }

    checkConfiguration()
  }, [supabase])

  // 检查 URL 参数中的错误信息
  useEffect(() => {
    const errorParam = searchParams.get("error")
    const messageParam = searchParams.get("message")

    if (errorParam) {
      const errorMessages: Record<string, string> = {
        missing_code: "OAuth 回调缺少授权码",
        auth_failed: "GitHub 认证失败",
        no_user: "未获取到用户信息",
        server_error: "服务器内部错误",
      }

      const errorMessage = errorMessages[errorParam] || "未知错误"
      const fullMessage = messageParam
        ? `${errorMessage}: ${decodeURIComponent(messageParam)}`
        : errorMessage
      setError(fullMessage)
    }
  }, [searchParams])

  const handleGithubLogin = async () => {
    setLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback?redirect_to=/test-oauth`,
        },
      })

      if (error) {
        throw new Error(error.message)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "登录失败"
      setError(errorMessage)
      logger.error("GitHub OAuth 错误", { module: "TestOAuth.handleGithubLogin" }, err)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error

      setSession(null)
      setError(null)
    } catch (err) {
      logger.error("测试 OAuth 登出错误", { module: "TestOAuth.handleLogout" }, err)
    }
  }

  const StatusIcon = ({ status }: { status: "pending" | "success" | "error" }) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-5 w-5 text-status-success" />
      case "error":
        return <XCircle className="h-5 w-5 text-status-error" />
      default:
        return <AlertCircle className="h-5 w-5 text-status-warning" />
    }
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* 页面标题 */}
        <div className="text-center">
          <h1 className="text-3xl font-bold">GitHub OAuth 测试</h1>
          <p className="text-muted-foreground mt-2">验证 OAuth 认证流程配置</p>
        </div>

        {/* 系统状态检查 */}
        <Card>
          <CardHeader>
            <CardTitle>系统状态检查</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span>环境变量配置</span>
              <StatusIcon status={testStatus.env} />
            </div>
            <div className="flex items-center justify-between">
              <span>Supabase 连接</span>
              <StatusIcon status={testStatus.supabase} />
            </div>
          </CardContent>
        </Card>

        {/* 认证状态 */}
        <Card>
          <CardHeader>
            <CardTitle>认证状态</CardTitle>
            <CardDescription>{session ? "您已成功登录" : "您当前未登录"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 错误信息 */}
            {error && (
              <div className="rounded-md border border-status-error/30 bg-status-error/10 p-3 text-sm text-status-error">
                <strong>错误：</strong> {error}
              </div>
            )}

            {/* 用户信息 */}
            {session ? (
              <div className="space-y-3">
                <div className="rounded-md border border-status-success/30 bg-status-success/10 p-4">
                  <h3 className="font-medium text-status-success">登录成功！</h3>
                  <div className="mt-2 text-sm text-status-success/80">
                    <p>
                      <strong>用户 ID:</strong> {session.user.id}
                    </p>
                    <p>
                      <strong>邮箱:</strong> {session.user.email}
                    </p>
                    <p>
                      <strong>提供商:</strong> {session.user.app_metadata?.provider}
                    </p>
                    {session.user.user_metadata?.full_name && (
                      <p>
                        <strong>姓名:</strong> {session.user.user_metadata.full_name}
                      </p>
                    )}
                  </div>
                </div>

                <Button onClick={handleLogout} variant="outline" className="w-full">
                  退出登录
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleGithubLogin}
                disabled={loading || testStatus.supabase !== "success"}
                className="w-full"
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Github className="mr-2 h-4 w-4" />
                )}
                {loading ? "正在跳转到 GitHub..." : "使用 GitHub 登录"}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* 配置信息 */}
        <Card>
          <CardHeader>
            <CardTitle>配置信息</CardTitle>
            <CardDescription>当前 OAuth 配置详情</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <strong>Supabase URL:</strong> {process.env.NEXT_PUBLIC_SUPABASE_URL || "未配置"}
            </div>
            <div>
              <strong>回调 URL:</strong> {window.location.origin}/api/auth/callback
            </div>
            <div>
              <strong>GitHub OAuth URL:</strong>
              <br />
              <code className="rounded bg-gray-100 p-1 text-xs dark:bg-gray-800">
                {process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/authorize?provider=github
              </code>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// 加载状态组件
function TestOAuthPageLoading() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 dark:bg-gray-900">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">GitHub OAuth 测试</h1>
          <p className="text-muted-foreground mt-2">正在加载配置...</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>系统状态检查</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="text-primary h-8 w-8 animate-spin" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// 主组件：使用 Suspense 包装
export default function TestOAuthPage() {
  return (
    <Suspense fallback={<TestOAuthPageLoading />}>
      <TestOAuthPageContent />
    </Suspense>
  )
}
