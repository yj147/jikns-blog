/**
 * 认证工具函数
 * 支持 Server Components 和 Server Actions 中的用户认证
 */

import { cache } from "react"
import { createServerSupabaseClient } from "./supabase"
import { prisma } from "./prisma"
import type { User } from "./generated/prisma"
import { authLogger } from "./utils/logger"
import { assertPolicy, fetchSessionUserProfile, type PolicyUserMap } from "@/lib/auth/session"
import { AuthErrors, type AuthError } from "@/lib/error-handling/auth-error"
import { signAvatarUrl, signCoverImageUrl } from "@/lib/storage/signed-url"

export { syncUserFromAuth, clearUserCache, isConfiguredAdminEmail } from "@/lib/auth/session"

const isTestEnv = process.env.NODE_ENV === "test"

async function shouldSkipAuthLookup(): Promise<boolean> {
  try {
    const { cookies } = await import("next/headers")
    const cookieStore = await cookies()
    const hasSessionCookie = cookieStore
      .getAll()
      .some((cookie) => isSupabaseAuthCookie(cookie.name))

    return !hasSessionCookie
  } catch {
    // 测试或脚本环境中无法访问 cookies 时维持原有逻辑
    return false
  }
}

function isSupabaseAuthCookie(name: string): boolean {
  if (!name || !name.startsWith("sb-")) return false
  return (
    name.endsWith("-auth-token") ||
    name.endsWith("-auth-token.0") ||
    name.endsWith("-auth-token.1") ||
    name.endsWith("-refresh-token")
  )
}

function isSessionMissingError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const { name, message, code } = error as { name?: string; message?: string; code?: string }
  const normalizedMessage = (message || "").toLowerCase()

  return (
    name === "AuthSessionMissingError" ||
    code === "auth_session_missing" ||
    normalizedMessage.includes("auth session missing")
  )
}

function logSessionMissing(stage: string) {
  authLogger.debug("Supabase 会话缺失，返回匿名状态", { stage })
}

/**
 * 获取当前认证用户（Server Components 专用）
 * 安全性增强: 使用 getUser() 替代 getSession() 来获取经过验证的用户数据
 * 使用 React cache 优化，在同一请求中避免重复查询
 */
const getAuthenticatedUserImpl = async () => {
  if (await shouldSkipAuthLookup()) {
    return { user: null, error: null }
  }

  const supabase = await createServerSupabaseClient()

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error) {
      if (isSessionMissingError(error)) {
        logSessionMissing("getAuthenticatedUser")
        return { user: null, error: null }
      }

      authLogger.error("获取认证用户失败", { stage: "getAuthenticatedUser" }, error)
      return { user: null, error }
    }

    return { user, error: null }
  } catch (error) {
    if (isSessionMissingError(error)) {
      logSessionMissing("getAuthenticatedUser")
      return { user: null, error: null }
    }

    authLogger.error("用户认证查询异常", { stage: "getAuthenticatedUser" }, error)
    return { user: null, error }
  }
}

export const getAuthenticatedUser = isTestEnv
  ? getAuthenticatedUserImpl
  : cache(getAuthenticatedUserImpl)

/**
 * 获取当前用户会话（兼容性保留）
 * @deprecated 建议使用 getAuthenticatedUser() 获取经过验证的用户数据
 */
const getUserSessionImpl = async () => {
  if (await shouldSkipAuthLookup()) {
    return { session: null, error: null }
  }

  const supabase = await createServerSupabaseClient()

  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession()

    if (error) {
      if (isSessionMissingError(error)) {
        logSessionMissing("getUserSession")
        return { session: null, error: null }
      }

      authLogger.error("获取会话失败", { stage: "getUserSession" }, error)
      return { session: null, error }
    }

    return { session, error: null }
  } catch (error) {
    if (isSessionMissingError(error)) {
      logSessionMissing("getUserSession")
      return { session: null, error: null }
    }

    authLogger.error("会话查询异常", { stage: "getUserSession" }, error)
    return { session: null, error }
  }
}

export const getUserSession = isTestEnv ? getUserSessionImpl : cache(getUserSessionImpl)

/**
 * 获取当前用户信息（Server Components 专用）
 * 从数据库获取完整的用户信息，包括权限等业务数据
 * 使用经过身份验证的用户数据确保安全性
 *
 * 注意：不要再使用 React cache 包装该函数，否则会绕过 next/cache 的标签失效机制，
 * 导致用户资料更新后仍然返回旧值。
 */
const getCurrentUserImpl = async (): Promise<User | null> => {
  const user = await fetchSessionUserProfile()
  if (!user) return null

  const [signedAvatarUrl, signedCoverUrl] = await Promise.all([
    signAvatarUrl(user.avatarUrl),
    signCoverImageUrl(user.coverImage),
  ])

  const hydrated = { ...user } as User & { avatarSignedUrl?: string; coverSignedUrl?: string }

  if (signedAvatarUrl) {
    hydrated.avatarUrl = signedAvatarUrl
    hydrated.avatarSignedUrl = signedAvatarUrl
  }

  if (signedCoverUrl) {
    hydrated.coverImage = signedCoverUrl
    hydrated.coverSignedUrl = signedCoverUrl
  }

  return hydrated
}

// 保持无 cache，以便 revalidateTag 能即时生效
export const getCurrentUser = getCurrentUserImpl

/**
 * 验证用户是否为管理员（Server Actions 专用）
 */
export async function requireAdmin(): Promise<PolicyUserMap["admin"]> {
  const [policyUser, policyError] = await assertPolicy("admin", {
    path: "legacy:requireAdmin",
  })

  if (!policyUser || policyError) {
    throwLegacyAuthError(policyError)
  }

  return policyUser
}

/**
 * 验证用户是否已认证（Server Actions 专用）
 */
export async function requireAuth(): Promise<PolicyUserMap["user-active"]> {
  const [policyUser, policyError] = await assertPolicy("user-active", {
    path: "legacy:requireAuth",
  })

  if (!policyUser || policyError) {
    throwLegacyAuthError(policyError)
  }

  return policyUser
}

function throwLegacyAuthError(error: AuthError | null): never {
  if (error?.code === "ACCOUNT_BANNED") {
    throw AuthErrors.accountBanned()
  }

  if (error?.code === "FORBIDDEN") {
    throw AuthErrors.forbidden("需要管理员权限")
  }

  throw AuthErrors.unauthorized()
}

/**
 * 检查邮箱是否已被注册
 */
export async function isEmailRegistered(email: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true },
    })

    return !!user
  } catch (error) {
    authLogger.error("检查邮箱注册状态失败", { email }, error)
    return false
  }
}

/**
 * 生成重定向 URL
 * 使用动态端口感知的回调 URL，支持 Cursor 端口随机化
 */
export function getAuthRedirectUrl(redirect?: string | null): string {
  // 在服务器端使用环境变量，在浏览器端会被客户端逻辑覆盖
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3999"
  const callbackUrl = `${siteUrl}/auth/callback`

  if (redirect && redirect !== "/") {
    return `${callbackUrl}?redirect=${encodeURIComponent(redirect)}`
  }

  return callbackUrl
}

/**
 * 验证重定向 URL 的安全性
 */
export function validateRedirectUrl(url: string): boolean {
  try {
    // 检查空字符串或非字符串
    if (!url || typeof url !== "string" || url.trim() === "") {
      return false
    }

    const trimmedUrl = url.trim()

    // 检查明显无效的URL格式
    if (
      trimmedUrl === "///" ||
      trimmedUrl === "http://" ||
      trimmedUrl === "https://" ||
      (!trimmedUrl.includes("/") && !trimmedUrl.startsWith("http")) // 简单的字符串如 'not-a-url'
    ) {
      return false
    }

    const parsed = new URL(trimmedUrl, process.env.NEXT_PUBLIC_SITE_URL)
    const baseUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000")

    // 只允许同域重定向
    return parsed.origin === baseUrl.origin
  } catch {
    return false
  }
}

export { generateOAuthState, setOAuthStateCookie, validateOAuthState } from "@/lib/auth/oauth-state"
