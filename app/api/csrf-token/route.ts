/**
 * CSRF 令牌 API 路由
 * Phase 4.1 安全性增强 - 为客户端提供 CSRF 令牌
 */

import { NextRequest, NextResponse } from "next/server"
import { CSRFProtection } from "@/lib/security"

/**
 * 获取 CSRF 令牌
 */
export async function GET(request: NextRequest) {
  try {
    const response = NextResponse.json({
      token: CSRFProtection.generateToken(),
      message: "CSRF 令牌生成成功",
    })

    // 设置 CSRF Cookie
    CSRFProtection.setCsrfCookie(response)

    return response
  } catch (error) {
    console.error("生成 CSRF 令牌失败:", error)

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
export async function POST(request: NextRequest) {
  try {
    const isValid = CSRFProtection.validateToken(request)

    return NextResponse.json({
      valid: isValid,
      message: isValid ? "CSRF 令牌验证成功" : "CSRF 令牌验证失败",
    })
  } catch (error) {
    console.error("验证 CSRF 令牌失败:", error)

    return NextResponse.json(
      {
        error: "验证 CSRF 令牌失败",
        code: "CSRF_VALIDATION_FAILED",
      },
      { status: 500 }
    )
  }
}
