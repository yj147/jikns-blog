/**
 * 用户注册 API
 * Phase 2: 支持邮箱密码注册，与 Supabase Auth 集成
 */

import { NextRequest, NextResponse } from "next/server"
import { createRouteHandlerClient } from "@/lib/supabase"
import { XSSProtection, RateLimiter } from "@/lib/security"
import { z } from "zod"

// 注册请求验证 Schema
const RegisterSchema = z
  .object({
    email: z.string().email("邮箱格式不正确").max(255, "邮箱长度不能超过255字符"),
    password: z
      .string()
      .min(8, "密码至少需要8个字符")
      .max(128, "密码长度不能超过128字符")
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "密码必须包含大小写字母和数字"),
    confirmPassword: z.string(),
    name: z.string().min(2, "姓名至少需要2个字符").max(50, "姓名长度不能超过50字符").optional(),
    redirectTo: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "两次输入的密码不一致",
    path: ["confirmPassword"],
  })

export async function POST(request: NextRequest) {
  const clientIP =
    request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"

  try {
    // 速率限制检查 - 每个IP每小时最多注册3次
    if (!RateLimiter.checkRateLimit(`register:${clientIP}`, 3, 60 * 60 * 1000)) {
      console.warn(`注册速率限制触发，IP: ${clientIP}`)
      return NextResponse.json(
        {
          success: false,
          error: "rate_limit_exceeded",
          message: "注册请求过于频繁，请稍后再试",
        },
        { status: 429 }
      )
    }

    // 解析和验证请求体
    const body = await request.json()

    // XSS 防护 - 清理输入
    const cleanedBody = {
      email: XSSProtection.validateAndSanitizeInput(body.email),
      password: body.password, // 密码不需要HTML清理
      confirmPassword: body.confirmPassword,
      name: body.name ? XSSProtection.validateAndSanitizeInput(body.name) : undefined,
      redirectTo: body.redirectTo
        ? XSSProtection.validateAndSanitizeInput(body.redirectTo)
        : undefined,
    }

    // 验证数据格式
    const validationResult = RegisterSchema.safeParse(cleanedBody)
    if (!validationResult.success) {
      console.warn("注册数据验证失败:", validationResult.error.errors)
      return NextResponse.json(
        {
          success: false,
          error: "validation_error",
          message: "输入数据格式不正确",
          details: validationResult.error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 400 }
      )
    }

    const { email, password, name, redirectTo } = validationResult.data

    // 创建 Supabase 客户端
    const supabase = await createRouteHandlerClient()
    // 使用 Supabase Auth 创建用户
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.toLowerCase(),
      password: password,
      options: {
        data: {
          full_name: name,
          name: name,
        },
        emailRedirectTo: redirectTo
          ? `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?redirect_to=${encodeURIComponent(redirectTo)}`
          : `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      },
    })

    if (signUpError) {
      console.error("Supabase 注册失败:", {
        email,
        error: signUpError.message,
        status: signUpError.status,
      })

      // 根据错误类型返回适当的错误信息
      let errorMessage = "注册失败"
      let errorCode = "signup_failed"

      if (signUpError.message.includes("User already registered")) {
        errorMessage = "该邮箱已被注册"
        errorCode = "email_already_exists"
      } else if (signUpError.message.includes("Password should be")) {
        errorMessage = "密码不符合安全要求"
        errorCode = "weak_password"
      } else if (signUpError.message.includes("Invalid email")) {
        errorMessage = "邮箱格式不正确"
        errorCode = "invalid_email"
      } else if (signUpError.message.includes("Signup is disabled")) {
        errorMessage = "当前不允许新用户注册"
        errorCode = "signup_disabled"
      }

      return NextResponse.json(
        {
          success: false,
          error: errorCode,
          message: errorMessage,
        },
        { status: 400 }
      )
    }

    if (!data.user) {
      console.error("注册响应中缺少用户数据")
      return NextResponse.json(
        {
          success: false,
          error: "no_user_data",
          message: "注册响应异常，请重试",
        },
        { status: 500 }
      )
    }
    // 检查是否需要邮箱确认
    if (!data.session) {
      return NextResponse.json(
        {
          success: true,
          message: "注册成功！请检查您的邮箱并点击确认链接来激活账户",
          requiresEmailConfirmation: true,
          data: {
            user: {
              id: data.user.id,
              email: data.user.email,
              name: name,
              emailConfirmed: false,
            },
          },
        },
        { status: 201 }
      )
    }

    // 如果直接创建了会话（邮箱确认被禁用）

    try {
      // 由于用户刚创建，会在首次登录时通过 auth callback 进行数据同步
      // 这里直接返回成功响应
      return NextResponse.json(
        {
          success: true,
          message: "注册并登录成功！",
          data: {
            user: {
              id: data.user.id,
              email: data.user.email,
              name: name,
              role: "USER",
              status: "ACTIVE",
              emailConfirmed: true,
            },
            redirectTo: redirectTo || "/",
          },
        },
        { status: 201 }
      )
    } catch (error) {
      console.error("注册后处理异常:", error)

      return NextResponse.json(
        {
          success: true,
          message: "注册成功！请重新登录以完成设置",
          requiresLogin: true,
          data: {
            user: {
              id: data.user.id,
              email: data.user.email,
              name: name,
            },
          },
        },
        { status: 201 }
      )
    }
  } catch (error) {
    console.error("注册API异常:", error)

    return NextResponse.json(
      {
        success: false,
        error: "internal_server_error",
        message: "服务器内部错误，请稍后重试",
      },
      { status: 500 }
    )
  }
}

// 不支持的方法
export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: "method_not_allowed",
      message: "此端点仅支持 POST 请求",
    },
    { status: 405 }
  )
}
