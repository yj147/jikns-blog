/**
 * 管理员权限验证 API
 * Phase 2: 专门验证用户是否具有管理员权限
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { RateLimiter } from "@/lib/security"

export async function GET(request: NextRequest) {
  const clientIP =
    request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"

  try {
    // 速率限制检查 - 每个IP每分钟最多20次管理员检查
    if (!RateLimiter.checkRateLimit(`admin-check:${clientIP}`, 20, 60 * 1000)) {
      console.warn(`管理员权限检查速率限制触发，IP: ${clientIP}`)
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
    const errorMessage = error instanceof Error ? error.message : "未知错误"

    console.warn("管理员权限验证失败:", errorMessage)

    // 根据错误类型返回适当的响应
    if (errorMessage.includes("未登录") || errorMessage.includes("用户未登录")) {
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

    if (errorMessage.includes("管理员权限")) {
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

    if (errorMessage.includes("封禁")) {
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

    // 其他服务器错误
    console.error("管理员权限检查API异常:", error)
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
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: "method_not_allowed",
      message: "此端点仅支持 GET 请求",
    },
    { status: 405 }
  )
}
