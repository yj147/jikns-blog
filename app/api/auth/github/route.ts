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
import { getClientIp } from "@/lib/api/get-client-ip"

const AUTH_REDIRECT_COOKIE = "auth_redirect_to"

function resolveAuthBaseUrl(request: NextRequest): string {
  // OAuth callback 必须落回 Supabase allowlist 允许的域名。
  // - Preview: 允许用 NEXT_PUBLIC_SITE_URL 固定回调域名（避免随机 deployment 域名不在 allowlist）
  // - Production: 站点对外可能是 www 域，但 Supabase Site URL 常配根域（无 www），需归一化
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

function setAuthRedirectCookie(
  response: NextResponse,
  request: NextRequest,
  redirectTo: string
): void {
  if (!redirectTo || redirectTo === "/") return

  const { hostname, protocol } = new URL(request.url)
  const domain =
    hostname === "jikns666.xyz" || hostname.endsWith(".jikns666.xyz") ? ".jikns666.xyz" : undefined

  response.cookies.set({
    name: AUTH_REDIRECT_COOKIE,
    value: redirectTo,
    httpOnly: true,
    sameSite: "lax",
    secure: protocol === "https:",
    path: "/",
    maxAge: 60 * 5,
    ...(domain ? { domain } : {}),
  })
}

async function handlePost(request: NextRequest) {
  const clientIP = getClientIp(request)

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
    const baseUrl = resolveAuthBaseUrl(request)
    const callbackUrl = new URL(`${baseUrl}/auth/callback`)

    // 使用 Supabase 启动 GitHub OAuth
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: callbackUrl.toString(),
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
    // 返回 OAuth 重定向 URL
    const response = NextResponse.json(
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
    setAuthRedirectCookie(response, request, safeRedirectTo)
    return response
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
    // 构建回调 URL
    const baseUrl = resolveAuthBaseUrl(request)
    const callbackUrl = new URL(`${baseUrl}/auth/callback`)

    // 启动OAuth并直接重定向
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: callbackUrl.toString(),
        scopes: "read:user user:email",
      },
    })

    if (error || !data.url) {
      authLogger.error("GitHub OAuth 重定向失败", { redirectTo: safeRedirectTo }, error)
      return NextResponse.redirect(new URL(`/login?error=oauth_start_failed`, request.url))
    }

    // 直接重定向到 GitHub OAuth 页面
    const response = NextResponse.redirect(data.url)
    setAuthRedirectCookie(response, request, safeRedirectTo)
    return response
  } catch (error) {
    authLogger.error("GitHub OAuth 重定向异常", {}, error)
    return NextResponse.redirect(new URL("/login?error=oauth_redirect_failed", request.url))
  }
}

export const POST = withApiResponseMetrics(handlePost)
export const GET = withApiResponseMetrics(handleGet)
