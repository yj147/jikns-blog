"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { CheckCircle2, Loader2, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type VerifyState = {
  status: "idle" | "loading" | "success" | "error"
  message: string
}

export default function VerifySubscriptionPage() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const [state, setState] = useState<VerifyState>({
    status: "idle",
    message: "",
  })

  useEffect(() => {
    if (!token) {
      setState({ status: "error", message: "验证链接无效或已过期。" })
      return
    }

    let mounted = true
    setState({ status: "loading", message: "正在验证订阅..." })

    fetch(`/api/subscribe/verify?token=${token}`)
      .then(async (response) => {
        const body = await response.json().catch(() => null)
        if (!mounted) return
        if (response.ok && body?.success) {
          setState({ status: "success", message: "邮箱验证成功，感谢订阅！" })
        } else {
          setState({
            status: "error",
            message: body?.error?.message ?? "验证失败，请稍后重试。",
          })
        }
      })
      .catch(() => mounted && setState({ status: "error", message: "网络异常，请稍后再试。" }))

    return () => {
      mounted = false
    }
  }, [token])

  const icon =
    state.status === "success" ? (
      <CheckCircle2 className="h-8 w-8 text-green-600" />
    ) : state.status === "loading" ? (
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    ) : (
      <XCircle className="h-8 w-8 text-destructive" />
    )

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl items-center px-6 py-12 sm:px-8">
      <Card className="w-full">
        <CardHeader className="space-y-3">
          <CardTitle className="flex items-center gap-3 text-2xl font-semibold">
            {icon}
            邮箱验证
          </CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            {state.status === "loading"
              ? "正在确认你的订阅请求..."
              : state.message || "正在处理你的请求"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {state.status === "success" ? (
            <p className="text-sm text-muted-foreground">
              你将开始收到最新文章和重要通知。如果想调整偏好或退订，可随时通过邮件底部的链接操作。
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="secondary">
              <Link href="/">返回首页</Link>
            </Button>
            <Button asChild>
              <Link href="/subscribe">再次提交订阅</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
