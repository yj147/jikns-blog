/**
 * 会话验证 API
 * Phase 2: 验证用户会话状态，返回用户信息
 */

import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser, getAuthenticatedUser } from "@/lib/auth"
import { RateLimiter } from "@/lib/security"
import { authLogger } from "@/lib/utils/logger"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"

async function handleGet(request: NextRequest) {
  const clientIP =
    request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"

  try {
    // 速率限制检查 - 每个IP每分钟最多50次验证请求
    if (!RateLimiter.checkRateLimit(`verify:${clientIP}`, 50, 60 * 1000)) {
      authLogger.warn("会话验证速率限制触发", { clientIP })
      return NextResponse.json(
        {
          success: false,
          error: "rate_limit_exceeded",
          message: "请求过于频繁，请稍后再试",
        },
        { status: 429 }
      )
    }

    // 获取经过验证的用户信息
    const { user: authUser, error: userError } = await getAuthenticatedUser()

    if (userError) {
      authLogger.error("获取认证用户失败", { clientIP }, userError)
      return NextResponse.json(
        {
          success: false,
          authenticated: false,
          error: "auth_error",
          message: "用户认证失败",
        },
        { status: 401 }
      )
    }

    if (!authUser) {
      return NextResponse.json(
        {
          success: true,
          authenticated: false,
          message: "用户未登录",
        },
        { status: 200 }
      )
    }

    // 获取数据库中的用户信息
    const user = await getCurrentUser()

    if (!user) {
      authLogger.warn("认证用户存在但数据库中没有用户记录", {
        email: authUser.email,
        userId: authUser.id,
      })
      return NextResponse.json(
        {
          success: false,
          authenticated: false,
          error: "user_not_found",
          message: "用户数据不存在，请重新登录",
        },
        { status: 401 }
      )
    }

    // 检查用户状态
    if (user.status !== "ACTIVE") {
      authLogger.warn("用户账户被封禁", { email: user.email, userId: user.id })
      return NextResponse.json(
        {
          success: false,
          authenticated: false,
          error: "account_banned",
          message: "账户已被封禁",
        },
        { status: 403 }
      )
    }

    // 返回用户信息
    return NextResponse.json(
      {
        success: true,
        authenticated: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            status: user.status,
            avatarUrl: user.avatarUrl,
            bio: user.bio,
            socialLinks: user.socialLinks,
            createdAt: user.createdAt,
            lastLoginAt: user.lastLoginAt,
          },
          auth: {
            id: authUser.id,
            provider: authUser.app_metadata?.provider,
          },
        },
      },
      { status: 200 }
    )
  } catch (error) {
    authLogger.error("会话验证 API 异常", { clientIP }, error)

    return NextResponse.json(
      {
        success: false,
        authenticated: false,
        error: "internal_server_error",
        message: "服务器内部错误",
      },
      { status: 500 }
    )
  }
}

// 不支持的方法
async function handlePost() {
  return NextResponse.json(
    {
      success: false,
      error: "method_not_allowed",
      message: "此端点仅支持 GET 请求",
    },
    { status: 405 }
  )
}

export const GET = withApiResponseMetrics(handleGet)
export const POST = withApiResponseMetrics(handlePost)
