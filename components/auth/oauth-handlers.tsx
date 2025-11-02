/**
 * OAuth 处理组件
 * 处理 OAuth 登录状态和错误显示
 */

"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, CheckCircle, AlertCircle } from "lucide-react"

interface OAuthState {
  status: "loading" | "success" | "error" | null
  message?: string
  redirect?: string | null
}

export function OAuthStatusHandler() {
  const [oauthState, setOauthState] = useState<OAuthState>({ status: null })
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const error = searchParams.get("error")
    const success = searchParams.get("success")
    const redirect = searchParams.get("redirect")

    if (error) {
      setOauthState({
        status: "error",
        message: getErrorMessage(error),
        redirect: redirect || undefined,
      })
    } else if (success) {
      setOauthState({
        status: "success",
        message: "登录成功！正在跳转...",
        redirect: redirect || undefined,
      })

      // 延迟跳转以显示成功消息
      setTimeout(() => {
        router.push(redirect || "/")
        router.refresh()
      }, 1500)
    }
  }, [searchParams, router])

  // 清除状态
  const clearState = () => {
    setOauthState({ status: null })
    // 清除URL参数
    const url = new URL(window.location.href)
    url.searchParams.delete("error")
    url.searchParams.delete("success")
    window.history.replaceState({}, "", url.toString())
  }

  if (!oauthState.status) {
    return null
  }

  return (
    <div className="w-full">
      <Alert variant={oauthState.status === "error" ? "destructive" : "default"} className="mb-4">
        {oauthState.status === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
        {oauthState.status === "success" && <CheckCircle className="h-4 w-4 text-green-600" />}
        {oauthState.status === "error" && <AlertCircle className="h-4 w-4" />}
        <AlertDescription className="flex items-center justify-between">
          <span>{oauthState.message}</span>
          {oauthState.status === "error" && (
            <button onClick={clearState} className="text-sm underline hover:no-underline">
              关闭
            </button>
          )}
        </AlertDescription>
      </Alert>
    </div>
  )
}

/**
 * OAuth 加载状态组件
 * 在 OAuth 重定向过程中显示
 */
export function OAuthLoadingIndicator() {
  const [isOAuthFlow, setIsOAuthFlow] = useState(false)

  useEffect(() => {
    // 检测是否在 OAuth 流程中
    const url = new URL(window.location.href)
    const hasOAuthParams =
      url.searchParams.has("code") ||
      url.searchParams.has("state") ||
      url.pathname.includes("/auth/callback")

    setIsOAuthFlow(hasOAuthParams)
  }, [])

  if (!isOAuthFlow) {
    return null
  }

  return (
    <div className="bg-background/80 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm">
      <div className="bg-card mx-4 w-full max-w-sm rounded-lg border p-6 text-center shadow-lg">
        <Loader2 className="text-primary mx-auto mb-4 h-8 w-8 animate-spin" />
        <h3 className="mb-2 text-lg font-semibold">正在处理登录</h3>
        <p className="text-muted-foreground">请稍候，我们正在验证您的身份...</p>
      </div>
    </div>
  )
}

/**
 * 获取用户友好的错误消息
 */
function getErrorMessage(error: string): string {
  const errorMessages: Record<string, string> = {
    access_denied: "您取消了授权登录",
    invalid_request: "登录请求无效",
    server_error: "服务器错误，请稍后重试",
    temporarily_unavailable: "GitHub 服务暂时不可用",
    invalid_scope: "请求权限无效",
    unsupported_response_type: "不支持的响应类型",
    auth_failed: "认证失败，请重试",
    exchange_failed: "授权验证失败",
    callback_failed: "登录回调处理失败",
    missing_code: "认证信息缺失",
    invalid_state: "状态参数无效，可能存在安全风险",
  }

  return errorMessages[error] || `登录失败: ${error}`
}
