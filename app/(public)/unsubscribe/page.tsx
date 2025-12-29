"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { CheckCircle2, Loader2, Mail, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type UnsubscribeState = {
  status: "idle" | "loading" | "success" | "error"
  message: string
}

function UnsubscribePageContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const [state, setState] = useState<UnsubscribeState>({ status: "idle", message: "" })
  const [email, setEmail] = useState("")

  useEffect(() => {
    if (!token) return

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

  const handleEmailUnsubscribe = useCallback(async () => {
    const normalized = email.trim()
    if (!normalized) {
      setState({ status: "error", message: "请输入邮箱地址" })
      return
    }

    setState({ status: "loading", message: "正在退订..." })

    try {
      const response = await fetch("/api/subscribe/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized }),
      })
      const body = await response.json().catch(() => null)
      if (response.ok && body?.success) {
        setState({ status: "success", message: "已成功退订，我们将不再发送邮件。" })
        setEmail("")
        return
      }
      setState({
        status: "error",
        message: body?.error?.message ?? "退订失败，请稍后再试。",
      })
    } catch {
      setState({ status: "error", message: "网络异常，请稍后再试。" })
    }
  }, [email])

  const icon =
    state.status === "success" ? (
      <CheckCircle2 className="h-8 w-8 text-green-600" />
    ) : state.status === "loading" ? (
      <Loader2 className="text-primary h-8 w-8 animate-spin" />
    ) : state.status === "error" ? (
      <XCircle className="text-destructive h-8 w-8" />
    ) : (
      <Mail className="text-muted-foreground h-8 w-8" />
    )

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl items-center px-6 py-12 sm:px-8">
      <Card className="w-full">
        <CardHeader className="space-y-3">
          <CardTitle className="flex items-center gap-3 text-2xl font-semibold">
            {icon}
            取消订阅
          </CardTitle>
          <CardDescription className="text-muted-foreground text-base">
            {state.status === "loading"
              ? "正在处理你的退订请求..."
              : state.message || (token ? "正在处理你的请求" : "输入订阅邮箱地址以取消订阅。")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {!token ? (
            <div className="flex flex-col gap-3">
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
              <Button
                type="button"
                onClick={handleEmailUnsubscribe}
                disabled={state.status === "loading"}
              >
                {state.status === "loading" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                确认取消订阅
              </Button>
              {state.status === "error" ? (
                <p className="text-destructive text-sm" role="alert">
                  {state.message}
                </p>
              ) : null}
            </div>
          ) : null}
          {state.status === "success" ? (
            <p className="text-muted-foreground text-sm">
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
            <Loader2 className="text-primary h-8 w-8 animate-spin" />
            退订邮件
          </CardTitle>
          <CardDescription className="text-muted-foreground text-base">
            正在加载页面...
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">正在准备退订信息，请稍候。</p>
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
