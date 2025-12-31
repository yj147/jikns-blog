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

const AUTH_SESSION_SYNC_COOKIE = "auth_session_sync"

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

        const response = NextResponse.redirect(
          new URL(
            `/login?error=${errorMessage}&message=${encodeURIComponent(exchangeError.message)}`,
            requestUrl.origin
          )
        )
        return response
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
          // 传递 identities 以获取完整的 OAuth 数据（user_metadata 可能不完整）
          const syncedUser = await syncUserFromAuth({
            id: session.user.id,
            email: session.user.email,
            user_metadata: session.user.user_metadata,
            identities: session.user.identities,
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

          const response = NextResponse.redirect(new URL(finalRedirect, requestUrl.origin))
          // 提示客户端在下一次渲染时从服务端 Cookie 同步 Supabase session（仅短暂有效）
          response.cookies.set({
            name: AUTH_SESSION_SYNC_COOKIE,
            value: "1",
            httpOnly: false,
            sameSite: "lax",
            secure: requestUrl.protocol === "https:",
            path: "/",
            maxAge: 60,
          })
          return response
        } catch (syncError) {
          authLogger.error("用户数据同步失败", { userId: session.user.id }, syncError)

          // 同步失败，禁止继续登录，提示用户重新尝试
          const message =
            syncError instanceof Error ? syncError.message : "用户数据同步失败，请重试"
          const response = NextResponse.redirect(
            new URL(
              `/login?error=sync_failed&message=${encodeURIComponent(message)}`,
              requestUrl.origin
            )
          )
          return response
        }
      } else {
        authLogger.error("授权码交换成功但会话中没有用户信息")
        const response = NextResponse.redirect(
          new URL("/login?error=no_user_data", requestUrl.origin)
        )
        return response
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
  return NextResponse.redirect(new URL("/login?error=missing_code", requestUrl.origin))
}
