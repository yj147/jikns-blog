/**
 * Supabase Auth 统一回调处理路由
 * Phase 2: 处理 GitHub OAuth 和邮箱认证的回调，支持用户数据同步
 * 路径: /auth/callback (Supabase 标准路径)
 */

import { createRouteHandlerClient } from "@/lib/supabase"
import { syncUserFromAuth, validateRedirectUrl } from "@/lib/auth"
import { revalidateUserProfile } from "@/lib/actions/auth"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { authLogger } from "@/lib/utils/logger"

// 防止重复处理授权码的简单缓存
const processedCodes = new Set<string>()

// 定时清理过期授权码（10分钟后清理）
setInterval(
  () => {
    processedCodes.clear()
  },
  10 * 60 * 1000
)

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const redirectPath =
    requestUrl.searchParams.get("redirect_to") || requestUrl.searchParams.get("redirect") || "/"
  const error = requestUrl.searchParams.get("error")
  const errorDescription = requestUrl.searchParams.get("error_description")
  // 处理 OAuth 认证错误
  if (error) {
    const errorMsg = errorDescription || error
    authLogger.error("OAuth 认证错误", { error, error_description: errorMsg })
    return NextResponse.redirect(
      new URL(`/login?error=oauth_error&message=${encodeURIComponent(errorMsg)}`, requestUrl.origin)
    )
  }

  // 处理授权码交换会话
  if (code) {
    // 防止重复处理
    if (processedCodes.has(code)) {
      const finalRedirect = validateRedirectUrl(redirectPath) ? redirectPath : "/"
      return NextResponse.redirect(new URL(finalRedirect, requestUrl.origin))
    }

    // 标记为已处理
    processedCodes.add(code)

    const supabase = await createRouteHandlerClient()

    try {
      // 使用授权码交换会话
      const {
        data: { session },
        error: exchangeError,
      } = await supabase.auth.exchangeCodeForSession(code)

      if (exchangeError) {
        authLogger.error("授权码交换失败", {}, exchangeError)

        // 特殊处理常见错误
        let errorMessage = "exchange_failed"
        if (
          exchangeError.message.includes("code verifier") ||
          exchangeError.message.includes("PKCE")
        ) {
          errorMessage = "pkce_error"
        } else if (exchangeError.message.includes("expired")) {
          errorMessage = "code_expired"
        }

        return NextResponse.redirect(
          new URL(
            `/login?error=${errorMessage}&message=${encodeURIComponent(exchangeError.message)}`,
            requestUrl.origin
          )
        )
      }

      if (session?.user) {
        // 用户认证成功，记录登录事件
        authLogger.info("用户认证成功", {
          userId: session.user.id,
          email: session.user.email,
          provider: session.user.app_metadata?.provider,
        })

        try {
          // 同步用户数据到数据库
          const syncedUser = await syncUserFromAuth({
            id: session.user.id,
            email: session.user.email,
            user_metadata: session.user.user_metadata,
          })
          // 同步成功后，使用户资料缓存失效，确保页面显示最新数据
          try {
            await revalidateUserProfile()
          } catch (revalidateError) {
            authLogger.warn("缓存刷新失败，但不影响登录", {
              userId: session.user.id,
              error:
                revalidateError instanceof Error
                  ? revalidateError.message
                  : String(revalidateError),
            })
          }

          // 验证重定向 URL 安全性
          const finalRedirect = validateRedirectUrl(redirectPath) ? redirectPath : "/"

          return NextResponse.redirect(new URL(finalRedirect, requestUrl.origin))
        } catch (syncError) {
          authLogger.error("用户数据同步失败", { userId: session.user.id }, syncError)

          // 同步失败但认证成功，允许登录但显示警告
          const warningRedirect = validateRedirectUrl(redirectPath) ? redirectPath : "/"
          return NextResponse.redirect(
            new URL(`${warningRedirect}?message=login_success_sync_warning`, requestUrl.origin)
          )
        }
      } else {
        authLogger.error("授权码交换成功但会话中没有用户信息")
        return NextResponse.redirect(new URL("/login?error=no_user_data", requestUrl.origin))
      }
    } catch (error) {
      authLogger.error("认证回调处理异常", {}, error)
      return NextResponse.redirect(
        new URL(
          `/login?error=callback_error&message=${encodeURIComponent(String(error))}`,
          requestUrl.origin
        )
      )
    }
  }

  // 没有授权码或错误参数，可能是直接访问回调 URL
  authLogger.warn("认证回调缺少必要参数 (code 或 error)")
  return NextResponse.redirect(new URL("/login?error=missing_callback_params", requestUrl.origin))
}
