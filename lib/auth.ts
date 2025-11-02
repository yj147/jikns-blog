/**
 * 认证工具函数
 * 支持 Server Components 和 Server Actions 中的用户认证
 */

import { createServerSupabaseClient } from "./supabase"
import { prisma } from "./prisma"
import { cache } from "react"
import { unstable_cache } from "next/cache"
import { SessionSecurity } from "./security"
import type { User } from "./generated/prisma"

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

/**
 * 获取当前认证用户（Server Components 专用）
 * 安全性增强: 使用 getUser() 替代 getSession() 来获取经过验证的用户数据
 * 使用 React cache 优化，在同一请求中避免重复查询
 */
export const getAuthenticatedUser = cache(async () => {
  const supabase = await createServerSupabaseClient()

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error) {
      console.error("获取认证用户失败:", error)
      return { user: null, error }
    }

    return { user, error: null }
  } catch (error) {
    console.error("用户认证查询异常:", error)
    return { user: null, error }
  }
})

/**
 * 获取当前用户会话（兼容性保留）
 * @deprecated 建议使用 getAuthenticatedUser() 获取经过验证的用户数据
 */
export const getUserSession = cache(async () => {
  const supabase = await createServerSupabaseClient()

  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession()

    if (error) {
      console.error("获取会话失败:", error)
      return { session: null, error }
    }

    return { session, error: null }
  } catch (error) {
    console.error("会话查询异常:", error)
    return { session: null, error }
  }
})

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
    console.error("获取用户信息失败:", error)
    return null
  }
}

/**
 * 带缓存标签的用户查询函数
 */
const getCachedUser = unstable_cache(
  async (userId: string) => fetchUserFromDatabase(userId),
  ["user-profile"],
  {
    tags: ["user:self"],
    revalidate: 300, // 5分钟缓存
  }
)

/**
 * 获取当前用户信息（Server Components 专用）
 * 从数据库获取完整的用户信息，包括权限等业务数据
 * 使用经过身份验证的用户数据确保安全性
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const { user } = await getAuthenticatedUser()

  if (!user?.id) {
    return null
  }

  return await getCachedUser(user.id)
})

/**
 * 验证用户是否为管理员（Server Actions 专用）
 */
export async function requireAdmin(): Promise<User> {
  const user = await getCurrentUser()

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
  const user = await getCurrentUser()

  if (!user) {
    throw new Error("用户未登录")
  }

  if (user.status !== "ACTIVE") {
    throw new Error("账户已被封禁")
  }

  return user
}

/**
 * 增强的用户资料同步函数
 * 在 OAuth 回调或登录时调用，同步头像、昵称和 lastLoginAt
 * 支持 GitHub OAuth 和邮箱认证两种场景
 */
export async function syncUserFromAuth(authUser: SupabaseUser): Promise<User> {
  try {
    // 验证邮箱不能为空
    if (!authUser.email) {
      throw new Error("用户邮箱不能为空")
    }

    const currentTime = new Date()

    // 从 user_metadata 或 identities 中提取用户信息
    const extractedName = extractUserName(authUser)
    const extractedAvatarUrl = extractAvatarUrl(authUser)

    // 检查用户是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { id: authUser.id },
    })

    if (existingUser) {
      // 复登：智能更新逻辑 - 仅当字段为空或有变更时才更新
      const shouldUpdateName =
        !existingUser.name || (extractedName && extractedName !== existingUser.name)
      const shouldUpdateAvatar =
        !existingUser.avatarUrl ||
        (extractedAvatarUrl && extractedAvatarUrl !== existingUser.avatarUrl)

      const updateData: any = {
        lastLoginAt: currentTime,
      }

      if (shouldUpdateName && extractedName) {
        updateData.name = extractedName
      }

      if (shouldUpdateAvatar && extractedAvatarUrl) {
        updateData.avatarUrl = extractedAvatarUrl
      }

      const updatedUser = await prisma.user.update({
        where: { id: authUser.id },
        data: updateData,
      })

      return updatedUser
    } else {
      // 首登：创建新用户，填入所有可用信息
      const newUser = await prisma.user.create({
        data: {
          id: authUser.id,
          email: authUser.email,
          name: extractedName,
          avatarUrl: extractedAvatarUrl,
          role: "USER", // 新用户默认为普通用户
          status: "ACTIVE",
          lastLoginAt: currentTime,
        },
      })

      return newUser
    }
  } catch (error) {
    console.error("用户数据同步失败:", error)
    throw new Error(`用户数据同步失败: ${error instanceof Error ? error.message : "未知错误"}`)
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
    console.error("检查邮箱注册状态失败:", error)
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
