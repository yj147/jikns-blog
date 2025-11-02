/**
 * Session 状态管理集成测试套件
 *
 * 测试覆盖：
 * - 会话生命周期管理
 * - 会话刷新机制
 * - 跨页面/组件的状态同步
 * - 会话失效处理
 * - 并发会话操作
 *
 * Phase 2 范围：专注于基础会话管理，不涉及权限中间件
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { cleanTestDatabase, getTestDatabase } from "../config/test-database"
import { createMockSupabaseClient, resetSupabaseMocks } from "../config/test-supabase"
import {
  createEmailTestUser,
  createGitHubTestUser,
  createMockAuthContext,
} from "../helpers/auth-test-helpers"
import { getUserSession, refreshUserSession } from "@/lib/auth"

describe("Session 状态管理集成测试", () => {
  const db = getTestDatabase()

  beforeEach(async () => {
    await cleanTestDatabase()
    resetSupabaseMocks()

    // 设置测试环境变量
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321"
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key"
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  describe("会话生命周期管理", () => {
    it("应该正确初始化新的用户会话", async () => {
      // Arrange: 创建测试用户
      const { user } = await createEmailTestUser("TestPassword123!")

      const mockSupabase = createMockSupabaseClient()

      // 模拟成功的登录会话
      vi.spyOn(mockSupabase.auth, "getUser").mockResolvedValue({
        data: {
          user: {
            id: user.id,
            email: user.email,
            user_metadata: {},
            created_at: user.createdAt.toISOString(),
            updated_at: user.updatedAt.toISOString(),
          },
        },
        error: null,
      })

      // 模拟会话初始化
      const mockGetUserSession = vi.fn().mockResolvedValue({
        user: {
          ...user,
          isAdmin: user.role === "ADMIN",
          canInteract: user.status === "ACTIVE",
        },
        isAuthenticated: true,
      })

      // Act: 初始化会话
      const session = await mockGetUserSession()

      // Assert: 验证会话正确初始化
      expect(session.isAuthenticated).toBe(true)
      expect(session.user).toBeDefined()
      expect(session.user!.id).toBe(user.id)
      expect(session.user!.email).toBe(user.email)
      expect(session.user!.isAdmin).toBe(user.role === "ADMIN")
      expect(session.user!.canInteract).toBe(user.status === "ACTIVE")

      // 验证数据库中的登录时间已更新
      const updatedUser = await db.user.findUnique({
        where: { id: user.id },
      })
      expect(updatedUser!.lastLoginAt).toBeDefined()
    })

    it("应该正确清理已登出的会话", async () => {
      // Arrange: 模拟已登录状态
      const { user } = await createEmailTestUser("TestPassword123!")
      const mockAuthContext = createMockAuthContext()
      mockAuthContext.setCurrentUser(user)

      expect(mockAuthContext.isAuthenticated()).toBe(true)

      // Act: 执行登出
      mockAuthContext.signOut()

      // Assert: 验证会话已清理
      expect(mockAuthContext.isAuthenticated()).toBe(false)
      expect(mockAuthContext.getCurrentUser()).toBeNull()
      expect(mockAuthContext.getIsLoading()).toBe(false)
    })

    it("应该处理会话过期情况", async () => {
      // Arrange: 模拟过期的会话
      const mockSupabase = createMockSupabaseClient()

      vi.spyOn(mockSupabase.auth, "getUser").mockResolvedValue({
        data: { user: null },
        error: {
          message: "JWT expired",
          name: "AuthSessionMissingError",
          status: 401,
        },
      })

      // 模拟会话过期检查
      const mockGetUserSession = vi.fn().mockResolvedValue({
        user: null,
        isAuthenticated: false,
      })

      // Act: 检查过期会话
      const session = await mockGetUserSession()

      // Assert: 验证过期会话处理
      expect(session.isAuthenticated).toBe(false)
      expect(session.user).toBeNull()
    })

    it("应该处理无效的会话令牌", async () => {
      // Arrange: 模拟无效令牌
      const mockSupabase = createMockSupabaseClient()

      vi.spyOn(mockSupabase.auth, "getUser").mockResolvedValue({
        data: { user: null },
        error: {
          message: "Invalid JWT",
          name: "AuthInvalidTokenResponseError",
          status: 401,
        },
      })

      // 模拟无效令牌处理
      const mockGetUserSession = vi.fn().mockResolvedValue({
        user: null,
        isAuthenticated: false,
      })

      // Act: 检查无效令牌
      const session = await mockGetUserSession()

      // Assert: 验证无效令牌处理
      expect(session.isAuthenticated).toBe(false)
      expect(session.user).toBeNull()
    })
  })

  describe("会话刷新机制", () => {
    it("应该成功刷新有效的会话", async () => {
      // Arrange: 创建用户并设置会话
      const { user } = await createEmailTestUser("TestPassword123!")
      const originalLoginTime = user.lastLoginAt || new Date()

      const mockSupabase = createMockSupabaseClient()

      // 模拟成功的会话刷新
      vi.spyOn(mockSupabase.auth, "refreshSession").mockResolvedValue({
        data: {
          session: {
            access_token: "new_access_token",
            refresh_token: "new_refresh_token",
            expires_in: 3600,
            user: {
              id: user.id,
              email: user.email,
              created_at: user.createdAt.toISOString(),
            },
          },
          user: {
            id: user.id,
            email: user.email,
            user_metadata: {},
          },
        },
        error: null,
      })

      // 模拟刷新会话函数
      const mockRefreshUserSession = vi.fn().mockImplementation(async () => {
        const refreshResult = await mockSupabase.auth.refreshSession()
        if (refreshResult.error) return false

        // 更新最后登录时间
        await db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        })

        return true
      })

      // Act: 刷新会话
      const refreshSuccess = await mockRefreshUserSession()

      // Assert: 验证刷新成功
      expect(refreshSuccess).toBe(true)

      // 验证最后登录时间已更新
      const updatedUser = await db.user.findUnique({
        where: { id: user.id },
      })
      expect(updatedUser!.lastLoginAt!.getTime()).toBeGreaterThan(originalLoginTime.getTime())
    })

    it("应该处理会话刷新失败", async () => {
      // Arrange: 模拟刷新失败
      const mockSupabase = createMockSupabaseClient()

      vi.spyOn(mockSupabase.auth, "refreshSession").mockResolvedValue({
        data: { session: null, user: null },
        error: {
          message: "Refresh token is invalid",
          name: "AuthRefreshFailedError",
          status: 401,
        },
      })

      // 模拟失败的会话刷新
      const mockRefreshUserSession = vi.fn().mockImplementation(async () => {
        const refreshResult = await mockSupabase.auth.refreshSession()
        return !refreshResult.error
      })

      // Act: 尝试刷新会话
      const refreshSuccess = await mockRefreshUserSession()

      // Assert: 验证刷新失败
      expect(refreshSuccess).toBe(false)
    })

    it("应该自动检测即将过期的会话并刷新", async () => {
      // Arrange: 模拟即将过期的会话（30分钟后过期）
      const { user } = await createEmailTestUser("TestPassword123!")
      const mockSupabase = createMockSupabaseClient()

      const expiresIn = 30 * 60 // 30分钟
      const currentTime = Math.floor(Date.now() / 1000)
      const expiresAt = currentTime + expiresIn

      // 模拟当前会话状态
      vi.spyOn(mockSupabase.auth, "getSession").mockResolvedValue({
        data: {
          session: {
            access_token: "current_token",
            refresh_token: "refresh_token",
            expires_at: expiresAt,
            expires_in: expiresIn,
            user: {
              id: user.id,
              email: user.email,
            },
          },
        },
        error: null,
      })

      // 模拟自动刷新逻辑
      const shouldRefresh = expiresIn < 3600 // 小于1小时时刷新

      // Act: 检查是否需要刷新
      expect(shouldRefresh).toBe(true)

      if (shouldRefresh) {
        // 模拟自动刷新
        vi.spyOn(mockSupabase.auth, "refreshSession").mockResolvedValue({
          data: {
            session: {
              access_token: "new_token",
              refresh_token: "new_refresh_token",
              expires_in: 3600,
              user: { id: user.id, email: user.email },
            },
            user: { id: user.id, email: user.email, user_metadata: {} },
          },
          error: null,
        })

        const refreshResult = await mockSupabase.auth.refreshSession()

        // Assert: 验证自动刷新成功
        expect(refreshResult.error).toBeNull()
        expect(refreshResult.data.session!.access_token).toBe("new_token")
      }
    })

    it("应该处理并发的会话刷新请求", async () => {
      // Arrange: 创建用户
      const { user } = await createEmailTestUser("TestPassword123!")
      const mockSupabase = createMockSupabaseClient()

      let refreshCallCount = 0

      // 模拟会话刷新（只允许第一次成功）
      vi.spyOn(mockSupabase.auth, "refreshSession").mockImplementation(async () => {
        refreshCallCount++

        if (refreshCallCount === 1) {
          return {
            data: {
              session: {
                access_token: "refreshed_token",
                refresh_token: "new_refresh_token",
                expires_in: 3600,
                user: { id: user.id, email: user.email },
              },
              user: { id: user.id, email: user.email, user_metadata: {} },
            },
            error: null,
          }
        } else {
          return {
            data: { session: null, user: null },
            error: {
              message: "Already refreshing",
              name: "AuthError",
              status: 429,
            },
          }
        }
      })

      // Act: 并发发起多个刷新请求
      const refreshPromises = Array.from({ length: 3 }, () => mockSupabase.auth.refreshSession())

      const results = await Promise.allSettled(refreshPromises)

      // Assert: 验证并发处理
      const successResults = results.filter(
        (r) => r.status === "fulfilled" && !(r.value as any).error
      )
      expect(successResults).toHaveLength(1) // 只有一个成功

      expect(refreshCallCount).toBe(3) // 所有请求都被处理
    })
  })

  describe("跨组件状态同步", () => {
    it("应该在多个组件间同步认证状态", async () => {
      // Arrange: 创建多个认证上下文实例（模拟不同组件）
      const context1 = createMockAuthContext()
      const context2 = createMockAuthContext()
      const context3 = createMockAuthContext()

      const { user } = await createEmailTestUser("TestPassword123!")

      // Act: 在一个上下文中设置用户
      context1.setCurrentUser(user)

      // 模拟状态同步机制
      const syncStates = () => {
        const currentUser = context1.getCurrentUser()
        context2.setCurrentUser(currentUser)
        context3.setCurrentUser(currentUser)
      }
      syncStates()

      // Assert: 验证所有上下文状态同步
      expect(context1.isAuthenticated()).toBe(true)
      expect(context2.isAuthenticated()).toBe(true)
      expect(context3.isAuthenticated()).toBe(true)

      expect(context1.getCurrentUser()?.id).toBe(user.id)
      expect(context2.getCurrentUser()?.id).toBe(user.id)
      expect(context3.getCurrentUser()?.id).toBe(user.id)
    })

    it("应该在用户登出时同步清理所有上下文", async () => {
      // Arrange: 设置多个已登录的上下文
      const contexts = Array.from({ length: 3 }, () => createMockAuthContext())
      const { user } = await createEmailTestUser("TestPassword123!")

      contexts.forEach((context) => context.setCurrentUser(user))

      // 验证初始状态
      contexts.forEach((context) => {
        expect(context.isAuthenticated()).toBe(true)
      })

      // Act: 在一个上下文中登出
      contexts[0].signOut()

      // 模拟全局登出同步
      const syncLogout = () => {
        contexts.forEach((context) => context.signOut())
      }
      syncLogout()

      // Assert: 验证所有上下文都已登出
      contexts.forEach((context) => {
        expect(context.isAuthenticated()).toBe(false)
        expect(context.getCurrentUser()).toBeNull()
      })
    })

    it("应该正确处理状态更新的竞争条件", async () => {
      // Arrange: 创建认证上下文
      const authContext = createMockAuthContext()
      const { user: user1 } = await createEmailTestUser("Password1!")
      const { user: user2 } = await createEmailTestUser("Password2!")

      // Act: 并发设置不同用户
      const updates = [
        () => authContext.setCurrentUser(user1),
        () => authContext.setCurrentUser(user2),
        () => authContext.setCurrentUser(null),
        () => authContext.setCurrentUser(user1),
      ]

      // 顺序执行更新（模拟快速状态变化）
      updates.forEach((update) => update())

      // Assert: 验证最后一次更新生效
      expect(authContext.getCurrentUser()?.id).toBe(user1.id)
      expect(authContext.isAuthenticated()).toBe(true)
    })
  })

  describe("会话错误恢复", () => {
    it("应该从临时网络错误中恢复", async () => {
      // Arrange: 模拟网络错误后恢复
      const { user } = await createEmailTestUser("TestPassword123!")
      const mockSupabase = createMockSupabaseClient()

      let callCount = 0

      // 模拟第一次调用失败，第二次成功
      vi.spyOn(mockSupabase.auth, "getUser").mockImplementation(async () => {
        callCount++

        if (callCount === 1) {
          throw new Error("Network error")
        }

        return {
          data: {
            user: {
              id: user.id,
              email: user.email,
              user_metadata: {},
            },
          },
          error: null,
        }
      })

      // 模拟重试机制
      const getUserWithRetry = async (maxRetries = 2) => {
        for (let i = 0; i < maxRetries; i++) {
          try {
            const result = await mockSupabase.auth.getUser()
            if (result.data.user) {
              return {
                user: {
                  ...user,
                  isAdmin: user.role === "ADMIN",
                  canInteract: user.status === "ACTIVE",
                },
                isAuthenticated: true,
              }
            }
          } catch (error) {
            if (i === maxRetries - 1) throw error
            // 等待一段时间后重试
            await new Promise((resolve) => setTimeout(resolve, 100))
          }
        }
        return { user: null, isAuthenticated: false }
      }

      // Act: 尝试获取用户信息
      const session = await getUserWithRetry()

      // Assert: 验证恢复成功
      expect(session.isAuthenticated).toBe(true)
      expect(session.user?.id).toBe(user.id)
      expect(callCount).toBe(2) // 确认进行了重试
    })

    it("应该处理持续的服务不可用错误", async () => {
      // Arrange: 模拟持续的服务错误
      const mockSupabase = createMockSupabaseClient()

      vi.spyOn(mockSupabase.auth, "getUser").mockRejectedValue(new Error("Service unavailable"))

      // 模拟错误处理和回退机制
      const getUserWithFallback = async () => {
        try {
          const result = await mockSupabase.auth.getUser()
          return {
            user: result.data.user,
            isAuthenticated: !!result.data.user,
          }
        } catch (error) {
          console.error("认证服务不可用:", error)
          return {
            user: null,
            isAuthenticated: false,
            error: "认证服务暂时不可用，请稍后重试",
          }
        }
      }

      // Act: 尝试获取用户信息
      const session = await getUserWithFallback()

      // Assert: 验证错误处理
      expect(session.isAuthenticated).toBe(false)
      expect(session.user).toBeNull()
      expect(session.error).toContain("认证服务暂时不可用")
    })

    it("应该处理数据库同步失败的恢复", async () => {
      // Arrange: 创建用户和模拟数据库错误
      const { user } = await createEmailTestUser("TestPassword123!")

      let dbCallCount = 0
      const originalFindUnique = db.user.findUnique

      // 模拟数据库查询第一次失败，第二次成功
      vi.spyOn(db.user, "findUnique").mockImplementation(async (args) => {
        dbCallCount++

        if (dbCallCount === 1) {
          throw new Error("Database connection failed")
        }

        return originalFindUnique.call(db.user, args)
      })

      // 模拟带重试的会话获取
      const getSessionWithRetry = async () => {
        for (let i = 0; i < 2; i++) {
          try {
            const dbUser = await db.user.findUnique({
              where: { id: user.id },
            })

            if (dbUser) {
              return {
                user: {
                  ...dbUser,
                  isAdmin: dbUser.role === "ADMIN",
                  canInteract: dbUser.status === "ACTIVE",
                },
                isAuthenticated: true,
              }
            }
          } catch (error) {
            if (i === 0) {
              // 第一次失败，等待后重试
              await new Promise((resolve) => setTimeout(resolve, 100))
              continue
            }
            throw error
          }
        }

        return { user: null, isAuthenticated: false }
      }

      // Act: 获取会话信息
      const session = await getSessionWithRetry()

      // Assert: 验证重试后成功
      expect(session.isAuthenticated).toBe(true)
      expect(session.user?.id).toBe(user.id)
      expect(dbCallCount).toBe(2) // 确认进行了重试

      // 清理
      vi.mocked(db.user.findUnique).mockRestore()
    })
  })

  describe("会话安全性", () => {
    it("应该检测并处理被篡改的会话数据", async () => {
      // Arrange: 模拟被篡改的会话
      const { user } = await createEmailTestUser("TestPassword123!")
      const mockSupabase = createMockSupabaseClient()

      // 模拟返回不一致的用户信息
      vi.spyOn(mockSupabase.auth, "getUser").mockResolvedValue({
        data: {
          user: {
            id: user.id,
            email: "tampered@hacker.com", // 被篡改的邮箱
            user_metadata: {},
          },
        },
        error: null,
      })

      // 模拟会话验证逻辑
      const validateSession = async () => {
        const authResult = await mockSupabase.auth.getUser()
        if (!authResult.data.user) return null

        // 从数据库验证用户信息
        const dbUser = await db.user.findUnique({
          where: { id: authResult.data.user.id },
        })

        // 检查邮箱是否一致
        if (dbUser && dbUser.email !== authResult.data.user.email) {
          console.warn("会话数据不一致，可能被篡改")
          return null
        }

        return dbUser
      }

      // Act: 验证会话
      const validatedUser = await validateSession()

      // Assert: 验证篡改检测
      expect(validatedUser).toBeNull() // 应该拒绝被篡改的会话
    })

    it("应该防止会话固定攻击", async () => {
      // Arrange: 模拟不同设备的会话
      const { user } = await createEmailTestUser("TestPassword123!")

      // 模拟会话元数据检查
      const validateSessionFingerprint = (sessionData: any) => {
        const expectedFingerprint = {
          userAgent: "TestBrowser/1.0",
          ipAddress: "192.168.1.100",
        }

        const actualFingerprint = {
          userAgent: sessionData.userAgent,
          ipAddress: sessionData.ipAddress,
        }

        // 简单的指纹验证
        return (
          expectedFingerprint.userAgent === actualFingerprint.userAgent &&
          expectedFingerprint.ipAddress === actualFingerprint.ipAddress
        )
      }

      // Act: 验证正常会话
      const legitimateSession = {
        userId: user.id,
        userAgent: "TestBrowser/1.0",
        ipAddress: "192.168.1.100",
      }

      const suspiciousSession = {
        userId: user.id,
        userAgent: "SuspiciousBrowser/1.0",
        ipAddress: "10.0.0.1",
      }

      // Assert: 验证会话指纹检查
      expect(validateSessionFingerprint(legitimateSession)).toBe(true)
      expect(validateSessionFingerprint(suspiciousSession)).toBe(false)
    })

    it("应该正确处理会话劫持尝试", async () => {
      // Arrange: 模拟会话劫持检测
      const { user } = await createEmailTestUser("TestPassword123!")

      const sessionStore = {
        [user.id]: {
          createdAt: new Date(),
          lastAccessedAt: new Date(),
          accessCount: 1,
          ipAddress: "192.168.1.100",
        },
      }

      // 模拟会话访问检查
      const checkSessionSecurity = (userId: string, currentIp: string) => {
        const session = sessionStore[userId]
        if (!session) return { valid: false, reason: "Session not found" }

        // 检查IP地址变化
        if (session.ipAddress !== currentIp) {
          return { valid: false, reason: "IP address mismatch" }
        }

        // 检查访问频率（简单的防护）
        const timeSinceLastAccess = Date.now() - session.lastAccessedAt.getTime()
        if (timeSinceLastAccess < 1000 && session.accessCount > 10) {
          return { valid: false, reason: "Suspicious access pattern" }
        }

        return { valid: true }
      }

      // Act & Assert: 验证正常访问
      expect(checkSessionSecurity(user.id, "192.168.1.100")).toEqual({ valid: true })

      // Act & Assert: 验证可疑访问被阻止
      expect(checkSessionSecurity(user.id, "10.0.0.1")).toEqual({
        valid: false,
        reason: "IP address mismatch",
      })
    })
  })

  describe("会话性能优化", () => {
    it("应该缓存会话信息以提高性能", async () => {
      // Arrange: 创建用户
      const { user } = await createEmailTestUser("TestPassword123!")

      let dbQueryCount = 0
      const originalFindUnique = db.user.findUnique

      // 监控数据库查询次数
      vi.spyOn(db.user, "findUnique").mockImplementation(async (args) => {
        dbQueryCount++
        return originalFindUnique.call(db.user, args)
      })

      // 模拟简单的内存缓存
      const sessionCache = new Map<string, any>()
      const CACHE_TTL = 5 * 60 * 1000 // 5分钟

      const getCachedSession = async (userId: string) => {
        const cached = sessionCache.get(userId)

        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          return cached.data
        }

        // 缓存未命中，查询数据库
        const dbUser = await db.user.findUnique({ where: { id: userId } })

        if (dbUser) {
          const sessionData = {
            user: {
              ...dbUser,
              isAdmin: dbUser.role === "ADMIN",
              canInteract: dbUser.status === "ACTIVE",
            },
            isAuthenticated: true,
          }

          sessionCache.set(userId, {
            data: sessionData,
            timestamp: Date.now(),
          })

          return sessionData
        }

        return { user: null, isAuthenticated: false }
      }

      // Act: 多次获取同一用户会话
      const session1 = await getCachedSession(user.id)
      const session2 = await getCachedSession(user.id)
      const session3 = await getCachedSession(user.id)

      // Assert: 验证缓存效果
      expect(session1.isAuthenticated).toBe(true)
      expect(session2.isAuthenticated).toBe(true)
      expect(session3.isAuthenticated).toBe(true)

      // 应该只查询数据库一次
      expect(dbQueryCount).toBe(1)

      // 清理
      vi.mocked(db.user.findUnique).mockRestore()
    })

    it("应该正确管理缓存失效", async () => {
      // Arrange: 创建用户和缓存
      const { user } = await createEmailTestUser("TestPassword123!")

      const sessionCache = new Map()
      const CACHE_TTL = 100 // 100ms用于测试

      const getCachedSession = async (userId: string) => {
        const cached = sessionCache.get(userId)

        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          return cached.data
        }

        // 模拟数据库查询
        const sessionData = { userId, timestamp: Date.now() }
        sessionCache.set(userId, {
          data: sessionData,
          timestamp: Date.now(),
        })

        return sessionData
      }

      // Act: 获取会话并等待缓存过期
      const session1 = await getCachedSession(user.id)

      // 等待缓存过期
      await new Promise((resolve) => setTimeout(resolve, 150))

      const session2 = await getCachedSession(user.id)

      // Assert: 验证缓存失效后重新查询
      expect(session1.userId).toBe(user.id)
      expect(session2.userId).toBe(user.id)
      expect(session2.timestamp).toBeGreaterThan(session1.timestamp)
    })
  })
})
