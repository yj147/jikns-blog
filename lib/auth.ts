/**
 * 认证工具函数
 * 支持 Server Components 和 Server Actions 中的用户认证
 */

import { createServerSupabaseClient } from "./supabase"
import { prisma } from "./prisma"
import { cache } from "react"
import { SessionSecurity } from "./security"
import type { User } from "./generated/prisma"
import { authLogger } from "./utils/logger"
import { performanceMonitor, MetricType } from "@/lib/performance-monitor"
import { assertPolicy, fetchSessionUserProfile } from "@/lib/auth/session"
import type { AuthError } from "@/lib/error-handling/auth-error"
import { signAvatarUrl } from "@/lib/storage/signed-url"

const isTestEnv = process.env.NODE_ENV === "test"

/**
 * Supabase Auth User 类型定义
 * 兼容 Supabase 的 User 类型，支持多种数据源
 */
interface SupabaseUser {
  id: string
  email?: string | null
  user_metadata?: {
    full_name?: string
    avatar_url?: string
    name?: string
    user_name?: string
    picture?: string
  } | null
}

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

export const getAuthenticatedUser = isTestEnv ? getAuthenticatedUserImpl : cache(getAuthenticatedUserImpl)

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
 * 获取用户信息的核心函数（不带缓存）
 */
async function fetchUserFromDatabase(userId: string): Promise<User | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    return user
  } catch (error) {
    authLogger.error("获取用户信息失败", { stage: "fetchUserFromDatabase", userId }, error)
    return null
  }
}

/**
 * 带缓存标签的用户查询函数
 */
const adminEmailList = (process.env.ADMIN_EMAIL || "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean)

export function isConfiguredAdminEmail(email?: string | null): boolean {
  if (!email) return false
  return adminEmailList.includes(email.toLowerCase())
}

/**
 * 获取当前用户信息（Server Components 专用）
 * 从数据库获取完整的用户信息，包括权限等业务数据
 * 使用经过身份验证的用户数据确保安全性
 */
const getCurrentUserImpl = async (): Promise<User | null> => {
  const user = await fetchSessionUserProfile()
  if (!user) return null

  const signedAvatarUrl = await signAvatarUrl(user.avatarUrl)
  if (signedAvatarUrl) {
    return {
      ...user,
      avatarUrl: signedAvatarUrl,
      avatarSignedUrl: signedAvatarUrl,
    } as User & { avatarSignedUrl: string }
  }

  return user
}

export const getCurrentUser = isTestEnv ? getCurrentUserImpl : cache(getCurrentUserImpl)

/**
 * 验证用户是否为管理员（Server Actions 专用）
 */
export async function requireAdmin(): Promise<User> {
  const [policyUser, policyError] = await assertPolicy("admin", {
    path: "legacy:requireAdmin",
  })

  if (!policyUser) {
    throwLegacyAuthError(policyError, "未登录用户")
  }

  const user = await fetchUserFromDatabase(policyUser.id)

  if (!user) {
    throw new Error("未登录用户")
  }

  if (user.role !== "ADMIN") {
    throw new Error("需要管理员权限")
  }

  if (user.status !== "ACTIVE") {
    throw new Error("账户已被封禁")
  }

  return user
}

/**
 * 验证用户是否已认证（Server Actions 专用）
 */
export async function requireAuth(): Promise<User> {
  const [policyUser, policyError] = await assertPolicy("user-active", {
    path: "legacy:requireAuth",
  })

  if (!policyUser) {
    throwLegacyAuthError(policyError, "用户未登录")
  }

  const user = await fetchUserFromDatabase(policyUser.id)

  if (!user) {
    throw new Error("用户未登录")
  }

  if (user.status !== "ACTIVE") {
    throw new Error("账户已被封禁")
  }

  return user
}

function throwLegacyAuthError(error: AuthError | null, unauthorizedMessage: string): never {
  if (error?.code === "ACCOUNT_BANNED") {
    throw new Error("账户已被封禁")
  }

  if (error?.code === "FORBIDDEN") {
    throw new Error("需要管理员权限")
  }

  throw new Error(unauthorizedMessage)
}

/**
 * 增强的用户资料同步函数
 * 在 OAuth 回调或登录时调用，同步头像、昵称和 lastLoginAt
 * 支持 GitHub OAuth 和邮箱认证两种场景
 */
export async function syncUserFromAuth(authUser: SupabaseUser): Promise<User> {
  const timerId = `auth-login-${authUser.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  performanceMonitor.startTimer(timerId, { userId: authUser.id, email: authUser.email })

  let syncedUser: User | null = null
  let errorMessage: string | undefined

  try {
    // 验证邮箱不能为空
    if (!authUser.email) {
      throw new Error("用户邮箱不能为空")
    }

    const currentTime = new Date()
    const grantAdmin = isConfiguredAdminEmail(authUser.email)

    // 从 user_metadata 或 identities 中提取用户信息
    const extractedName = extractUserName(authUser)
    const extractedAvatarUrl = extractAvatarUrl(authUser)

    // 检查用户是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { id: authUser.id },
    })

    if (existingUser) {
      // 复登：智能更新逻辑 - 仅当字段为空时才从 Auth 同步，已有数据优先
      const shouldUpdateName = !existingUser.name && extractedName
      const shouldUpdateAvatar = !existingUser.avatarUrl && extractedAvatarUrl

      const updateData: any = {
        lastLoginAt: currentTime,
      }

      if (shouldUpdateName) {
        updateData.name = extractedName
      }

      if (shouldUpdateAvatar) {
        updateData.avatarUrl = extractedAvatarUrl
      }

      if (grantAdmin && existingUser.role !== "ADMIN") {
        updateData.role = "ADMIN"
      }

      const updatedUser = await prisma.user.update({
        where: { id: authUser.id },
        data: updateData,
      })

      syncedUser = updatedUser
      return updatedUser
    } else {
      // 首登：创建新用户，填入所有可用信息
      const newUser = await prisma.user.create({
        data: {
          id: authUser.id,
          email: authUser.email,
          name: extractedName,
          avatarUrl: extractedAvatarUrl,
          role: grantAdmin ? "ADMIN" : "USER",
          status: "ACTIVE",
          lastLoginAt: currentTime,
        },
      })

      syncedUser = newUser
      return newUser
    }
  } catch (error) {
    authLogger.error("用户数据同步失败", { stage: "syncUserFromAuth", userId: authUser.id }, error)
    errorMessage = error instanceof Error ? error.message : "未知错误"
    throw new Error(`用户数据同步失败: ${errorMessage}`)
  } finally {
    performanceMonitor.endTimer(timerId, MetricType.AUTH_LOGIN_TIME, {
      success: Boolean(syncedUser),
      userId: authUser.id,
      email: authUser.email,
      error: syncedUser ? undefined : errorMessage,
    })
  }
}

/**
 * 从 Supabase Auth 用户数据中提取用户名
 * 优先级: user_metadata.full_name -> user_metadata.name -> user_metadata.user_name -> null
 */
function extractUserName(authUser: SupabaseUser): string | null {
  const metadata = authUser.user_metadata
  if (!metadata) return null

  return metadata.full_name || metadata.name || metadata.user_name || null
}

/**
 * 从 Supabase Auth 用户数据中提取头像 URL
 * 优先级: user_metadata.avatar_url -> user_metadata.picture -> null
 */
function extractAvatarUrl(authUser: SupabaseUser): string | null {
  const metadata = authUser.user_metadata
  if (!metadata) return null

  return metadata.avatar_url || metadata.picture || null
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
