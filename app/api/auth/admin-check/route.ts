/**
 * 管理员权限验证 API
 * Phase 2: 专门验证用户是否具有管理员权限
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { RateLimiter } from "@/lib/security"
import { authLogger } from "@/lib/utils/logger"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"
import { getClientIp } from "@/lib/api/get-client-ip"
import { isAuthError } from "@/lib/error-handling/auth-error"

async function handleGet(request: NextRequest) {
  const clientIP = getClientIp(request)

  try {
    // 速率限制检查 - 每个IP每分钟最多20次管理员检查
    if (!RateLimiter.checkRateLimit(`admin-check:${clientIP}`, 20, 60 * 1000)) {
      authLogger.warn("管理员权限检查触发速率限制", { clientIP })
      return NextResponse.json(
        {
          success: false,
          error: "rate_limit_exceeded",
          message: "请求过于频繁，请稍后再试",
        },
        { status: 429 }
      )
    }

    // 验证管理员权限
    const adminUser = await requireAdmin()
    return NextResponse.json(
      {
        success: true,
        isAdmin: true,
        data: {
          user: {
            id: adminUser.id,
            email: adminUser.email,
            name: adminUser.name,
            role: adminUser.role,
            status: adminUser.status,
            avatarUrl: adminUser.avatarUrl,
          },
        },
      },
      { status: 200 }
    )
  } catch (error) {
    if (isAuthError(error)) {
      authLogger.warn("管理员权限验证失败", {
        errorCode: error.code,
        message: error.message,
      })

      if (
        error.code === "UNAUTHORIZED" ||
        error.code === "INVALID_TOKEN" ||
        error.code === "SESSION_EXPIRED" ||
        error.code === "INVALID_CREDENTIALS"
      ) {
        return NextResponse.json(
          {
            success: false,
            isAdmin: false,
            error: "not_authenticated",
            message: "用户未登录",
          },
          { status: 401 }
        )
      }

      if (error.code === "FORBIDDEN") {
        return NextResponse.json(
          {
            success: false,
            isAdmin: false,
            error: "insufficient_permissions",
            message: "需要管理员权限",
          },
          { status: 403 }
        )
      }

      if (error.code === "ACCOUNT_BANNED") {
        return NextResponse.json(
          {
            success: false,
            isAdmin: false,
            error: "account_banned",
            message: "账户已被封禁",
          },
          { status: 403 }
        )
      }
    } else {
      const errorMessage = error instanceof Error ? error.message : "未知错误"
      authLogger.warn("管理员权限验证失败", { error: errorMessage })
    }

    // 其他服务器错误
    authLogger.error("管理员权限检查 API 异常", { clientIP }, error)
    return NextResponse.json(
      {
        success: false,
        isAdmin: false,
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
