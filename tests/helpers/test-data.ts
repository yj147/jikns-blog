/**
 * 测试数据生成工具
 * 为权限系统测试提供标准化的测试用户和会话数据
 */

import type { TestUser } from "../setup"
import type { Session, User as SupabaseUser } from "@supabase/supabase-js"
import { NextRequest } from "next/server"

// 标准测试用户数据
export const TEST_USERS: Record<string, TestUser> = {
  admin: {
    id: "admin-test-id-001",
    email: "admin@test.com",
    name: "测试管理员",
    role: "ADMIN",
    status: "ACTIVE",
    avatarUrl: "https://avatar.test/admin.jpg",
    lastLoginAt: new Date("2023-08-24T10:00:00Z"),
    createdAt: new Date("2023-01-01T00:00:00Z"),
    updatedAt: new Date("2023-08-24T10:00:00Z"),
  },

  user: {
    id: "user-test-id-001",
    email: "user@test.com",
    name: "测试用户",
    role: "USER",
    status: "ACTIVE",
    avatarUrl: "https://avatar.test/user.jpg",
    lastLoginAt: new Date("2023-08-24T09:00:00Z"),
    createdAt: new Date("2023-02-01T00:00:00Z"),
    updatedAt: new Date("2023-08-24T09:00:00Z"),
  },

  bannedUser: {
    id: "banned-test-id-001",
    email: "banned@test.com",
    name: "被封禁用户",
    role: "USER",
    status: "BANNED",
    avatarUrl: undefined,
    lastLoginAt: new Date("2023-08-20T15:00:00Z"),
    createdAt: new Date("2023-03-01T00:00:00Z"),
    updatedAt: new Date("2023-08-22T10:00:00Z"),
  },
}

/**
 * 创建用于测试的 NextRequest 对象
 * 解决 NextRequest vs Request 类型不匹配问题
 */
export function createTestRequest(
  url: string,
  options: RequestInit & {
    cookies?: Record<string, string>
  } = {}
): NextRequest {
  // 确保在测试环境中有可靠的基础 URL
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

  // 确保 URL 以 / 开头
  const normalizedUrl = url.startsWith("/") ? url : `/${url}`
  const fullUrl = url.startsWith("http") ? url : `${baseUrl}${normalizedUrl}`

  // 处理 cookies 选项
  const { cookies, ...requestOptions } = options

  // 如果有 cookies，将其添加到 headers 中
  if (cookies) {
    const cookieString = Object.entries(cookies)
      .map(([key, value]) => `${key}=${value}`)
      .join("; ")

    requestOptions.headers = {
      ...requestOptions.headers,
      Cookie: cookieString,
    }
  }

  // 清理 options 中的 null 值以符合 Next.js RequestInit 类型
  const cleanOptions: RequestInit = {
    ...requestOptions,
    signal: requestOptions.signal === null ? undefined : requestOptions.signal,
  }

  return new NextRequest(fullUrl, cleanOptions)
}

/**
 * 创建测试用的 Supabase Session
 */
export function createTestSession(userId: string, email: string): Session {
  return {
    access_token: `test-access-token-${userId}`,
    refresh_token: `test-refresh-token-${userId}`,
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user: {
      id: userId,
      email,
      aud: "authenticated",
      role: "authenticated",
      app_metadata: {},
      user_metadata: {
        full_name:
          TEST_USERS[Object.keys(TEST_USERS).find((key) => TEST_USERS[key].id === userId) || "user"]
            ?.name,
      },
      created_at: "2023-01-01T00:00:00Z",
      updated_at: "2023-08-24T10:00:00Z",
      confirmed_at: "2023-01-01T00:00:00Z",
      email_confirmed_at: "2023-01-01T00:00:00Z",
    } as SupabaseUser,
  }
}

/**
 * 创建用于测试的权限路径配置
 */
export const TEST_PATHS = {
  // 公开路径 - 无需认证
  public: ["/", "/blog", "/login", "/register", "/auth/callback"],

  // 认证路径 - 需要登录
  authenticated: ["/profile", "/settings", "/api/user/profile", "/api/user/settings"],

  // 管理员路径 - 需要 ADMIN 权限
  admin: [
    "/admin",
    "/admin/dashboard",
    "/admin/users",
    "/admin/posts",
    "/api/admin/users",
    "/api/admin/posts",
    "/api/admin/dashboard", // 添加缺失的API路径
  ],

  // 被封禁用户无法访问的路径
  bannedRestricted: ["/profile", "/settings", "/api/user/*", "/api/admin/*"],
}

/**
 * 创建测试用的标准请求对象 (非 NextRequest)
 */
export function createStandardTestRequest(
  path: string,
  options: {
    method?: string
    headers?: Record<string, string>
  } = {}
): Request {
  const { method = "GET", headers = {} } = options

  return new Request(`http://localhost:3000${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  })
}

/**
 * 创建测试用的 Response Mock
 */
export function createTestResponse(status: number = 200, data: any = null) {
  return {
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
    ok: status >= 200 && status < 300,
    headers: new Map(),
    redirect: (url: string) => ({ status: 302, headers: { Location: url } }),
  }
}

/**
 * 权限测试场景配置
 */
export const PERMISSION_TEST_SCENARIOS = [
  {
    name: "管理员访问管理路径",
    user: TEST_USERS.admin,
    path: "/admin/dashboard",
    expectedResult: "ALLOW" as const,
    description: "管理员应该能够访问所有管理路径",
  },
  {
    name: "普通用户访问管理路径",
    user: TEST_USERS.user,
    path: "/admin/dashboard",
    expectedResult: "DENY" as const,
    description: "普通用户不应该能够访问管理路径",
  },
  {
    name: "被封禁用户访问任何需认证路径",
    user: TEST_USERS.bannedUser,
    path: "/profile",
    expectedResult: "DENY" as const,
    description: "被封禁用户不应该能够访问任何需要认证的路径",
  },
  {
    name: "未登录用户访问公开路径",
    user: null,
    path: "/blog",
    expectedResult: "ALLOW" as const,
    description: "未登录用户应该能够访问公开路径",
  },
  {
    name: "未登录用户访问需认证路径",
    user: null,
    path: "/profile",
    expectedResult: "REDIRECT_TO_LOGIN" as const,
    description: "未登录用户访问需认证路径应重定向到登录页",
  },
]

export type PermissionTestResult = "ALLOW" | "DENY" | "REDIRECT_TO_LOGIN"
