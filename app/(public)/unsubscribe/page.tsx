"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { CheckCircle2, Loader2, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type UnsubscribeState = {
  status: "idle" | "loading" | "success" | "error"
  message: string
}

function UnsubscribePageContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const [state, setState] = useState<UnsubscribeState>({ status: "idle", message: "" })

  useEffect(() => {
    if (!token) {
      setState({ status: "error", message: "退订链接无效或已过期。" })
      return
    }

    let mounted = true
    setState({ status: "loading", message: "正在退订..." })

    fetch(`/api/subscribe/unsubscribe?token=${token}`)
      .then(async (response) => {
        const body = await response.json().catch(() => null)
        if (!mounted) return
        if (response.ok && body?.success) {
          setState({ status: "success", message: "已成功退订，我们将不再发送邮件。" })
        } else {
          setState({
            status: "error",
            message: body?.error?.message ?? "退订失败，请稍后再试。",
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
            退订邮件
          </CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            {state.status === "loading"
              ? "正在处理你的退订请求..."
              : state.message || "正在处理你的请求"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {state.status === "success" ? (
            <p className="text-sm text-muted-foreground">
              你可以随时在站内重新订阅。如果误点，请再次提交订阅表单即可恢复。
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="secondary">
              <Link href="/">返回首页</Link>
            </Button>
            <Button asChild>
              <Link href="/subscribe">重新订阅</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function UnsubscribePageFallback() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl items-center px-6 py-12 sm:px-8">
      <Card className="w-full">
        <CardHeader className="space-y-3">
          <CardTitle className="flex items-center gap-3 text-2xl font-semibold">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            退订邮件
          </CardTitle>
          <CardDescription className="text-base text-muted-foreground">正在加载页面...</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">正在准备退订信息，请稍候。</p>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" disabled>
              返回首页
            </Button>
            <Button disabled>重新订阅</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={<UnsubscribePageFallback />}>
      <UnsubscribePageContent />
    </Suspense>
  )
}
