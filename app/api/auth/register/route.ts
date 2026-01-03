/**
 * 用户注册 API
 * Phase 2: 支持邮箱密码注册，与 Supabase Auth 集成
 */

import { NextRequest, NextResponse } from "next/server"
import { createRouteHandlerClient, createServiceRoleClient } from "@/lib/supabase"
import { XSSProtection, RateLimiter } from "@/lib/security"
import { z } from "zod"
import { authLogger } from "@/lib/utils/logger"
import { getSetting, type RegistrationToggle } from "@/lib/services/system-settings"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"
import { getClientIp } from "@/lib/api/get-client-ip"

function resolveAuthBaseUrl(request: NextRequest): string {
  // Auth 回调必须落回 Supabase allowlist 允许的域名（见 app/api/auth/github/route.ts）。
  const requestOrigin = new URL(request.url).origin

  let origin = requestOrigin
  if (process.env.VERCEL_ENV === "preview") {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
    if (siteUrl) {
      try {
        const siteOrigin = new URL(siteUrl).origin
        if (
          !siteOrigin.startsWith("http://localhost") &&
          !siteOrigin.startsWith("http://127.0.0.1")
        ) {
          origin = siteOrigin
        }
      } catch {
        origin = requestOrigin
      }
    }
  }

  const url = new URL(origin)
  if (url.hostname.startsWith("www.")) {
    url.hostname = url.hostname.slice(4)
  }
  return url.origin
}

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

async function handlePost(request: NextRequest) {
  const clientIP = getClientIp(request)

  try {
    // 速率限制检查 - 每个IP每小时最多注册3次
    if (!RateLimiter.checkRateLimit(`register:${clientIP}`, 3, 60 * 60 * 1000)) {
      authLogger.warn("注册速率限制触发", { clientIP })
      return NextResponse.json(
        {
          success: false,
          error: "rate_limit_exceeded",
          message: "注册请求过于频繁，请稍后再试",
        },
        { status: 429 }
      )
    }

    // 检查系统设置中的注册开关
    const registrationSetting = await getSetting<RegistrationToggle>("registration.toggle")
    if (registrationSetting && registrationSetting.enabled === false) {
      authLogger.info("注册已被管理员禁用", { clientIP })
      return NextResponse.json(
        {
          success: false,
          error: "signup_disabled",
          message: "当前不允许新用户注册",
        },
        { status: 403 }
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
      authLogger.warn("注册数据验证失败", {
        errors: validationResult.error.errors,
      })
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
    const baseUrl = resolveAuthBaseUrl(request)

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
          ? `${baseUrl}/auth/callback?redirect_to=${encodeURIComponent(redirectTo)}`
          : `${baseUrl}/auth/callback`,
      },
    })

    if (signUpError) {
      authLogger.error(
        "Supabase 注册失败",
        {
          email,
          status: signUpError.status,
          module: "api/auth/register",
        },
        signUpError
      )

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
      authLogger.error("注册响应中缺少用户数据", { email })
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
      if (process.env.VERCEL_ENV === "preview") {
        try {
          const adminClient = createServiceRoleClient()
          const { error: confirmError } = await adminClient.auth.admin.updateUserById(
            data.user.id,
            {
              email_confirm: true,
            }
          )
          if (confirmError) {
            throw confirmError
          }

          const signIn = await supabase.auth.signInWithPassword({
            email: email.toLowerCase(),
            password,
          })

          if (signIn.error || !signIn.data.session || !signIn.data.user) {
            throw signIn.error ?? new Error("Supabase signIn missing session/user")
          }

          const { syncUserFromAuth } = await import("@/lib/auth")
          const syncedUser = await syncUserFromAuth({
            id: signIn.data.user.id,
            email: signIn.data.user.email,
            user_metadata: signIn.data.user.user_metadata || {},
          })

          authLogger.info("Preview 注册自动确认邮箱成功", {
            userId: syncedUser.id,
            email: syncedUser.email,
          })

          return NextResponse.json(
            {
              success: true,
              message: "注册并登录成功！",
              data: {
                user: {
                  id: syncedUser.id,
                  email: syncedUser.email,
                  name: syncedUser.name,
                  role: syncedUser.role,
                  status: syncedUser.status,
                  emailConfirmed: true,
                },
                redirectTo: redirectTo || "/",
              },
            },
            { status: 201 }
          )
        } catch (error) {
          authLogger.warn("Preview 注册自动确认邮箱失败，回退为邮件确认流程", {
            email,
            userId: data.user.id,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }

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
    // 立即同步用户数据到 Prisma，确保用户可以正常访问需要数据库的功能
    try {
      const { syncUserFromAuth } = await import("@/lib/auth")

      // 同步用户数据到数据库
      const syncedUser = await syncUserFromAuth({
        id: data.user.id,
        email: data.user.email,
        user_metadata: data.user.user_metadata || {},
      })

      authLogger.info("注册用户数据同步成功", {
        userId: syncedUser.id,
        email: syncedUser.email,
      })

      return NextResponse.json(
        {
          success: true,
          message: "注册并登录成功！",
          data: {
            user: {
              id: syncedUser.id,
              email: syncedUser.email,
              name: syncedUser.name,
              role: syncedUser.role,
              status: syncedUser.status,
              emailConfirmed: true,
            },
            redirectTo: redirectTo || "/",
          },
        },
        { status: 201 }
      )
    } catch (error) {
      authLogger.error("注册后处理异常", { userId: data.user?.id }, error)

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
    authLogger.error("注册 API 异常", { module: "api/auth/register", clientIP }, error)

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
async function handleGet() {
  return NextResponse.json(
    {
      success: false,
      error: "method_not_allowed",
      message: "此端点仅支持 POST 请求",
    },
    { status: 405 }
  )
}

export const POST = withApiResponseMetrics(handlePost)
export const GET = withApiResponseMetrics(handleGet)
