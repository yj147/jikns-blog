/**
 * CSRF 令牌 API 路由
 * Phase 4.1 安全性增强 - 为客户端提供 CSRF 令牌
 */

import { NextRequest, NextResponse } from "next/server"
import { CSRFProtection } from "@/lib/security"
import { logger } from "@/lib/utils/logger"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"

/**
 * 获取 CSRF 令牌
 * 复用已有 Cookie token 避免多标签页竞态问题
 */
async function handleGet(request: NextRequest) {
  try {
    const refreshRequested = request.nextUrl.searchParams.get("refresh") === "1"
    const existingToken = request.cookies.get("csrf-token")?.value

    // 只有在显式请求刷新或没有现有 token 时才生成新 token
    const token = !refreshRequested && existingToken ? existingToken : CSRFProtection.generateToken()
    const rotated = !existingToken || refreshRequested

    const response = NextResponse.json({
      token,
      rotated,
      message: rotated ? "CSRF 令牌生成成功" : "CSRF 令牌复用成功",
    })

    // 设置/续期 CSRF Cookie
    CSRFProtection.setCsrfCookie(response, token)

    return response
  } catch (error) {
    logger.error("生成 CSRF 令牌失败", { module: "api/csrf-token" }, error)

    return NextResponse.json(
      {
        error: "生成 CSRF 令牌失败",
        code: "CSRF_GENERATION_FAILED",
      },
      { status: 500 }
    )
  }
}

/**
 * 验证 CSRF 令牌
 */
async function handlePost(request: NextRequest) {
  try {
    const isValid = CSRFProtection.validateToken(request)

    return NextResponse.json({
      valid: isValid,
      message: isValid ? "CSRF 令牌验证成功" : "CSRF 令牌验证失败",
    })
  } catch (error) {
    logger.error("验证 CSRF 令牌失败", { module: "api/csrf-token" }, error)

    return NextResponse.json(
      {
        error: "验证 CSRF 令牌失败",
        code: "CSRF_VALIDATION_FAILED",
      },
      { status: 500 }
    )
  }
}

export const GET = withApiResponseMetrics(handleGet)
export const POST = withApiResponseMetrics(handlePost)
