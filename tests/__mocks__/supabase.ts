/**
 * Supabase 客户端 Mock
 * 为权限系统测试提供可控的认证状态模拟
 */

import { vi } from "vitest"
import { TEST_USERS, createTestSession } from "../helpers/test-data"
import type { TestUser } from "../setup"

// 当前模拟的用户状态
let currentUser: TestUser | null = null

// 补充一组用于管理端测试的用户，避免 Supabase metadata 同步失败
const FALLBACK_USERS: Record<string, Partial<TestUser>> = {
  "admin-123": {
    id: "admin-123",
    email: "admin@example.com",
    name: "Admin User",
    role: "ADMIN",
    status: "ACTIVE",
  },
  "user-456": {
    id: "user-456",
    email: "user@example.com",
    name: "Regular User",
    role: "USER",
    status: "ACTIVE",
  },
  "user-789": {
    id: "user-789",
    email: "banned@example.com",
    name: "Banned User",
    role: "USER",
    status: "BANNED",
  },
}

function resolveSupabaseUser(userId: string) {
  return (
    Object.values(TEST_USERS).find((u) => u.id === userId) ||
    FALLBACK_USERS[userId] ||
    (currentUser ? { ...currentUser } : null)
  )
}

/**
 * Mock Supabase Auth 对象
 */
const mockAuth = {
  getSession: vi.fn(async () => {
    if (!currentUser) {
      return { data: { session: null }, error: null }
    }

    const session = createTestSession(currentUser.id, currentUser.email)
    return { data: { session }, error: null }
  }),

  getUser: vi.fn(async () => {
    if (!currentUser) {
      return { data: { user: null }, error: null }
    }

    return {
      data: {
        user: {
          id: currentUser.id,
          email: currentUser.email,
          user_metadata: {
            full_name: currentUser.name,
            avatar_url: currentUser.avatarUrl,
          },
        },
      },
      error: null,
    }
  }),

  signInWithOAuth: vi.fn(async ({ provider }: { provider: string; options?: any }) => ({
    data: {
      provider: provider as any,
      url: `https://github.com/login/oauth/authorize?client_id=test&redirect_uri=http://localhost:54321/auth/v1/callback&scope=read:user user:email&state=test`,
      user: null,
      session: null,
    },
    error: null,
  })),

  exchangeCodeForSession: vi.fn(async (code: string) => {
    if (!code) {
      return { data: { session: null, user: null }, error: new Error("Missing code") }
    }

    if (currentUser) {
      const session = createTestSession(currentUser.id, currentUser.email)
      return {
        data: {
          session,
          user: {
            id: currentUser.id,
            email: currentUser.email,
            user_metadata: {
              full_name: currentUser.name,
              avatar_url: currentUser.avatarUrl,
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        },
        error: null,
      }
    }

    return { data: { session: null, user: null }, error: null }
  }),

  signInWithPassword: vi.fn(async ({ email, password }: { email: string; password: string }) => {
    // 简单的测试用户密码验证
    const testUser = Object.values(TEST_USERS).find((u) => u.email === email)
    if (testUser && password === "test123") {
      currentUser = testUser
      const session = createTestSession(testUser.id, testUser.email)
      return {
        data: {
          user: {
            id: testUser.id,
            email: testUser.email,
            user_metadata: {
              full_name: testUser.name,
              avatar_url: testUser.avatarUrl,
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          session,
        },
        error: null,
      }
    }

    return {
      data: { user: null, session: null },
      error: new Error("Invalid credentials"),
    }
  }),

  signOut: vi.fn(async () => {
    currentUser = null
    return { error: null }
  }),
}

/**
 * Mock Supabase 客户端
 */
export const createMockSupabaseClient = () => ({
  auth: mockAuth,
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(),
      })),
    })),
  })),
})

/**
 * 设置当前测试用户
 */
export function setCurrentTestUser(userType: keyof typeof TEST_USERS | null) {
  currentUser = userType ? TEST_USERS[userType] : null
}

/**
 * 获取当前测试用户
 */
export function getCurrentTestUser(): TestUser | null {
  return currentUser
}

/**
 * 重置所有 Mock 状态
 */
export function resetMocks() {
  currentUser = null
  vi.clearAllMocks()
}

function buildServiceRoleClient() {
  const admin = {
    getUserById: vi.fn(async (userId: string) => {
      const user = resolveSupabaseUser(userId)

      if (!user) {
        return { data: { user: null }, error: null }
      }

      return {
        data: {
          user: {
            id: user.id,
            email: user.email,
            user_metadata: {
              full_name: user.name,
              avatar_url: user.avatarUrl,
            },
          },
        },
        error: null,
      }
    }),
    updateUserById: vi.fn(async (userId: string, { user_metadata }: { user_metadata?: any }) => ({
      data: {
        user: {
          id: userId,
          user_metadata,
        },
      },
      error: null,
    })),
  }

  return {
    auth: { admin },
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: vi.fn(async (path: string, expiresIn: number) => ({
          data: { signedUrl: `https://storage.test/signed/${path}?e=${expiresIn}` },
          error: null,
        })),
        createSignedUrls: vi.fn(async (paths: string[], expiresIn: number) => ({
          data: paths.map((path) => ({
            error: null,
            path,
            signedUrl: `https://storage.test/signed/${path}?e=${expiresIn}`,
          })),
          error: null,
        })),
      })),
    },
  }
}

const createServiceRoleClient = vi.fn(() => buildServiceRoleClient())

// Mock 导出函数
export const createClient = vi.fn(() => createMockSupabaseClient())
export const createServerSupabaseClient = vi.fn(async () => createMockSupabaseClient())
export const createRouteHandlerClient = vi.fn(async () => createMockSupabaseClient())
export { createServiceRoleClient }

// 默认导出用于模块替换
export default {
  createClient,
  createServerSupabaseClient,
  createRouteHandlerClient,
  createServiceRoleClient,
}
