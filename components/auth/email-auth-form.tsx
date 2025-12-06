/**
 * 邮箱认证表单组件
 * 支持登录和注册两种模式
 */

"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { ensureCsrfToken, getCsrfHeaders } from "@/lib/security/csrf-client"

// 表单验证 schema
const emailAuthSchema = z
  .object({
    email: z.string().email("请输入有效的邮箱地址"),
    password: z.string().min(6, "密码至少需要6位字符").max(128, "密码长度不能超过128字符"),
    confirmPassword: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const isRegisterMode = data.confirmPassword !== undefined
    if (!isRegisterMode) {
      return
    }

    if (data.password.length < 8) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["password"],
        message: "密码至少需要8位字符",
      })
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(data.password)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["password"],
        message: "密码必须包含大小写字母和数字",
      })
    }

    if (data.confirmPassword !== undefined && data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "两次输入的密码不匹配",
      })
    }
  })

type EmailAuthFormData = z.infer<typeof emailAuthSchema>

interface EmailAuthFormProps {
  redirect?: string
  mode?: "login" | "register"
}

export function EmailAuthForm({ redirect = "/", mode = "login" }: EmailAuthFormProps) {
  const [isLogin, setIsLogin] = useState(mode === "login")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const router = useRouter()

  const form = useForm<EmailAuthFormData>({
    resolver: zodResolver(emailAuthSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: isLogin ? undefined : "",
    },
  })

  const onSubmit = async (data: EmailAuthFormData) => {
    setLoading(true)
    setMessage(null)

    try {
      if (isLogin) {
        const csrf = await ensureCsrfToken()
        const response = await fetch("/api/auth/login", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...getCsrfHeaders(csrf),
          },
          body: JSON.stringify({
            email: data.email,
            password: data.password,
            redirectTo: redirect !== "/" ? redirect : undefined,
          }),
        })

        const result = await safeParseJson(response)

        if (!response.ok || !result?.success) {
          setMessage({
            type: "error",
            text: extractApiError(result, "login_failed"),
          })
          return
        }

        setMessage({
          type: "success",
          text: result.message || "登录成功！正在跳转...",
        })

        // 通知全局 AuthProvider 从服务端 Cookie 同步会话
        window.dispatchEvent(new Event("auth:server-login"))

        const targetUrl = result.data?.redirectTo || redirect
        setTimeout(() => {
          window.location.assign(targetUrl)
        }, 400)
      } else {
        const csrf = await ensureCsrfToken()
        const response = await fetch("/api/auth/register", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...getCsrfHeaders(csrf),
          },
          body: JSON.stringify({
            email: data.email,
            password: data.password,
            confirmPassword: data.confirmPassword,
            redirectTo: redirect !== "/" ? redirect : undefined,
          }),
        })

        const result = await safeParseJson(response)

        if (!response.ok || !result?.success) {
          setMessage({
            type: "error",
            text: extractApiError(result, "signup_failed"),
          })
          return
        }

        if (result.requiresEmailConfirmation) {
          setMessage({
            type: "success",
            text: result.message || "注册成功！请检查您的邮箱并点击确认链接。",
          })
          return
        }

        setMessage({
          type: "success",
          text: result.message || "注册成功！正在跳转...",
        })

        // 注册成功同样触发会话同步，避免导航栏状态不同步
        window.dispatchEvent(new Event("auth:server-login"))

        setTimeout(() => {
          window.location.assign(result.data?.redirectTo || redirect)
        }, 400)
      }
    } catch (error) {
      console.error("认证错误:", error)
      setMessage({
        type: "error",
        text: getErrorMessage("NETWORK_ERROR"),
      })
    } finally {
      setLoading(false)
    }
  }

  const toggleMode = () => {
    setIsLogin(!isLogin)
    setMessage(null)
    form.reset()

    // 动态调整表单验证
    if (!isLogin) {
      form.setValue("confirmPassword", undefined)
    } else {
      form.setValue("confirmPassword", "")
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      {/* 错误/成功消息 */}
      {message && (
        <Alert variant={message.type === "error" ? "destructive" : "default"}>
          {message.type === "error" ? (
            <AlertCircle className="h-4 w-4" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* 邮箱输入 */}
      <div className="space-y-2">
        <Label htmlFor="email">邮箱地址</Label>
        <Input
          id="email"
          type="email"
          placeholder="your@example.com"
          disabled={loading}
          {...form.register("email", {
            onChange: (e) => form.setValue("email", e.target.value, { shouldValidate: true }),
            onBlur: () => form.trigger("email"),
          })}
        />
        {form.formState.errors.email && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {form.formState.errors.email.message}
          </p>
        )}
      </div>

      {/* 密码输入 */}
      <div className="space-y-2">
        <Label htmlFor="password">密码</Label>
        <Input
          id="password"
          type="password"
          placeholder="请输入密码"
          disabled={loading}
          {...form.register("password", {
            onChange: (e) => form.setValue("password", e.target.value, { shouldValidate: true }),
            onBlur: () => form.trigger("password"),
          })}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              form.handleSubmit(onSubmit)()
            }
          }}
        />
        {form.formState.errors.password && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {form.formState.errors.password.message}
          </p>
        )}
      </div>

      {/* 确认密码输入（仅注册时显示） */}
      {!isLogin && (
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">确认密码</Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="请再次输入密码"
            disabled={loading}
            {...form.register("confirmPassword")}
          />
          {form.formState.errors.confirmPassword && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {form.formState.errors.confirmPassword.message}
            </p>
          )}
        </div>
      )}

      {/* 提交按钮 */}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {isLogin ? "登录中..." : "注册中..."}
          </>
        ) : isLogin ? (
          "登录"
        ) : (
          "注册"
        )}
      </Button>

      {/* 切换模式 */}
      <div className="text-center">
        <button
          type="button"
          onClick={toggleMode}
          disabled={loading}
          className="text-muted-foreground hover:text-foreground text-sm transition-colors"
        >
          {isLogin ? "还没有账户？注册新账户" : "已有账户？立即登录"}
        </button>
      </div>
    </form>
  )
}

/**
 * 将 Supabase 错误消息转换为用户友好的中文提示
 */
function getErrorMessage(error: string): string {
  const errorMessages: Record<string, string> = {
    "Invalid login credentials": "邮箱或密码错误",
    "Email not confirmed": "邮箱未验证，请检查您的邮箱",
    "User not found": "用户不存在",
    "Weak password": "密码强度不够，请使用更复杂的密码",
    "User already registered": "该邮箱已被注册",
    "Signup not allowed": "当前不允许注册新用户",
    "Email rate limit exceeded": "邮件发送频率过高，请稍后重试",
    login_failed: "登录失败，请稍后重试",
    invalid_credentials: "邮箱或密码错误",
    email_not_confirmed: "邮箱未验证，请检查您的邮箱",
    email_already_exists: "该邮箱已被注册",
    signup_failed: "注册失败，请稍后重试",
    weak_password: "密码不符合安全要求（需包含大小写字母和数字）",
    rate_limit_exceeded: "操作过于频繁，请稍后再试",
    network_error: "无法连接认证服务，请确认 Supabase 是否已启动",
    NETWORK_ERROR: "无法连接认证服务，请确认 Supabase 是否已启动",
    internal_server_error: "服务器异常，请稍后重试",
  }

  if (errorMessages[error]) {
    return errorMessages[error]
  }

  const normalized = error?.toLowerCase?.()
  if (normalized && errorMessages[normalized]) {
    return errorMessages[normalized]
  }

  return error ? `认证失败：${error}` : "认证失败，请稍后重试"
}

async function safeParseJson(response: Response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function extractApiError(result: any, fallbackCode: string): string {
  if (!result) {
    return getErrorMessage("NETWORK_ERROR")
  }

  if (Array.isArray(result.details) && result.details.length > 0) {
    const detailMessage = result.details[0]?.message
    if (detailMessage) {
      return detailMessage
    }
  }

  if (typeof result.message === "string" && result.message.trim()) {
    return result.message
  }

  if (typeof result.error === "string") {
    return getErrorMessage(result.error)
  }

  return getErrorMessage(fallbackCode)
}
