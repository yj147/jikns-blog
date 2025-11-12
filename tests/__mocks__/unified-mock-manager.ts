/**
 * 统一Mock系统管理器
 * 整合Supabase和Prisma的mock配置，提供统一的管理接口
 */

import { vi } from "vitest"
import type { TestUser } from "../setup"
import { TEST_USERS, createTestSession } from "../helpers/test-data"

// === Mock状态管理 ===
interface MockState {
  currentUser: TestUser | null
  databaseError: Error | null
  networkError: Error | null
  authError: Error | null
}

let mockState: MockState = {
  currentUser: null,
  databaseError: null,
  networkError: null,
  authError: null,
}

// === Prisma Mock 配置 ===
const createPrismaMock = () => {
  const baseMock = {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
      count: vi.fn(),
    },
    post: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    comment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
    $disconnect: vi.fn(),
    $connect: vi.fn(),
  }

  // 为所有方法设置默认行为
  const setupDefaultBehavior = (model: any, modelName: string) => {
    Object.keys(model).forEach((methodName) => {
      const method = model[methodName]
      if (vi.isMockFunction(method)) {
        method.mockImplementation(async (...args: any[]) => {
          // 检查是否有数据库错误
          if (mockState.databaseError) {
            throw mockState.databaseError
          }

          // 根据方法名返回合适的默认值
          switch (methodName) {
            case "findUnique":
              return mockState.currentUser && modelName === "user" ? mockState.currentUser : null
            case "findMany":
              return []
            case "create":
            case "update":
            case "upsert":
              return args[0]?.data || {}
            case "delete":
              return { count: 1 }
            case "count":
              return 0
            default:
              return null
          }
        })
      }
    })
  }

  // 设置默认行为
  setupDefaultBehavior(baseMock.user, "user")
  setupDefaultBehavior(baseMock.post, "post")
  setupDefaultBehavior(baseMock.comment, "comment")

  // 特殊方法
  baseMock.$transaction.mockImplementation(async (callback: any) => {
    if (typeof callback === "function") {
      return await callback(baseMock)
    }
    return []
  })

  baseMock.$disconnect.mockResolvedValue(undefined)
  baseMock.$connect.mockResolvedValue(undefined)

  return baseMock
}

// === Supabase Mock 配置 ===
const createSupabaseMock = () => {
  const authMock = {
    getSession: vi.fn().mockImplementation(async () => {
      if (mockState.authError) {
        return { data: { session: null }, error: mockState.authError }
      }

      if (!mockState.currentUser) {
        return { data: { session: null }, error: null }
      }

      const session = createTestSession(mockState.currentUser.id, mockState.currentUser.email)
      return { data: { session }, error: null }
    }),

    getUser: vi.fn().mockImplementation(async () => {
      if (mockState.authError) {
        return { data: { user: null }, error: mockState.authError }
      }

      if (!mockState.currentUser) {
        return { data: { user: null }, error: null }
      }

      return {
        data: {
          user: {
            id: mockState.currentUser.id,
            email: mockState.currentUser.email,
            user_metadata: {
              full_name: mockState.currentUser.name,
              avatar_url: mockState.currentUser.avatarUrl,
            },
          },
        },
        error: null,
      }
    }),

    signInWithOAuth: vi.fn().mockImplementation(async ({ provider }: { provider: string }) => ({
      data: {
        provider: provider as any,
        url: `https://github.com/login/oauth/authorize?client_id=test&redirect_uri=http://localhost:54321/auth/v1/callback&scope=read:user user:email&state=test`,
        user: null,
        session: null,
      },
      error: mockState.authError,
    })),

    signInWithPassword: vi
      .fn()
      .mockImplementation(async ({ email, password }: { email: string; password: string }) => {
        if (mockState.authError) {
          return { data: { user: null, session: null }, error: mockState.authError }
        }

        const testUser = Object.values(TEST_USERS).find((u) => u.email === email)
        if (testUser && password === "test123") {
          mockState.currentUser = testUser
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

    signOut: vi.fn().mockImplementation(async () => {
      mockState.currentUser = null
      return { error: mockState.authError }
    }),

    exchangeCodeForSession: vi.fn().mockImplementation(async (code: string) => {
      if (mockState.authError) {
        return { data: { session: null, user: null }, error: mockState.authError }
      }

      if (!code || !mockState.currentUser) {
        return { data: { session: null, user: null }, error: new Error("Invalid code") }
      }

      const session = createTestSession(mockState.currentUser.id, mockState.currentUser.email)
      return {
        data: {
          session,
          user: {
            id: mockState.currentUser.id,
            email: mockState.currentUser.email,
            user_metadata: {
              full_name: mockState.currentUser.name,
              avatar_url: mockState.currentUser.avatarUrl,
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        },
        error: null,
      }
    }),

    // 添加缺失的 auth 方法
    onAuthStateChange: vi.fn().mockImplementation(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),

    refreshSession: vi.fn().mockImplementation(async () => {
      if (mockState.authError) {
        return { data: { session: null, user: null }, error: mockState.authError }
      }

      if (!mockState.currentUser) {
        return { data: { session: null, user: null }, error: new Error("No session") }
      }

      const session = createTestSession(mockState.currentUser.id, mockState.currentUser.email)
      return { data: { session, user: session.user }, error: null }
    }),
  }

  return {
    auth: authMock,
    from: vi.fn((table: string) => {
      const queryBuilder = {
        select: vi.fn((columns?: string) => queryBuilder),
        insert: vi.fn((data: any) => queryBuilder),
        update: vi.fn((data: any) => queryBuilder),
        delete: vi.fn(() => queryBuilder),
        upsert: vi.fn((data: any) => queryBuilder),
        eq: vi.fn((column: string, value: any) => queryBuilder),
        neq: vi.fn((column: string, value: any) => queryBuilder),
        gt: vi.fn((column: string, value: any) => queryBuilder),
        gte: vi.fn((column: string, value: any) => queryBuilder),
        lt: vi.fn((column: string, value: any) => queryBuilder),
        lte: vi.fn((column: string, value: any) => queryBuilder),
        like: vi.fn((column: string, value: any) => queryBuilder),
        ilike: vi.fn((column: string, value: any) => queryBuilder),
        is: vi.fn((column: string, value: any) => queryBuilder),
        in: vi.fn((column: string, values: any[]) => queryBuilder),
        contains: vi.fn((column: string, value: any) => queryBuilder),
        containedBy: vi.fn((column: string, value: any) => queryBuilder),
        range: vi.fn((from: number, to: number) => queryBuilder),
        order: vi.fn((column: string, options?: any) => queryBuilder),
        limit: vi.fn((count: number) => queryBuilder),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),

        // 执行方法 - 返回 Promise
        then: vi.fn(async (resolve, reject) => {
          try {
            if (mockState.databaseError) {
              const result = { data: null, error: mockState.databaseError }
              return resolve ? resolve(result) : result
            }

            // 根据表名和操作返回模拟数据
            let mockData = null
            if (table === "users" && mockState.currentUser) {
              mockData = [mockState.currentUser]
            } else if (table === "posts") {
              mockData = []
            }

            const result = { data: mockData, error: null }
            return resolve ? resolve(result) : result
          } catch (error) {
            const result = { data: null, error }
            return reject ? reject(result) : result
          }
        }),
      }

      return queryBuilder
    }),

    // RPC 调用支持
    rpc: vi.fn((functionName: string, params?: any) => ({
      then: vi.fn(async (resolve) => {
        if (mockState.databaseError) {
          return resolve({ data: null, error: mockState.databaseError })
        }
        return resolve({ data: null, error: null })
      }),
    })),

    // 存储功能
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ data: null, error: null }),
        download: vi.fn().mockResolvedValue({ data: null, error: null }),
        remove: vi.fn().mockResolvedValue({ data: null, error: null }),
        list: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    },
  }
}

// === 统一管理器 ===
export class UnifiedMockManager {
  private prismaMock = createPrismaMock()
  private supabaseMock = createSupabaseMock()

  // 获取mock实例
  getPrismaMock() {
    return this.prismaMock
  }

  getSupabaseMock() {
    return this.supabaseMock
  }

  // 用户状态管理
  setCurrentUser(userType: keyof typeof TEST_USERS | null) {
    mockState.currentUser = userType ? TEST_USERS[userType] : null
  }

  getCurrentUser(): TestUser | null {
    return mockState.currentUser
  }

  // 错误状态管理
  setDatabaseError(error: Error | null) {
    mockState.databaseError = error
  }

  setNetworkError(error: Error | null) {
    mockState.networkError = error
  }

  setAuthError(error: Error | null) {
    mockState.authError = error
  }

  // 批量设置错误
  setErrors(errors: Partial<Pick<MockState, "databaseError" | "networkError" | "authError">>) {
    if (errors.databaseError !== undefined) {
      mockState.databaseError = errors.databaseError
    }
    if (errors.networkError !== undefined) {
      mockState.networkError = errors.networkError
    }
    if (errors.authError !== undefined) {
      mockState.authError = errors.authError
    }
  }

  // 快速配置方法
  setupAdminUser() {
    this.setCurrentUser("admin")
  }

  setupRegularUser() {
    this.setCurrentUser("user")
  }

  setupBannedUser() {
    this.setCurrentUser("bannedUser")
  }

  setupUnauthenticated() {
    this.setCurrentUser(null)
  }

  // 数据库场景配置
  setupDatabaseError(message = "Database connection failed") {
    this.setDatabaseError(new Error(message))
  }

  setupAuthError(message = "Authentication failed") {
    this.setAuthError(new Error(message))
  }

  // 重置所有状态
  reset() {
    mockState = {
      currentUser: null,
      databaseError: null,
      networkError: null,
      authError: null,
    }

    // 重置所有mock函数的调用历史，但保持mock实例
    Object.values(this.prismaMock).forEach((model) => {
      if (typeof model === "object" && model !== null) {
        Object.values(model).forEach((method) => {
          if (vi.isMockFunction(method)) {
            method.mockClear()
          }
        })
      } else if (vi.isMockFunction(model)) {
        model.mockClear()
      }
    })

    // 重置Supabase auth mock
    if (this.supabaseMock.auth) {
      Object.values(this.supabaseMock.auth).forEach((method) => {
        if (vi.isMockFunction(method)) {
          method.mockClear()
        }
      })
    }
  }

  // 获取当前状态快照
  getState(): Readonly<MockState> {
    return { ...mockState }
  }
}

// 单例实例
export const mockManager = new UnifiedMockManager()

// 导出便捷函数
export const {
  getPrismaMock,
  getSupabaseMock,
  setCurrentUser,
  getCurrentUser,
  setDatabaseError,
  setAuthError,
  setupAdminUser,
  setupRegularUser,
  setupBannedUser,
  setupUnauthenticated,
  setupDatabaseError,
  setupAuthError,
  reset,
} = mockManager

// 导出类型
export type { MockState }
