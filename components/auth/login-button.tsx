/**
 * 登录按钮组件
 * 支持 GitHub OAuth 和邮箱密码登录选项
 */

"use client"

import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase"
import { getAuthCallbackUrl } from "@/lib/auth-utils"
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

  const supabase = createClient()

  const handleGithubLogin = async () => {
    setLoading("github")

    try {
      // 使用当前页面的 origin 作为最终重定向目标
      const currentOrigin =
        typeof window !== "undefined" ? window.location.origin : "http://localhost:4000"
      const finalRedirectUrl = redirectTo !== "/" ? `${currentOrigin}${redirectTo}` : currentOrigin

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: finalRedirectUrl,
          scopes: "user:email",
        },
      })

      if (error) {
        console.error("GitHub 登录错误:", error.message)
        authToast.loginError(`GitHub 登录失败: ${error.message}`)
      } else {
        authToast.oauthStarted("GitHub")
        // Supabase 会自动重定向到 GitHub，然后回到网关，最后跳转到 finalRedirectUrl
      }
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
