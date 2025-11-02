/**
 * 邮箱认证表单组件
 * 支持登录和注册两种模式
 */

"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { createClient } from "@/lib/supabase"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"

// 表单验证 schema
const emailAuthSchema = z
  .object({
    email: z.string().email("请输入有效的邮箱地址"),
    password: z.string().min(6, "密码至少需要6位字符"),
    confirmPassword: z.string().optional(),
  })
  .refine(
    (data) => {
      // 注册模式下需要确认密码
      if (data.confirmPassword !== undefined) {
        return data.password === data.confirmPassword
      }
      return true
    },
    {
      message: "两次输入的密码不匹配",
      path: ["confirmPassword"],
    }
  )

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
  const supabase = createClient()

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
        // 登录逻辑
        const { data: authData, error } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        })

        if (error) {
          setMessage({
            type: "error",
            text: getErrorMessage(error.message),
          })
        } else if (authData.user) {
          setMessage({
            type: "success",
            text: "登录成功！正在跳转...",
          })

          // 延时跳转，让用户看到成功提示
          setTimeout(() => {
            router.push(redirect)
            router.refresh()
          }, 1000)
        }
      } else {
        // 注册逻辑
        const { data: authData, error } = await supabase.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback${redirect !== "/" ? `?redirect=${encodeURIComponent(redirect)}` : ""}`,
          },
        })

        if (error) {
          setMessage({
            type: "error",
            text: getErrorMessage(error.message),
          })
        } else if (authData.user) {
          setMessage({
            type: "success",
            text: "注册成功！请检查您的邮箱并点击确认链接。",
          })
        }
      }
    } catch (error) {
      console.error("认证错误:", error)
      setMessage({
        type: "error",
        text: "网络错误，请稍后重试",
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
          {...form.register("email")}
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
          {...form.register("password")}
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
  }

  return errorMessages[error] || `认证失败：${error}`
}
