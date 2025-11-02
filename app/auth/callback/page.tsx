"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"

/**
 * OAuth 认证回调页面
 * 处理 GitHub OAuth 登录后的回调逻辑
 */
export default function AuthCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [errorMessage, setErrorMessage] = useState<string>("")

  // 创建 Supabase 浏览器客户端
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // 处理 OAuth 回调中的认证码
        const { data, error } = await supabase.auth.getSession()

        if (error) {
          console.error("认证回调错误:", error)
          setErrorMessage(error.message)
          setStatus("error")
          return
        }

        if (data.session) {
          console.log("认证成功:", data.session.user)
          setStatus("success")

          // 延迟跳转，让用户看到成功状态
          setTimeout(() => {
            // 检查是否有返回 URL，否则跳转到主页
            const returnTo = searchParams?.get("returnTo") || searchParams?.get("redirect") || "/"
            router.replace(returnTo)
          }, 1500)
        } else {
          setErrorMessage("未找到有效会话")
          setStatus("error")
        }
      } catch (err) {
        console.error("处理认证回调时发生错误:", err)
        setErrorMessage(err instanceof Error ? err.message : "未知错误")
        setStatus("error")
      }
    }

    handleAuthCallback()
  }, [router, searchParams, supabase.auth])

  // 加载状态
  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <p className="text-lg text-gray-600">正在处理登录信息...</p>
        </div>
      </div>
    )
  }

  // 成功状态
  if (status === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <svg
              className="h-6 w-6 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 13l4 4L19 7"
              ></path>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-green-600">登录成功！</h1>
          <p className="text-gray-600">正在跳转到主页...</p>
        </div>
      </div>
    )
  }

  // 错误状态
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="max-w-md space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <svg
            className="h-6 w-6 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M6 18L18 6M6 6l12 12"
            ></path>
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-red-600">登录失败</h1>
        <p className="break-words text-gray-600">{errorMessage}</p>
        <button
          onClick={() => router.push("/login")}
          className="mt-4 rounded-lg bg-blue-600 px-6 py-2 text-white transition-colors hover:bg-blue-700"
        >
          返回登录页
        </button>
      </div>
    </div>
  )
}
