/**
 * 登录按钮组件
 * 支持 GitHub OAuth 和邮箱密码登录选项
 */

"use client"

import { Button } from "@/components/ui/button"
import { useAuthToast } from "@/hooks/use-auth-toast"
import { Github, Mail, Loader2 } from "lucide-react"
import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

interface LoginButtonProps {
  className?: string
  size?: "default" | "sm" | "lg"
  showEmailOption?: boolean
  redirect?: string
}

export function LoginButton({
  className,
  size = "default",
  showEmailOption = true,
  redirect,
}: LoginButtonProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const authToast = useAuthToast()

  // 获取重定向路径，优先级：props > searchParams > 默认值
  const redirectTo = redirect || searchParams.get("redirect") || "/"

  const handleGithubLogin = async () => {
    setLoading("github")

    try {
      // 必须走服务端 OAuth 启动路由：
      // 1) 统一 state 校验与速率限制；2) callback 使用 request.url origin，Preview 不会被 NEXT_PUBLIC_SITE_URL 污染；
      // 3) redirect_to 通过 query 传递，最终由 /auth/callback 处理。
      const params = new URLSearchParams()
      if (redirectTo && redirectTo !== "/") {
        params.set("redirect_to", redirectTo)
      }

      authToast.oauthStarted("GitHub")

      const url = params.size > 0 ? `/api/auth/github?${params.toString()}` : "/api/auth/github"
      window.location.href = url
    } catch (error) {
      console.error("GitHub 登录异常:", error)
      authToast.networkError()
    } finally {
      setLoading(null)
    }
  }

  const handleEmailLogin = () => {
    const emailLoginUrl =
      redirectTo !== "/"
        ? `/login/email?redirect=${encodeURIComponent(redirectTo)}`
        : "/login/email"
    router.push(emailLoginUrl)
  }

  return (
    <div className={`flex w-full flex-col gap-3 ${className}`}>
      <Button
        onClick={handleGithubLogin}
        disabled={!!loading}
        size={size}
        variant="outline"
        className="w-full"
      >
        {loading === "github" ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Github className="mr-2 h-4 w-4" />
        )}
        {loading === "github" ? "连接中..." : "使用 GitHub 登录"}
      </Button>

      {showEmailOption && (
        <Button
          onClick={handleEmailLogin}
          disabled={!!loading}
          size={size}
          variant="ghost"
          className="w-full"
        >
          <Mail className="mr-2 h-4 w-4" />
          使用邮箱登录
        </Button>
      )}
    </div>
  )
}
