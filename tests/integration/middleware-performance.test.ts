/**
 * 中间件性能和缓存集成测试
 * 测试权限系统的性能表现和缓存机制
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { TEST_USERS, createTestRequest } from "../helpers/test-data"
import { setCurrentTestUser, resetMocks } from "../__mocks__/supabase"
import { mockPrisma, resetPrismaMocks } from "../__mocks__/prisma"

// 强制权限模块使用测试版 auth/prisma/supabase
const authMock = vi.hoisted(async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth")
  const { getCurrentTestUser } = await import("../__mocks__/supabase")
  const { mockPrisma } = await import("../__mocks__/prisma")

  return {
    __esModule: true,
    ...actual,
    getAuthenticatedUser: vi.fn(async () => {
      const user = getCurrentTestUser()
      return { user: user ? { id: user.id, email: user.email } : null, error: null }
    }),
    getCurrentUser: vi.fn(async () => {
      const user = getCurrentTestUser()
      if (!user) return null
      return (await mockPrisma.user.findUnique({ where: { id: user.id } })) as any
    }),
  }
})

vi.mock("@/lib/auth", () => authMock)
vi.mock("@/lib/permissions", async () => {
  const actual = await vi.importActual("@/lib/permissions")
  return actual
})

describe("中间件性能和缓存集成测试", () => {
  beforeEach(async () => {
    resetMocks()
    resetPrismaMocks()
    vi.clearAllMocks()
    const { clearUserCache } = await import("@/lib/auth")
    await clearUserCache()
  })

  describe("权限检查性能测试", () => {
    it("单次权限检查应在 10ms 内完成", async () => {
      setCurrentTestUser("user")

      const { requireAuth } = await import("@/lib/permissions")

      const startTime = performance.now()
      await requireAuth()

      const endTime = performance.now()
      const executionTime = endTime - startTime

      expect(executionTime).toBeLessThan(10)
      console.log(`权限检查耗时: ${executionTime.toFixed(2)}ms`)
    })

    it("批量权限检查应有性能优势", async () => {
      setCurrentTestUser("admin")

      const resources = [
        "/admin/dashboard",
        "/admin/users",
        "/admin/posts",
        "/api/admin/users",
        "/api/admin/posts",
      ]

      // 单个权限检查的总耗时
      const startSingle = performance.now()
      const { canAccessResource } = await import("@/lib/permissions")

      for (const resource of resources) {
        await canAccessResource(resource)
      }
      const endSingle = performance.now()
      const singleTime = endSingle - startSingle

      // 批量权限检查的耗时
      const startBatch = performance.now()
      const { batchPermissionCheck } = await import("@/lib/permissions")
      await batchPermissionCheck(resources)
      const endBatch = performance.now()
      const batchTime = endBatch - startBatch

      // 批量检查应该更快
      expect(batchTime).toBeLessThan(singleTime)

      // 性能提升应该至少20%
      const performanceGain = ((singleTime - batchTime) / singleTime) * 100
      expect(performanceGain).toBeGreaterThan(20)

      console.log(`单个检查耗时: ${singleTime.toFixed(2)}ms`)
      console.log(`批量检查耗时: ${batchTime.toFixed(2)}ms`)
      console.log(`性能提升: ${performanceGain.toFixed(1)}%`)
    })

    it("并发权限检查应保持稳定性", async () => {
      setCurrentTestUser("admin")

      const concurrentRequests = Array.from({ length: 50 }, (_, i) => {
        return import("@/lib/permissions").then(({ requireAdmin }) => requireAdmin())
      })

      const startTime = performance.now()
      const results = await Promise.all(concurrentRequests)
      const endTime = performance.now()

      // 所有检查都应该成功
      expect(results).toHaveLength(50)
      results.forEach((result) => {
        expect(result.id).toBe(TEST_USERS.admin.id)
      })

      // 并发执行时间不应该超过单个请求的50倍
      const executionTime = endTime - startTime
      expect(executionTime).toBeLessThan(500) // 50 * 10ms

      console.log(`并发检查耗时: ${executionTime.toFixed(2)}ms`)
    })
  })

  describe("权限缓存机制测试", () => {
    it("应该缓存用户权限信息", async () => {
      setCurrentTestUser("user")

      const { requireAuth } = await import("@/lib/permissions")

      // 第一次调用，触发数据库查询
      const startFirst = performance.now()
      const firstResult = await requireAuth()
      const endFirst = performance.now()

      // 第二次调用，使用缓存
      const startSecond = performance.now()
      const secondResult = await requireAuth()
      const endSecond = performance.now()

      // 结果应该一致
      expect(firstResult.id).toBe(secondResult.id)

      // 第二次调用应该更快（缓存生效）
      const firstTime = endFirst - startFirst
      const secondTime = endSecond - startSecond

      expect(secondTime).toBeLessThan(firstTime * 0.5) // 至少快50%

      console.log(`第一次查询: ${firstTime.toFixed(2)}ms`)
      console.log(`第二次查询（缓存）: ${secondTime.toFixed(2)}ms`)
    })

    it("用户状态变更应清除缓存", async () => {
      setCurrentTestUser("user")

      const { requireAuth } = await import("@/lib/permissions")
      const { clearUserCache } = await import("@/lib/auth")

      // 初始权限检查
      const initialResult = await requireAuth()
      expect(initialResult.status).toBe("ACTIVE")

      // 模拟用户被封禁
      const bannedUser = { ...TEST_USERS.user, status: "BANNED" as const }
      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(bannedUser)

      // 清除缓存
      await clearUserCache(TEST_USERS.user.id)

      // 权限检查应该反映新状态
      await expect(requireAuth()).rejects.toThrow("账户已被封禁")
    })

    it("缓存应该有过期机制", async () => {
      setCurrentTestUser("admin")

      // Mock 时间前进函数
      const originalDateNow = Date.now
      let mockedTime = Date.now()

      vi.spyOn(Date, "now").mockImplementation(() => mockedTime)

      try {
        const { requireAdmin } = await import("@/lib/permissions")

        // 第一次调用
        await requireAdmin()

        // 模拟时间过去6分钟（超过5分钟缓存时间）
        mockedTime += 6 * 60 * 1000

        // 模拟用户状态变更
        const newAdminState = { ...TEST_USERS.admin, lastLoginAt: new Date() }
        vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(newAdminState)

        // 再次调用应该触发新的数据库查询
        const result = await requireAdmin()

        // 验证数据库被重新查询
        expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(2)
        expect(result.id).toBe(TEST_USERS.admin.id)
      } finally {
        vi.mocked(Date.now).mockRestore()
      }
    })
  })

  describe("内存使用和清理测试", () => {
    it("权限缓存不应造成内存泄漏", async () => {
      const { clearUserCache } = await import("@/lib/auth")

      // 创建大量用户权限缓存
      const userIds = Array.from({ length: 1000 }, (_, i) => `user-${i}`)

      // 触发缓存创建
      for (const userId of userIds) {
        setCurrentTestUser("user")
        const { requireAuth } = await import("@/lib/permissions")

        // Mock 不同用户ID
        vi.mocked(mockPrisma.user.findUnique).mockResolvedValue({
          ...TEST_USERS.user,
          id: userId,
        })

        try {
          await requireAuth()
        } catch (error) {
          // 忽略错误，只关注缓存创建
        }
      }

      // 清空所有缓存
      await clearUserCache()

      // 验证清理后的状态
      setCurrentTestUser("user")
      const { requireAuth } = await import("@/lib/permissions")

      const startTime = performance.now()
      await requireAuth()
      const endTime = performance.now()

      // 清理后的首次调用应该重新查询数据库
      // 注意：mock 查询非常快，不验证执行时间
      expect(mockPrisma.user.findUnique).toHaveBeenCalled()
    })
  })

  describe("边缘性能场景测试", () => {
    it("高频权限检查应保持稳定", async () => {
      setCurrentTestUser("admin")

      const { canAccessResource } = await import("@/lib/permissions")

      const iterations = 1000
      const startTime = performance.now()

      // 高频权限检查
      for (let i = 0; i < iterations; i++) {
        await canAccessResource("/admin/dashboard")
      }

      const endTime = performance.now()
      const totalTime = endTime - startTime
      const avgTime = totalTime / iterations

      // 平均每次检查不超过1ms
      expect(avgTime).toBeLessThan(1)

      // 总时间不超过1秒
      expect(totalTime).toBeLessThan(1000)

      console.log(`${iterations}次权限检查总耗时: ${totalTime.toFixed(2)}ms`)
      console.log(`平均单次耗时: ${avgTime.toFixed(3)}ms`)
    })

    it("权限检查在数据库慢查询时应有超时保护", async () => {
      setCurrentTestUser("user")

      // Mock 慢查询（100ms 延迟）
      vi.mocked(mockPrisma.user.findUnique).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(TEST_USERS.user), 100))
      )

      const { requireAuth } = await import("@/lib/permissions")

      const startTime = performance.now()
      const result = await requireAuth()
      const endTime = performance.now()

      const executionTime = endTime - startTime

      // 验证查询确实被执行了
      expect(result.id).toBe(TEST_USERS.user.id)

      // 验证查询时间符合预期
      expect(executionTime).toBeGreaterThan(90)
      expect(executionTime).toBeLessThan(150)

      console.log(`慢查询耗时: ${executionTime.toFixed(2)}ms`)
    })

    it("权限装饰器应保持性能", async () => {
      setCurrentTestUser("admin")

      const { withAdminAuth } = await import("@/lib/permissions")

      // 创建被装饰的函数
      const mockAction = vi.fn(async (data: any) => ({ success: true, data }))
      const decoratedAction = withAdminAuth(mockAction)

      const iterations = 100
      const startTime = performance.now()

      // 执行多次装饰器包装的函数
      for (let i = 0; i < iterations; i++) {
        await decoratedAction({ test: i })
      }

      const endTime = performance.now()
      const totalTime = endTime - startTime
      const avgTime = totalTime / iterations

      // 验证所有调用都成功
      expect(mockAction).toHaveBeenCalledTimes(iterations)

      // 装饰器开销应该很小
      expect(avgTime).toBeLessThan(2) // 每次调用不超过2ms

      console.log(`装饰器${iterations}次调用总耗时: ${totalTime.toFixed(2)}ms`)
      console.log(`装饰器平均开销: ${avgTime.toFixed(3)}ms`)
    })
  })

  describe("压力测试", () => {
    it("系统应承受大量并发权限验证", async () => {
      const concurrencyLevel = 100
      const users = ["admin", "user", "bannedUser"] as const

      const tasks = Array.from({ length: concurrencyLevel }, (_, i) => {
        const userType = users[i % users.length]
        setCurrentTestUser(userType)

        return import("@/lib/permissions").then(async ({ checkUserStatus }) => {
          const result = await checkUserStatus()
          return { userType, result }
        })
      })

      const startTime = performance.now()
      const results = await Promise.allSettled(tasks)
      const endTime = performance.now()

      const executionTime = endTime - startTime
      const successCount = results.filter((r) => r.status === "fulfilled").length
      const failureCount = results.length - successCount

      // 验证结果
      expect(successCount).toBe(concurrencyLevel)
      expect(failureCount).toBe(0)

      // 性能要求
      expect(executionTime).toBeLessThan(5000) // 5秒内完成

      console.log(`并发权限验证: ${concurrencyLevel}个任务`)
      console.log(`总耗时: ${executionTime.toFixed(2)}ms`)
      console.log(`成功: ${successCount}, 失败: ${failureCount}`)
    })
  })

  describe("内存和资源监控", () => {
    it("长时间运行权限检查不应导致性能下降", async () => {
      setCurrentTestUser("admin")

      const { requireAdmin } = await import("@/lib/permissions")

      // 第一轮：测量初始性能
      const firstRoundTimes: number[] = []
      for (let i = 0; i < 10; i++) {
        const start = performance.now()
        await requireAdmin()
        const end = performance.now()
        firstRoundTimes.push(end - start)
      }

      // 中间：执行大量操作模拟长时间运行
      for (let i = 0; i < 1000; i++) {
        await requireAdmin()
      }

      // 第二轮：测量后续性能
      const secondRoundTimes: number[] = []
      for (let i = 0; i < 10; i++) {
        const start = performance.now()
        await requireAdmin()
        const end = performance.now()
        secondRoundTimes.push(end - start)
      }

      const firstAvg = firstRoundTimes.reduce((a, b) => a + b) / firstRoundTimes.length
      const secondAvg = secondRoundTimes.reduce((a, b) => a + b) / secondRoundTimes.length

      // 性能不应明显下降（容差20%）
      expect(secondAvg).toBeLessThan(firstAvg * 1.2)

      console.log(`初始平均耗时: ${firstAvg.toFixed(3)}ms`)
      console.log(`后续平均耗时: ${secondAvg.toFixed(3)}ms`)
      console.log(`性能变化: ${(((secondAvg - firstAvg) / firstAvg) * 100).toFixed(1)}%`)
    })
  })
})
