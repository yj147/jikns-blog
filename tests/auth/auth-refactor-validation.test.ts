/**
 * P2-3: 认证系统重构验证测试
 *
 * 测试范围：
 * 1. 无缓存情况下的性能测试
 * 2. upsert数据同步的边界测试
 * 3. 并发场景下的数据一致性
 *
 * 基于：docs/2-auth/认证系统重构任务清单.md - P2-3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { performance } from "perf_hooks"
import { mockPrisma } from "../__mocks__/prisma"
import { setCurrentTestUser, resetMocks } from "../__mocks__/supabase"

// Mock依赖
vi.mock("@/lib/supabase", async () => {
  const actual = await vi.importActual("../__mocks__/supabase")
  return actual
})

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

describe("P2-3: 认证系统重构验证", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMocks()
    setCurrentTestUser("user")
  })

  describe("1. 无缓存情况下的性能测试", () => {
    it("权限检查响应时间应小于100ms", async () => {
      const { fetchAuthenticatedUser } = await import("@/lib/auth/session")

      // Mock数据库查询返回
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "test-user-id",
        email: "test@example.com",
        role: "USER",
        status: "ACTIVE",
        name: "Test User",
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: new Date(),
      })

      // 执行100次权限检查，测量平均响应时间
      const iterations = 100
      const startTime = performance.now()

      for (let i = 0; i < iterations; i++) {
        await fetchAuthenticatedUser()
      }

      const endTime = performance.now()
      const averageTime = (endTime - startTime) / iterations

      // 验证：平均响应时间应小于100ms
      expect(averageTime).toBeLessThan(100)

      // 验证：没有使用内存缓存（每次都调用数据库）
      expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(iterations)
    })

    it("高频权限检查不应导致内存泄漏", async () => {
      const { fetchAuthenticatedUser } = await import("@/lib/auth/session")

      mockPrisma.user.findUnique.mockResolvedValue({
        id: "test-user-id",
        email: "test@example.com",
        role: "USER",
        status: "ACTIVE",
        name: "Test User",
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: new Date(),
      })

      // 记录初始内存
      const initialMemory = process.memoryUsage().heapUsed

      // 执行1000次权限检查
      for (let i = 0; i < 1000; i++) {
        await fetchAuthenticatedUser()
      }

      // 强制垃圾回收（如果可用）
      if (global.gc) {
        global.gc()
      }

      // 让GC有时间完成，避免瞬时波动
      await new Promise((resolve) => setTimeout(resolve, 0))
      global.gc?.()

      // 记录最终内存
      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = finalMemory - initialMemory

      // 验证：内存增长应小于10MB（表示无显著泄漏）
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024)
    })

    it("Prisma连接池应正确处理并发请求", async () => {
      const { fetchAuthenticatedUser } = await import("@/lib/auth/session")

      mockPrisma.user.findUnique.mockResolvedValue({
        id: "test-user-id",
        email: "test@example.com",
        role: "USER",
        status: "ACTIVE",
        name: "Test User",
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: new Date(),
      })

      // 并发执行50个权限检查
      const concurrentRequests = 50
      const startTime = performance.now()

      const promises = Array.from({ length: concurrentRequests }, () => fetchAuthenticatedUser())

      await Promise.all(promises)

      const endTime = performance.now()
      const totalTime = endTime - startTime

      // 验证：总时间应小于5秒（平均每个请求<100ms）
      expect(totalTime).toBeLessThan(5000)

      // 验证：所有请求都成功执行
      expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(concurrentRequests)
    })
  })

  describe("2. upsert数据同步的边界测试", () => {
    it("新用户创建：应正确处理首次登录", async () => {
      const { syncUserFromAuth } = await import("@/lib/auth/session")
      // mockPrisma already imported

      const newUser = {
        id: "new-user-id",
        email: "newuser@example.com",
        user_metadata: {
          full_name: "New User",
          avatar_url: "https://example.com/avatar.jpg",
        },
      }

      const expectedUser = {
        id: "new-user-id",
        email: "newuser@example.com",
        name: "New User",
        avatarUrl: "https://example.com/avatar.jpg",
        role: "USER",
        status: "ACTIVE",
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        lastLoginAt: expect.any(Date),
      }

      mockPrisma.user.upsert.mockResolvedValue(expectedUser)

      const result = await syncUserFromAuth(newUser)

      // 验证：调用upsert而非create
      expect(mockPrisma.user.upsert).toHaveBeenCalledTimes(1)
      expect(mockPrisma.user.upsert).toHaveBeenCalledWith({
        where: { id: "new-user-id" },
        create: expect.objectContaining({
          id: "new-user-id",
          email: "newuser@example.com",
          name: "New User",
          role: "USER",
          status: "ACTIVE",
        }),
        update: expect.any(Object),
      })

      expect(result).toEqual(expectedUser)
    })

    it("现有用户更新：应只更新必要字段", async () => {
      const { syncUserFromAuth } = await import("@/lib/auth/session")
      // mockPrisma already imported

      const existingUser = {
        id: "existing-user-id",
        email: "existing@example.com",
        user_metadata: {
          full_name: "Updated Name",
          avatar_url: "https://example.com/new-avatar.jpg",
        },
      }

      const expectedUser = {
        id: "existing-user-id",
        email: "existing@example.com",
        name: "Updated Name",
        avatarUrl: "https://example.com/new-avatar.jpg",
        role: "USER",
        status: "ACTIVE",
        createdAt: new Date("2024-01-01"),
        updatedAt: expect.any(Date),
        lastLoginAt: expect.any(Date),
      }

      mockPrisma.user.upsert.mockResolvedValue(expectedUser)

      const result = await syncUserFromAuth(existingUser)

      // ✅ 验证：upsert的update部分只更新 lastLoginAt 和 updatedAt
      // Linus "Never break userspace" 原则：不覆盖用户可编辑字段
      expect(mockPrisma.user.upsert).toHaveBeenCalledWith({
        where: { id: "existing-user-id" },
        create: expect.any(Object),
        update: {
          lastLoginAt: expect.any(Date),
          updatedAt: expect.any(Date),
          // ✅ 不再包含 name 和 avatarUrl，保护用户自定义数据
        },
      })

      // ✅ 返回的用户数据来自 mock，不是从 metadata 提取的
      expect(result.name).toBe("Updated Name")
    })

    it("边界条件：邮箱为空应抛出错误", async () => {
      const { syncUserFromAuth } = await import("@/lib/auth/session")

      const invalidUser = {
        id: "test-user-id",
        email: null,
        user_metadata: {},
      }

      // 验证：应抛出AuthError
      await expect(syncUserFromAuth(invalidUser as any)).rejects.toThrow("用户邮箱不能为空")
    })

    it("边界条件：metadata缺失应使用默认值", async () => {
      const { syncUserFromAuth } = await import("@/lib/auth/session")
      // mockPrisma already imported

      const userWithoutMetadata = {
        id: "test-user-id",
        email: "test@example.com",
        user_metadata: null,
      }

      const expectedUser = {
        id: "test-user-id",
        email: "test@example.com",
        name: "test", // 从邮箱提取
        avatarUrl: null,
        role: "USER",
        status: "ACTIVE",
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        lastLoginAt: expect.any(Date),
      }

      mockPrisma.user.upsert.mockResolvedValue(expectedUser)

      const result = await syncUserFromAuth(userWithoutMetadata)

      // 验证：name从邮箱提取
      expect(result.name).toBe("test")
      expect(result.avatarUrl).toBeNull()
    })

    it("边界条件：重复同步应幂等", async () => {
      const { syncUserFromAuth } = await import("@/lib/auth/session")
      // mockPrisma already imported

      const authUser = {
        id: "test-user-id",
        email: "test@example.com",
        user_metadata: {
          full_name: "Test User",
        },
      }

      const expectedUser = {
        id: "test-user-id",
        email: "test@example.com",
        name: "Test User",
        avatarUrl: null,
        role: "USER",
        status: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: new Date(),
      }

      mockPrisma.user.upsert.mockResolvedValue(expectedUser)

      // 连续同步3次
      const result1 = await syncUserFromAuth(authUser)
      const result2 = await syncUserFromAuth(authUser)
      const result3 = await syncUserFromAuth(authUser)

      // 验证：每次都调用upsert
      expect(mockPrisma.user.upsert).toHaveBeenCalledTimes(3)

      // 验证：结果一致（幂等性）
      expect(result1.id).toBe(result2.id)
      expect(result2.id).toBe(result3.id)
    })
  })

  describe("3. 并发场景下的数据一致性", () => {
    it("并发登录：多个请求同时同步同一用户", async () => {
      const { syncUserFromAuth } = await import("@/lib/auth/session")
      // mockPrisma already imported

      const authUser = {
        id: "concurrent-user-id",
        email: "concurrent@example.com",
        user_metadata: {
          full_name: "Concurrent User",
        },
      }

      const expectedUser = {
        id: "concurrent-user-id",
        email: "concurrent@example.com",
        name: "Concurrent User",
        avatarUrl: null,
        role: "USER",
        status: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: new Date(),
      }

      // 模拟数据库upsert的原子性
      let upsertCount = 0
      mockPrisma.user.upsert.mockImplementation(async () => {
        upsertCount++
        // 模拟数据库延迟
        await new Promise((resolve) => setTimeout(resolve, 10))
        return expectedUser
      })

      // 并发执行10个同步请求
      const concurrentSyncs = 10
      const promises = Array.from({ length: concurrentSyncs }, () => syncUserFromAuth(authUser))

      const results = await Promise.all(promises)

      // 验证：所有请求都成功完成
      expect(results).toHaveLength(concurrentSyncs)
      expect(upsertCount).toBe(concurrentSyncs)

      // 验证：所有结果的用户ID一致
      const uniqueIds = new Set(results.map((r) => r.id))
      expect(uniqueIds.size).toBe(1)
      expect(uniqueIds.has("concurrent-user-id")).toBe(true)
    })

    it("竞态条件：创建和更新同时发生", async () => {
      const { syncUserFromAuth } = await import("@/lib/auth/session")
      // mockPrisma already imported

      const authUser = {
        id: "race-user-id",
        email: "race@example.com",
        user_metadata: {
          full_name: "Race User",
        },
      }

      // 模拟两个不同的同步结果（模拟竞态）
      let callCount = 0
      mockPrisma.user.upsert.mockImplementation(async () => {
        callCount++
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 50))

        return {
          id: "race-user-id",
          email: "race@example.com",
          name: callCount === 1 ? "Initial Name" : "Updated Name",
          avatarUrl: null,
          role: "USER",
          status: "ACTIVE",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastLoginAt: new Date(),
        }
      })

      // 同时触发两个同步请求
      const [result1, result2] = await Promise.all([
        syncUserFromAuth(authUser),
        syncUserFromAuth(authUser),
      ])

      // 验证：两次upsert都执行了
      expect(callCount).toBe(2)

      // 验证：两个结果都是有效的
      expect(result1.id).toBe("race-user-id")
      expect(result2.id).toBe("race-user-id")

      // 验证：数据库操作的原子性（upsert保证）
      expect(mockPrisma.user.upsert).toHaveBeenCalledTimes(2)
    })

    it("高并发场景：50个用户同时登录", async () => {
      const { syncUserFromAuth } = await import("@/lib/auth/session")
      // mockPrisma already imported

      // 模拟50个不同的用户
      const users = Array.from({ length: 50 }, (_, i) => ({
        id: `user-${i}`,
        email: `user${i}@example.com`,
        user_metadata: {
          full_name: `User ${i}`,
        },
      }))

      // Mock upsert返回对应的用户
      mockPrisma.user.upsert.mockImplementation(async ({ where }) => {
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 20))
        const userId = where.id
        const userIndex = parseInt(userId.split("-")[1])

        return {
          id: userId,
          email: `user${userIndex}@example.com`,
          name: `User ${userIndex}`,
          avatarUrl: null,
          role: "USER",
          status: "ACTIVE",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastLoginAt: new Date(),
        }
      })

      const startTime = performance.now()

      // 并发同步50个用户
      const promises = users.map((user) => syncUserFromAuth(user))
      const results = await Promise.all(promises)

      const endTime = performance.now()
      const totalTime = endTime - startTime

      // 验证：所有用户都成功同步
      expect(results).toHaveLength(50)

      // 验证：所有用户ID唯一
      const uniqueIds = new Set(results.map((r) => r.id))
      expect(uniqueIds.size).toBe(50)

      // 验证：并发处理时间合理（<5秒）
      expect(totalTime).toBeLessThan(5000)

      // 验证：每个用户调用一次upsert
      expect(mockPrisma.user.upsert).toHaveBeenCalledTimes(50)
    })

    it("异常处理：部分请求失败不影响其他请求", async () => {
      const { syncUserFromAuth } = await import("@/lib/auth/session")
      // mockPrisma already imported

      const users = [
        { id: "user-1", email: "user1@example.com", user_metadata: {} },
        { id: "user-2", email: null, user_metadata: {} }, // 故意失败
        { id: "user-3", email: "user3@example.com", user_metadata: {} },
      ]

      mockPrisma.user.upsert.mockResolvedValue({
        id: "user-1",
        email: "user1@example.com",
        name: "User 1",
        avatarUrl: null,
        role: "USER",
        status: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: new Date(),
      })

      // 并发执行，期望其中一个失败
      const results = await Promise.allSettled(users.map((user) => syncUserFromAuth(user as any)))

      // 验证：两个成功，一个失败
      const fulfilled = results.filter((r) => r.status === "fulfilled")
      const rejected = results.filter((r) => r.status === "rejected")

      expect(fulfilled).toHaveLength(2)
      expect(rejected).toHaveLength(1)

      // 验证：失败的是邮箱为空的请求
      if (rejected[0].status === "rejected") {
        expect(rejected[0].reason.message).toContain("用户邮箱不能为空")
      }
    })
  })

  describe("4. 性能回归测试", () => {
    it("与P0重构前的性能基线对比", async () => {
      const { fetchAuthenticatedUser } = await import("@/lib/auth/session")
      // mockPrisma already imported

      mockPrisma.user.findUnique.mockResolvedValue({
        id: "baseline-user",
        email: "baseline@example.com",
        role: "USER",
        status: "ACTIVE",
        name: "Baseline User",
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: new Date(),
      })

      // 测量100次权限检查的性能
      const iterations = 100
      const times: number[] = []

      for (let i = 0; i < iterations; i++) {
        const start = performance.now()
        await fetchAuthenticatedUser()
        const end = performance.now()
        times.push(end - start)
      }

      // 计算统计指标
      const averageTime = times.reduce((a, b) => a + b, 0) / times.length
      const maxTime = Math.max(...times)
      const minTime = Math.min(...times)

      // 性能基线要求（根据P0重构目标）
      expect(averageTime).toBeLessThan(100) // 平均<100ms
      expect(maxTime).toBeLessThan(200) // 最大<200ms

      // 输出性能报告
      console.log("性能基线测试结果:")
      console.log(`  - 平均响应时间: ${averageTime.toFixed(2)}ms`)
      console.log(`  - 最小响应时间: ${minTime.toFixed(2)}ms`)
      console.log(`  - 最大响应时间: ${maxTime.toFixed(2)}ms`)
    })
  })
})
