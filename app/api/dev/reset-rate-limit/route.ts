/**
 * 开发环境速率限制重置工具
 * 仅在开发环境可用，用于快速重置速率限制记录
 */

import { NextRequest, NextResponse } from "next/server"
import { RateLimiter } from "@/lib/security"

export async function POST(request: NextRequest) {
  // 仅在开发环境开放此API
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      {
        error: "此API仅在开发环境可用",
        code: "DEVELOPMENT_ONLY",
      },
      { status: 403 }
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const { identifier } = body

    if (identifier) {
      // 重置特定标识符的速率限制
      RateLimiter.resetRateLimit(identifier)
      return NextResponse.json({
        success: true,
        message: `已重置标识符 ${identifier} 的速率限制记录`,
        action: "reset_specific",
        identifier,
      })
    } else {
      // 重置所有速率限制记录
      RateLimiter.resetAllRateLimits()
      return NextResponse.json({
        success: true,
        message: "已重置所有速率限制记录",
        action: "reset_all",
      })
    }
  } catch (error) {
    console.error("重置速率限制失败:", error)
    return NextResponse.json(
      {
        error: "重置速率限制失败",
        code: "RESET_FAILED",
        details: error instanceof Error ? error.message : "未知错误",
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  // 仅在开发环境开放此API
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      {
        error: "此API仅在开发环境可用",
        code: "DEVELOPMENT_ONLY",
      },
      { status: 403 }
    )
  }

  return NextResponse.json({
    message: "开发环境速率限制重置工具",
    usage: {
      reset_all: "POST /api/dev/reset-rate-limit (无body)",
      reset_specific: 'POST /api/dev/reset-rate-limit (body: {"identifier": "IP地址"})',
    },
    note: "此API仅在开发环境可用，生产环境将返回403",
  })
}
