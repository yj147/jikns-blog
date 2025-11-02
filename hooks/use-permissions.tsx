/**
 * 权限管理 Hook
 * 提供前端权限检查的便捷方法
 */

"use client"

import React from "react"
import { useAuth } from "@/app/providers/auth-provider"
import type { User } from "@/lib/generated/prisma"

/**
 * 权限状态类型
 */
export interface PermissionState {
  // 认证状态
  isAuthenticated: boolean
  isLoading: boolean
  user: User | null

  // 用户状态
  isActive: boolean
  isBanned: boolean

  // 角色权限
  isAdmin: boolean
  isUser: boolean

  // 功能权限
  canCreatePost: boolean
  canManagePosts: boolean
  canManageUsers: boolean
  canAccessAdmin: boolean
  canComment: boolean
  canLike: boolean
  canFollow: boolean

  // 资源权限检查方法
  canAccessResource: (resource: string) => boolean
  canPerformAction: (action: string, resource?: string) => boolean
}

/**
 * 使用权限状态 Hook
 */
export function usePermissions(): PermissionState {
  const { user, isLoading } = useAuth()

  // 基础状态计算
  const isAuthenticated = !isLoading && !!user
  const isActive = isAuthenticated && user!.status === "ACTIVE"
  const isBanned = isAuthenticated && user!.status === "BANNED"
  const isAdmin = isAuthenticated && user!.role === "ADMIN" && isActive
  const isUser = isAuthenticated && user!.role === "USER" && isActive

  // 功能权限计算
  const permissions = React.useMemo(() => {
    return {
      // 文章管理权限（仅管理员）
      canCreatePost: isAdmin,
      canManagePosts: isAdmin,

      // 用户管理权限（仅管理员）
      canManageUsers: isAdmin,
      canAccessAdmin: isAdmin,

      // 用户交互权限（需要活跃状态）
      canComment: isActive,
      canLike: isActive,
      canFollow: isActive,
    }
  }, [isAdmin, isActive])

  // 资源权限检查方法
  const canAccessResource = React.useCallback(
    (resource: string): boolean => {
      // 公开资源
      const publicResources = [
        "/",
        "/blog",
        "/search",
        "/login",
        "/register",
        "/auth",
        "/unauthorized",
      ]

      const isPublicResource = publicResources.some(
        (path) => resource === path || resource.startsWith(path + "/")
      )

      if (isPublicResource) {
        return true
      }

      // 管理员资源
      const adminResources = ["/admin", "/api/admin"]
      const isAdminResource = adminResources.some((path) => resource.startsWith(path))

      if (isAdminResource) {
        return isAdmin
      }

      // 需要认证的资源
      const authResources = ["/profile", "/settings", "/api/user"]
      const isAuthResource = authResources.some((path) => resource.startsWith(path))

      if (isAuthResource) {
        return isActive
      }

      // 默认允许访问
      return true
    },
    [isAdmin, isActive]
  )

  // 操作权限检查方法
  const canPerformAction = React.useCallback(
    (action: string, resource?: string): boolean => {
      switch (action) {
        case "create:post":
        case "edit:post":
        case "delete:post":
        case "publish:post":
          return permissions.canManagePosts

        case "manage:user":
        case "ban:user":
        case "unban:user":
          return permissions.canManageUsers

        case "access:admin":
          return permissions.canAccessAdmin

        case "comment":
          return permissions.canComment

        case "like":
        case "unlike":
          return permissions.canLike

        case "follow":
        case "unfollow":
          return permissions.canFollow

        case "edit:profile":
        case "change:settings":
          return isActive

        default:
          // 未知操作，基于资源权限检查
          return resource ? canAccessResource(resource) : isActive
      }
    },
    [permissions, isActive, canAccessResource]
  )

  return {
    // 认证状态
    isAuthenticated,
    isLoading,
    user,

    // 用户状态
    isActive,
    isBanned,

    // 角色权限
    isAdmin,
    isUser,

    // 功能权限
    ...permissions,

    // 权限检查方法
    canAccessResource,
    canPerformAction,
  }
}

/**
 * 权限守卫 Hook
 * 用于在组件中进行权限检查和处理
 */
export function usePermissionGuard() {
  const permissions = usePermissions()

  /**
   * 检查权限并执行回调
   */
  const checkPermission = React.useCallback(
    (
      permission: keyof Omit<PermissionState, "canAccessResource" | "canPerformAction"> | string,
      onAllowed?: () => void,
      onDenied?: (reason: string) => void
    ) => {
      let hasPermission = false
      let reason = "权限不足"

      if (typeof permission === "string") {
        // 自定义权限检查
        if (permission.includes(":")) {
          const [action, resource] = permission.split(":")
          hasPermission = permissions.canPerformAction(action, resource)
        } else {
          hasPermission = permissions.canAccessResource(permission)
        }
      } else {
        // 预定义权限检查
        hasPermission = Boolean(permissions[permission])

        if (!permissions.isAuthenticated) {
          reason = "需要登录"
        } else if (permissions.isBanned) {
          reason = "账户已被封禁"
        } else if (!hasPermission) {
          reason = "权限不足"
        }
      }

      if (hasPermission) {
        onAllowed?.()
      } else {
        onDenied?.(reason)
      }

      return hasPermission
    },
    [permissions]
  )

  /**
   * 创建受保护的处理函数
   */
  const createProtectedHandler = React.useCallback(
    (
      permission: keyof Omit<PermissionState, "canAccessResource" | "canPerformAction"> | string,
      handler: () => void,
      onDenied?: (reason: string) => void
    ) => {
      return () => checkPermission(permission, handler, onDenied)
    },
    [checkPermission]
  )

  return {
    ...permissions,
    checkPermission,
    createProtectedHandler,
  }
}

/**
 * 条件权限组件
 * 根据权限条件渲染不同内容
 */
interface ConditionalPermissionProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  permission: keyof Omit<PermissionState, "canAccessResource" | "canPerformAction"> | string
}

export function ConditionalPermission({
  children,
  fallback = null,
  permission,
}: ConditionalPermissionProps) {
  const permissions = usePermissions()

  const hasPermission = React.useMemo(() => {
    if (typeof permission === "string") {
      if (permission.includes(":")) {
        const [action, resource] = permission.split(":")
        return permissions.canPerformAction(action, resource)
      } else {
        return permissions.canAccessResource(permission)
      }
    } else {
      return Boolean(permissions[permission])
    }
  }, [permission, permissions])

  if (hasPermission) {
    return <>{children}</>
  }
  return <>{fallback}</>
}

/**
 * 多权限条件组件
 * 支持复杂的权限组合判断
 */
interface MultiPermissionProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  permissions: Array<keyof Omit<PermissionState, "canAccessResource" | "canPerformAction"> | string>
  requireAll?: boolean
}

export function MultiPermission({
  children,
  fallback = null,
  permissions: permissionList,
  requireAll = true,
}: MultiPermissionProps) {
  const permissions = usePermissions()

  const hasPermission = React.useMemo(() => {
    const checks = permissionList.map((permission) => {
      if (typeof permission === "string") {
        if (permission.includes(":")) {
          const [action, resource] = permission.split(":")
          return permissions.canPerformAction(action, resource)
        } else {
          return permissions.canAccessResource(permission)
        }
      } else {
        return Boolean(permissions[permission])
      }
    })

    return requireAll ? checks.every((check) => check) : checks.some((check) => check)
  }, [permissionList, permissions, requireAll])

  if (hasPermission) {
    return <>{children}</>
  }
  return <>{fallback}</>
}
