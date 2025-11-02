/**
 * 用户登录 API
 * Phase 2: 支持邮箱密码登录，与 Supabase Auth 集成
 */

import { NextRequest, NextResponse } from "next/server"
import { createRouteHandlerClient } from "@/lib/supabase"
import { syncUserFromAuth } from "@/lib/auth"
import { XSSProtection, RateLimiter } from "@/lib/security"
import { z } from "zod"

// 登录请求验证 Schema
const LoginSchema = z.object({
  email: z.string().email("邮箱格式不正确").max(255, "邮箱长度不能超过255字符"),
  password: z.string().min(6, "密码至少需要6个字符").max(128, "密码长度不能超过128字符"),
  redirectTo: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const clientIP =
    request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"

  try {
    // 速率限制检查 - 每个IP每15分钟最多尝试5次
    if (!RateLimiter.checkRateLimit(`login:${clientIP}`, 5, 15 * 60 * 1000)) {
      console.warn(`登录速率限制触发，IP: ${clientIP}`)
      return NextResponse.json(
        {
          success: false,
          error: "rate_limit_exceeded",
          message: "登录尝试过于频繁，请稍后再试",
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
      redirectTo: body.redirectTo
        ? XSSProtection.validateAndSanitizeInput(body.redirectTo)
        : undefined,
    }

    // 验证数据格式
    const validationResult = LoginSchema.safeParse(cleanedBody)
    if (!validationResult.success) {
      console.warn("登录数据验证失败:", validationResult.error.errors)
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

    const { email, password, redirectTo } = validationResult.data

    // 创建 Supabase 客户端
    const supabase = await createRouteHandlerClient()
    // 使用 Supabase Auth 进行身份验证
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase(),
      password: password,
    })

    if (signInError) {
      console.error("Supabase 登录失败:", {
        email,
        error: signInError.message,
        status: signInError.status,
      })

      // 根据错误类型返回适当的错误信息
      let errorMessage = "登录失败"
      let errorCode = "login_failed"

      if (signInError.message.includes("Invalid login credentials")) {
        errorMessage = "邮箱或密码不正确"
        errorCode = "invalid_credentials"
      } else if (signInError.message.includes("Email not confirmed")) {
        errorMessage = "请先验证您的邮箱"
        errorCode = "email_not_confirmed"
      } else if (signInError.message.includes("Too many requests")) {
        errorMessage = "登录尝试过于频繁，请稍后再试"
        errorCode = "too_many_requests"
      }

      return NextResponse.json(
        {
          success: false,
          error: errorCode,
          message: errorMessage,
        },
        { status: 401 }
      )
    }

    if (!data.session || !data.user) {
      console.error("登录响应中缺少会话或用户数据")
      return NextResponse.json(
        {
          success: false,
          error: "no_session_data",
          message: "认证响应异常，请重试",
        },
        { status: 500 }
      )
    }
    try {
      // 同步用户数据到数据库
      const syncedUser = await syncUserFromAuth({
        id: data.user.id,
        email: data.user.email,
        user_metadata: data.user.user_metadata,
      })
      // 返回成功响应
      const response = {
        success: true,
        message: "登录成功",
        data: {
          user: {
            id: syncedUser.id,
            email: syncedUser.email,
            name: syncedUser.name,
            role: syncedUser.role,
            status: syncedUser.status,
            avatarUrl: syncedUser.avatarUrl,
          },
          redirectTo: redirectTo || "/",
        },
      }

      return NextResponse.json(response, { status: 200 })
    } catch (syncError) {
      console.error("用户数据同步失败:", syncError)

      // 同步失败但认证成功，返回警告
      return NextResponse.json(
        {
          success: true,
          message: "登录成功，但用户资料同步异常",
          warning: "sync_failed",
          data: {
            user: {
              id: data.user.id,
              email: data.user.email,
              name: data.user.user_metadata?.full_name || data.user.user_metadata?.name,
              role: "USER", // 默认角色
              status: "ACTIVE",
              avatarUrl: data.user.user_metadata?.avatar_url,
            },
            redirectTo: redirectTo || "/",
          },
        },
        { status: 200 }
      )
    }
  } catch (error) {
    console.error("登录API异常:", error)

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
