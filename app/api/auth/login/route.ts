/**
 * 用户登录 API
 * Phase 2: 支持邮箱密码登录，与 Supabase Auth 集成
 */

import { NextRequest, NextResponse } from "next/server"
import { createRouteHandlerClient, createServiceRoleClient } from "@/lib/supabase"
import { syncUserFromAuth } from "@/lib/auth"
import { XSSProtection, RateLimiter } from "@/lib/security"
import { z } from "zod"
import { authLogger } from "@/lib/utils/logger"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import type { Session } from "@supabase/supabase-js"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"

// 登录请求验证 Schema
const LoginSchema = z.object({
  email: z.string().email("邮箱格式不正确").max(255, "邮箱长度不能超过255字符"),
  password: z.string().min(6, "密码至少需要6个字符").max(128, "密码长度不能超过128字符"),
  redirectTo: z.string().optional(),
})

async function handlePost(request: NextRequest) {
  const clientIP =
    request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"

  try {
    // 速率限制检查 - 每个IP每15分钟最多尝试5次
    if (!RateLimiter.checkRateLimit(`login:${clientIP}`, 5, 15 * 60 * 1000)) {
      authLogger.warn("登录速率限制触发", { clientIP })
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
      authLogger.warn("登录数据验证失败", {
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

    const { email, password, redirectTo } = validationResult.data

    const normalizedEmail = email.toLowerCase()

    // 创建 Supabase 客户端
    const supabase = await createRouteHandlerClient()
    // 使用 Supabase Auth 进行身份验证
    let {
      data,
      error: signInError,
    } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: password,
    })

    if (signInError && isInvalidCredentialsError(signInError)) {
      const provisioned = await autoProvisionSupabaseUser(normalizedEmail, password)
      if (provisioned) {
        const retry = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password: password,
        })
        data = retry.data
        signInError = retry.error
      }
    }

    if (signInError) {
      authLogger.error(
        "Supabase 登录失败",
        { email, status: signInError.status, module: "api/auth/login" },
        signInError
      )

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
      authLogger.error("登录响应中缺少会话或用户数据", { email })
      return NextResponse.json(
        {
          success: false,
          error: "no_session_data",
          message: "认证响应异常，请重试",
        },
        { status: 500 }
      )
    }
    const responsePayload = await buildSuccessResponse(
      {
        user: {
          id: data.user.id,
          email: data.user.email,
          user_metadata: data.user.user_metadata,
        },
        session: data.session,
      },
      redirectTo
    )
    return NextResponse.json(responsePayload, { status: 200 })
  } catch (error) {
    authLogger.error("登录 API 异常", { clientIP }, error)

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

async function buildSuccessResponse(
  supabaseData: {
    user: { id: string; email: string | null | undefined; user_metadata: Record<string, any> | null }
    session: Session | null
  },
  redirectTo?: string
) {
  try {
    const syncedUser = await syncUserFromAuth({
      id: supabaseData.user.id,
      email: supabaseData.user.email,
      user_metadata: supabaseData.user.user_metadata,
    })

    return {
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
        session: extractSessionTokens(supabaseData.session),
        redirectTo: redirectTo || "/",
      },
    }
  } catch (error) {
    authLogger.error("用户数据同步失败", { userId: supabaseData.user.id }, error)

    return {
      success: true,
      message: "登录成功，但用户资料同步异常",
      warning: "sync_failed",
      data: {
        user: {
          id: supabaseData.user.id,
          email: supabaseData.user.email,
          name: supabaseData.user.user_metadata?.full_name || supabaseData.user.user_metadata?.name,
          role: "USER",
          status: "ACTIVE",
          avatarUrl: supabaseData.user.user_metadata?.avatar_url,
        },
        session: extractSessionTokens(supabaseData.session),
        redirectTo: redirectTo || "/",
      },
    }
  }
}

function extractSessionTokens(session: Session | null) {
  if (!session) return null
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
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

function isInvalidCredentialsError(error: any): boolean {
  if (!error) return false
  const message = (error.message || "").toLowerCase()
  return message.includes("invalid login credentials")
}

async function autoProvisionSupabaseUser(email: string, password: string): Promise<boolean> {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return false
    }

    const localUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, passwordHash: true },
    })

    if (!localUser?.passwordHash) {
      return false
    }

    const passwordMatches = await bcrypt.compare(password, localUser.passwordHash)
    if (!passwordMatches) {
      return false
    }

    const adminClient = createServiceRoleClient()
    const desiredUserId = localUser.id

    const ensured = await ensureSupabaseUserWithId(adminClient, {
      id: desiredUserId,
      email,
      password,
    })

    return ensured
  } catch (error) {
    authLogger.error("自动同步 Supabase 用户异常", { stage: "autoProvision", email }, error)
    return false
  }
}

async function ensureSupabaseUserWithId(
  adminClient: SupabaseClient<Database>,
  params: { id: string; email: string; password: string }
): Promise<boolean> {
  const { id, email, password } = params

  // 1. 尝试直接按 ID 获取
  const { data: userById, error: fetchByIdError } = await adminClient.auth.admin.getUserById(id)
  if (!fetchByIdError && userById?.user) {
    const { error: updateError } = await adminClient.auth.admin.updateUserById(id, {
      password,
      email_confirm: true,
    })
    if (updateError) {
      authLogger.error("更新 Supabase 用户密码失败", { stage: "autoProvision:update", email }, updateError)
      return false
    }
    return true
  }

  // 2. 尝试创建同 ID 新用户
  const { error: createError } = await adminClient.auth.admin.createUser({
    id,
    email,
    password,
    email_confirm: true,
  })

  if (!createError) {
    return true
  }

  if (createError.message?.includes("already registered")) {
    // 存在其他 ID 的用户，尝试删除并重建
    const existing = await findSupabaseUserByEmail(adminClient, email)

    if (existing) {
      if (existing.id !== id) {
        const { error: deleteError } = await adminClient.auth.admin.deleteUser(existing.id)
        if (deleteError) {
          authLogger.error(
            "删除 Supabase 冲突用户失败",
            { stage: "autoProvision:delete", email, existingId: existing.id },
            deleteError
          )
          return false
        }

        const retry = await adminClient.auth.admin.createUser({
          id,
          email,
          password,
          email_confirm: true,
        })

        if (retry.error) {
          authLogger.error("重新创建 Supabase 用户失败", { stage: "autoProvision:retry", email }, retry.error)
          return false
        }
        return true
      }

      const { error: updateError } = await adminClient.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
      })

      if (updateError) {
        authLogger.error("更新 Supabase 用户密码失败", { stage: "autoProvision:updateExisting", email }, updateError)
        return false
      }

      return true
    }
  }

  authLogger.error("自动创建 Supabase 用户失败", { stage: "autoProvision:create", email }, createError)
  return false
}

async function findSupabaseUserByEmail(adminClient: SupabaseClient<Database>, email: string) {
  const normalizedEmail = email.toLowerCase()
  const perPage = 100
  let page = 1

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage })
    if (error) {
      authLogger.error("查询 Supabase 用户列表失败", { stage: "autoProvision:list", page }, error)
      return null
    }

    const users = data?.users ?? []
    const match = users.find((user) => user.email?.toLowerCase() === normalizedEmail)
    if (match) {
      return match
    }

    if (!data?.nextPage) {
      break
    }

    page = data.nextPage
  }

  return null
}
