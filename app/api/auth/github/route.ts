/**
 * GitHub OAuth 登录启动 API
 * Phase 2: 启动 GitHub OAuth 认证流程
 */

import { NextRequest, NextResponse } from "next/server"
import { createRouteHandlerClient } from "@/lib/supabase"
import { validateRedirectUrl } from "@/lib/auth"
import { RateLimiter } from "@/lib/security"
import { authLogger } from "@/lib/utils/logger"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"

async function handlePost(request: NextRequest) {
  const clientIP =
    request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"

  try {
    // 速率限制检查 - 每个IP每分钟最多5次OAuth启动请求
    if (!RateLimiter.checkRateLimit(`github-oauth:${clientIP}`, 5, 60 * 1000)) {
      authLogger.warn("GitHub OAuth 启动速率限制触发", { clientIP })
      return NextResponse.json(
        {
          success: false,
          error: "rate_limit_exceeded",
          message: "OAuth请求过于频繁，请稍后再试",
        },
        { status: 429 }
      )
    }

    // 解析请求体
    const body = await request.json().catch(() => ({}))
    const redirectTo = body.redirectTo || "/"

    // 验证重定向URL安全性
    const safeRedirectTo = validateRedirectUrl(redirectTo) ? redirectTo : "/"

    // 创建 Supabase 客户端
    const supabase = await createRouteHandlerClient()
    // 构建 OAuth 重定向 URL
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
    const callbackUrl = `${baseUrl}/auth/callback`
    const finalCallbackUrl =
      safeRedirectTo !== "/"
        ? `${callbackUrl}?redirect_to=${encodeURIComponent(safeRedirectTo)}`
        : callbackUrl

    // 使用 Supabase 启动 GitHub OAuth
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: finalCallbackUrl,
        scopes: "read:user user:email", // 请求基本用户信息和邮箱权限
      },
    })

    if (error) {
      authLogger.error("GitHub OAuth 启动失败", { clientIP }, error)

      let errorMessage = "OAuth启动失败"
      let errorCode = "oauth_start_failed"

      if (error.message.includes("Provider not enabled")) {
        errorMessage = "GitHub登录功能未启用"
        errorCode = "provider_disabled"
      } else if (error.message.includes("Invalid configuration")) {
        errorMessage = "OAuth配置错误"
        errorCode = "configuration_error"
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

    if (!data.url) {
      authLogger.error("OAuth 响应中没有重定向 URL", { clientIP })
      return NextResponse.json(
        {
          success: false,
          error: "no_redirect_url",
          message: "OAuth重定向URL生成失败",
        },
        { status: 500 }
      )
    }
    // 返回OAuth重定向URL
    return NextResponse.json(
      {
        success: true,
        data: {
          url: data.url,
          provider: "github",
          redirectTo: safeRedirectTo,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    authLogger.error("GitHub OAuth API 异常", { clientIP }, error)

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

// 支持 GET 请求以便直接重定向
async function handleGet(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const redirectTo = url.searchParams.get("redirect_to") || "/"

    // 验证重定向URL安全性
    const safeRedirectTo = validateRedirectUrl(redirectTo) ? redirectTo : "/"

    // 创建 Supabase 客户端
    const supabase = await createRouteHandlerClient()
    // 构建回调URL
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
    const callbackUrl = `${baseUrl}/auth/callback`
    const finalCallbackUrl =
      safeRedirectTo !== "/"
        ? `${callbackUrl}?redirect_to=${encodeURIComponent(safeRedirectTo)}`
        : callbackUrl

    // 启动OAuth并直接重定向
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: finalCallbackUrl,
        scopes: "read:user user:email",
      },
    })

    if (error || !data.url) {
      authLogger.error("GitHub OAuth 重定向失败", { redirectTo: safeRedirectTo }, error)
      return NextResponse.redirect(new URL(`/login?error=oauth_start_failed`, request.url))
    }

    // 直接重定向到GitHub OAuth页面
    return NextResponse.redirect(data.url)
  } catch (error) {
    authLogger.error("GitHub OAuth 重定向异常", {}, error)
    return NextResponse.redirect(new URL("/login?error=oauth_redirect_failed", request.url))
  }
}

export const POST = withApiResponseMetrics(handlePost)
export const GET = withApiResponseMetrics(handleGet)
