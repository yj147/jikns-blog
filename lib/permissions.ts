/**
 * 权限验证工具函数
 * 提供认证检查、角色验证和状态检查的核心函数
 */

import { getCurrentUser, getAuthenticatedUser } from "./auth"
import type { User } from "./generated/prisma"

// 权限缓存类型定义
interface PermissionCacheEntry {
  user: User | null
  timestamp: number
}

// 内存缓存（用于性能优化）
const userPermissionCache = new Map<string, PermissionCacheEntry>()
const CACHE_DURATION = 5 * 60 * 1000 // 5分钟缓存

/**
 * 清除权限缓存
 */
export function clearPermissionCache(userId?: string) {
  if (userId) {
    userPermissionCache.delete(userId)
  } else {
    userPermissionCache.clear()
  }
}

/**
 * 获取缓存的用户信息
 * 使用经过身份验证的用户数据确保安全性
 */
async function getCachedUser(): Promise<User | null> {
  const { user: authUser } = await getAuthenticatedUser()

  if (!authUser?.id) {
    return null
  }

  const userId = authUser.id
  const now = Date.now()
  const cached = userPermissionCache.get(userId)

  // 检查缓存是否有效
  if (cached && now - cached.timestamp < CACHE_DURATION) {
    return cached.user
  }

  // 获取最新用户信息
  const user = await getCurrentUser()

  // 更新缓存
  userPermissionCache.set(userId, {
    user,
    timestamp: now,
  })

  return user
}

/**
 * 验证用户是否已认证（带缓存优化）
 * 检查用户登录状态和账户状态
 */
export async function requireAuth(): Promise<User> {
  const user = await getCachedUser()

  if (!user) {
    throw new Error("用户未登录")
  }

  if (user.status !== "ACTIVE") {
    // 清除被封禁用户的缓存
    clearPermissionCache(user.id)
    throw new Error("账户已被封禁")
  }

  return user
}

/**
 * 验证用户是否为管理员（带缓存优化）
 * 检查用户登录状态、账户状态和管理员权限
 */
export async function requireAdmin(): Promise<User> {
  const user = await getCachedUser()

  if (!user) {
    throw new Error("未登录用户")
  }

  if (user.role !== "ADMIN") {
    throw new Error("需要管理员权限")
  }

  if (user.status !== "ACTIVE") {
    // 清除被封禁管理员的缓存
    clearPermissionCache(user.id)
    throw new Error("账户已被封禁")
  }

  return user
}

/**
 * 检查用户状态（不抛出异常，返回检查结果）
 */
export async function checkUserStatus(): Promise<{
  isAuthenticated: boolean
  isAdmin: boolean
  isActive: boolean
  user: User | null
  error?: string
}> {
  try {
    const user = await getCachedUser()

    if (!user) {
      return {
        isAuthenticated: false,
        isAdmin: false,
        isActive: false,
        user: null,
        error: "用户未登录",
      }
    }

    const isActive = user.status === "ACTIVE"
    const isAdmin = user.role === "ADMIN" && isActive

    return {
      isAuthenticated: true,
      isAdmin,
      isActive,
      user,
      error: isActive ? undefined : "账户已被封禁",
    }
  } catch (error) {
    return {
      isAuthenticated: false,
      isAdmin: false,
      isActive: false,
      user: null,
      error: error instanceof Error ? error.message : "权限检查失败",
    }
  }
}

/**
 * 检查用户是否可以访问指定资源
 */
export async function canAccessResource(resource: string): Promise<boolean> {
  try {
    const { isAuthenticated, isAdmin, isActive } = await checkUserStatus()

    // 未认证用户只能访问公开资源
    if (!isAuthenticated) {
      return isPublicResource(resource)
    }

    // 被封禁用户无法访问任何受保护资源
    if (!isActive) {
      return isPublicResource(resource)
    }

    // 管理员可以访问所有资源
    if (isAdmin) {
      return true
    }

    // 普通用户可以访问非管理员资源
    return !isAdminResource(resource)
  } catch (error) {
    console.error("资源访问检查失败:", error)
    return false
  }
}

/**
 * 判断是否为公开资源
 */
function isPublicResource(resource: string): boolean {
  const publicResources = ["/", "/blog", "/search", "/login", "/register", "/auth", "/unauthorized"]

  return publicResources.some((path) => resource === path || resource.startsWith(path + "/"))
}

/**
 * 判断是否为管理员资源
 */
function isAdminResource(resource: string): boolean {
  const adminResources = [
    "/admin",
    "/api/admin",
    "admin:", // 用于基于前缀的权限检查
  ]

  return adminResources.some((path) => resource.startsWith(path))
}

/**
 * 获取当前用户的权限摘要
 */
export async function getUserPermissions(): Promise<{
  canCreatePost: boolean
  canManageUsers: boolean
  canManagePosts: boolean
  canAccessAdmin: boolean
  canComment: boolean
  canLike: boolean
  canFollow: boolean
}> {
  const { isAuthenticated, isAdmin, isActive } = await checkUserStatus()

  return {
    // 文章管理权限（仅管理员）
    canCreatePost: isAdmin,
    canManagePosts: isAdmin,

    // 用户管理权限（仅管理员）
    canManageUsers: isAdmin,
    canAccessAdmin: isAdmin,

    // 用户交互权限（需要活跃状态）
    canComment: isAuthenticated && isActive,
    canLike: isAuthenticated && isActive,
    canFollow: isAuthenticated && isActive,
  }
}

/**
 * 权限装饰器 - 用于包装 Server Actions
 */
export function withAuth<T extends any[], R>(action: (...args: T) => Promise<R>) {
  return async (...args: T): Promise<R> => {
    await requireAuth()
    return action(...args)
  }
}

/**
 * 管理员权限装饰器 - 用于包装 Server Actions
 */
export function withAdminAuth<T extends any[], R>(action: (...args: T) => Promise<R>) {
  return async (...args: T): Promise<R> => {
    await requireAdmin()
    return action(...args)
  }
}

/**
 * 性能优化的批量权限检查
 */
export async function batchPermissionCheck(resources: string[]): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {}

  // 一次性获取用户状态，避免重复查询
  const { isAuthenticated, isAdmin, isActive } = await checkUserStatus()

  for (const resource of resources) {
    if (!isAuthenticated) {
      results[resource] = isPublicResource(resource)
    } else if (!isActive) {
      results[resource] = isPublicResource(resource)
    } else if (isAdmin) {
      results[resource] = true
    } else {
      results[resource] = !isAdminResource(resource)
    }
  }

  return results
}

/**
 * 创建权限错误响应
 */
export function createPermissionError(
  type: "AUTHENTICATION_REQUIRED" | "INSUFFICIENT_PERMISSIONS" | "ACCOUNT_BANNED",
  resource?: string
) {
  const messages = {
    AUTHENTICATION_REQUIRED: "此操作需要用户登录",
    INSUFFICIENT_PERMISSIONS: "权限不足，无法执行此操作",
    ACCOUNT_BANNED: "账户已被封禁，无法执行操作",
  }

  const statusCodes = {
    AUTHENTICATION_REQUIRED: 401,
    INSUFFICIENT_PERMISSIONS: 403,
    ACCOUNT_BANNED: 403,
  }

  return {
    error: messages[type],
    code: type,
    resource,
    statusCode: statusCodes[type],
    timestamp: new Date().toISOString(),
  }
}

/**
 * API 路由权限验证中间件
 */
export async function validateApiPermissions(
  request: Request,
  requiredPermission: "auth" | "admin"
): Promise<{ success: boolean; error?: any; user?: User }> {
  try {
    if (requiredPermission === "admin") {
      const user = await requireAdmin()
      return { success: true, user }
    } else {
      const user = await requireAuth()
      return { success: true, user }
    }
  } catch (error) {
    const message = (error as Error).message

    if (message === "用户未登录" || message === "未登录用户") {
      return {
        success: false,
        error: createPermissionError("AUTHENTICATION_REQUIRED"),
      }
    }

    if (message === "需要管理员权限") {
      return {
        success: false,
        error: createPermissionError("INSUFFICIENT_PERMISSIONS"),
      }
    }

    if (message === "账户已被封禁") {
      return {
        success: false,
        error: createPermissionError("ACCOUNT_BANNED"),
      }
    }

    return {
      success: false,
      error: {
        error: "权限验证失败",
        code: "PERMISSION_CHECK_FAILED",
        statusCode: 500,
        timestamp: new Date().toISOString(),
      },
    }
  }
}
