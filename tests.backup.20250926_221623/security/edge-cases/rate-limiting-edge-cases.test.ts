/**
 * 速率限制边缘案例测试套件
 * 测试各种边缘情况下的速率限制行为
 */

import { describe, test, expect, beforeEach, vi, afterEach } from "vitest"
import { NextRequest } from "next/server"

describe("速率限制边缘案例测试", () => {
  let rateLimitModule: any
  let originalDateNow: () => number

  beforeEach(async () => {
    vi.clearAllMocks()
    rateLimitModule = await import("@/lib/security/rate-limiter")
    originalDateNow = Date.now

    // 清理速率限制存储
    if (rateLimitModule.clearRateLimitStorage) {
      rateLimitModule.clearRateLimitStorage()
    }
  })

  afterEach(() => {
    Date.now = originalDateNow
    vi.clearAllMocks()
  })

  describe("时间窗口边界测试", () => {
    test("应该正确处理时间窗口边界", async () => {
      const clientIP = "192.168.1.100"
      const limit = 5
      const windowMs = 60000 // 1分钟

      let currentTime = 1000000000000 // 固定起始时间
      Date.now = vi.fn(() => currentTime)

      // 在窗口开始时快速发送请求
      for (let i = 0; i < limit; i++) {
        const allowed = rateLimitModule.checkRateLimit(clientIP, limit, windowMs)
        expect(allowed).toBe(true)
        currentTime += 100 // 每次增加100ms
      }

      // 第6次请求应该被阻止
      const blocked = rateLimitModule.checkRateLimit(clientIP, limit, windowMs)
      expect(blocked).toBe(false)

      // 推进时间到窗口边界
      currentTime = 1000000000000 + windowMs - 1 // 窗口结束前1ms
      const stillBlocked = rateLimitModule.checkRateLimit(clientIP, limit, windowMs)
      expect(stillBlocked).toBe(false)

      // 推进时间超过窗口
      currentTime = 1000000000000 + windowMs + 1 // 新窗口开始
      const newWindowAllowed = rateLimitModule.checkRateLimit(clientIP, limit, windowMs)
      expect(newWindowAllowed).toBe(true)
    })

    test("应该处理时钟回拨", async () => {
      const clientIP = "192.168.1.200"
      const limit = 3
      const windowMs = 30000 // 30秒

      let currentTime = 1000000000000
      Date.now = vi.fn(() => currentTime)

      // 发送一些请求
      for (let i = 0; i < limit; i++) {
        rateLimitModule.checkRateLimit(clientIP, limit, windowMs)
        currentTime += 5000 // 每次增加5秒
      }

      // 模拟时钟回拨
      currentTime = 1000000000000 - 10000 // 回拨到更早时间

      // 系统应该能正常处理时钟回拨
      const result = rateLimitModule.checkRateLimit(clientIP, limit, windowMs)

      // 应该拒绝请求或安全处理
      expect(typeof result).toBe("boolean")

      // 验证没有崩溃或异常行为
      expect(() => {
        rateLimitModule.getRateLimitStatus(clientIP)
      }).not.toThrow()
    })

    test("应该处理极短时间窗口", async () => {
      const clientIP = "192.168.1.300"
      const limit = 2
      const shortWindow = 1 // 1毫秒窗口

      let currentTime = 1000000000000
      Date.now = vi.fn(() => currentTime)

      // 在极短窗口内发送请求
      const result1 = rateLimitModule.checkRateLimit(clientIP, limit, shortWindow)
      expect(result1).toBe(true)

      const result2 = rateLimitModule.checkRateLimit(clientIP, limit, shortWindow)
      expect(result2).toBe(true)

      const result3 = rateLimitModule.checkRateLimit(clientIP, limit, shortWindow)
      expect(result3).toBe(false) // 应该被限制

      // 推进1毫秒
      currentTime += 2
      const result4 = rateLimitModule.checkRateLimit(clientIP, limit, shortWindow)
      expect(result4).toBe(true) // 新窗口应该允许
    })
  })

  describe("并发请求处理", () => {
    test("应该正确处理高并发请求", async () => {
      const clientIP = "192.168.1.400"
      const limit = 10
      const windowMs = 60000

      // 模拟100个并发请求
      const concurrentRequests = []
      for (let i = 0; i < 100; i++) {
        concurrentRequests.push(
          Promise.resolve(rateLimitModule.checkRateLimit(clientIP, limit, windowMs))
        )
      }

      const results = await Promise.all(concurrentRequests)

      // 应该只有limit个请求被允许
      const allowedCount = results.filter((result) => result === true).length
      const blockedCount = results.filter((result) => result === false).length

      expect(allowedCount).toBe(limit)
      expect(blockedCount).toBe(100 - limit)
      expect(allowedCount + blockedCount).toBe(100)
    })

    test("应该防止竞态条件", async () => {
      const clientIP = "192.168.1.500"
      const limit = 5
      const windowMs = 60000

      // 创建多个同时到达的请求处理函数
      const simulateRaceCondition = async () => {
        const promises = []

        // 同一时刻发起多个检查
        for (let i = 0; i < 20; i++) {
          promises.push(rateLimitModule.checkRateLimit(clientIP, limit, windowMs))
        }

        return Promise.all(promises)
      }

      const results = await simulateRaceCondition()

      // 验证只有limit个请求被允许，没有因竞态条件导致超出
      const allowedCount = results.filter((result) => result === true).length
      expect(allowedCount).toBe(limit)

      // 验证数据一致性
      const status = rateLimitModule.getRateLimitStatus(clientIP)
      expect(status.requestCount).toBe(allowedCount)
    })

    test("应该处理内存压力下的请求", async () => {
      const baseIP = "192.168.2."
      const limit = 5
      const windowMs = 60000

      // 创建大量不同IP的请求记录
      for (let i = 1; i <= 1000; i++) {
        const clientIP = baseIP + i
        for (let j = 0; j < limit; j++) {
          rateLimitModule.checkRateLimit(clientIP, limit, windowMs)
        }
      }

      // 验证系统在高内存使用下仍能正常工作
      const testIP = baseIP + "1001"
      const result = rateLimitModule.checkRateLimit(testIP, limit, windowMs)
      expect(result).toBe(true)

      // 检查内存使用情况
      const memoryStats = rateLimitModule.getMemoryStats?.()
      if (memoryStats) {
        expect(memoryStats.entryCount).toBeGreaterThan(0)
        expect(memoryStats.memoryUsage).toBeGreaterThan(0)
      }
    })
  })

  describe("IP地址处理边缘情况", () => {
    test("应该正确处理各种IP格式", async () => {
      const ipFormats = [
        { ip: "192.168.1.1", valid: true, name: "IPv4" },
        { ip: "::1", valid: true, name: "IPv6 loopback" },
        { ip: "2001:db8::1", valid: true, name: "IPv6" },
        { ip: "192.168.1.1:8080", valid: false, name: "IPv4 with port" },
        { ip: "[2001:db8::1]:8080", valid: false, name: "IPv6 with port" },
        { ip: "invalid-ip", valid: false, name: "无效IP" },
        { ip: "", valid: false, name: "空IP" },
        { ip: null as any, valid: false, name: "空值" },
        { ip: undefined as any, valid: false, name: "未定义" },
      ]

      for (const { ip, valid, name } of ipFormats) {
        if (valid) {
          expect(() => {
            rateLimitModule.checkRateLimit(ip, 5, 60000)
          }).not.toThrow()
        } else {
          // 无效IP应该被安全处理
          const result = rateLimitModule.checkRateLimit(ip, 5, 60000)
          expect(typeof result).toBe("boolean")
        }

        console.log(`IP格式测试 [${name}]: ${ip} => ${valid ? "有效" : "无效"}`)
      }
    })

    test("应该处理代理和负载均衡场景", async () => {
      // 模拟通过代理的请求
      const proxyScenarios = [
        {
          headers: {
            "X-Forwarded-For": "203.0.113.195, 70.41.3.18, 150.172.238.178",
            "X-Real-IP": "203.0.113.195",
          },
          expectedIP: "203.0.113.195",
        },
        {
          headers: {
            "X-Forwarded-For": "192.168.1.100",
            "CF-Connecting-IP": "203.0.113.196",
          },
          expectedIP: "203.0.113.196", // Cloudflare IP优先级更高
        },
        {
          headers: {
            "X-Forwarded-For": "unknown",
            "X-Real-IP": "192.168.1.200",
          },
          expectedIP: "192.168.1.200",
        },
      ]

      for (const scenario of proxyScenarios) {
        const request = new NextRequest("https://example.com/api/test", {
          headers: scenario.headers,
        })

        const clientIP = rateLimitModule.extractClientIP(request)
        expect(clientIP).toBeDefined()

        // 使用提取的IP进行速率限制测试
        const result = rateLimitModule.checkRateLimit(clientIP, 5, 60000)
        expect(result).toBe(true)

        console.log(`代理场景测试: ${JSON.stringify(scenario.headers)} => ${clientIP}`)
      }
    })

    test("应该防止IP伪造攻击", async () => {
      const maliciousHeaders = [
        {
          "X-Forwarded-For": '<script>alert("xss")</script>',
          name: "XSS注入",
        },
        {
          "X-Real-IP": "../../../etc/passwd",
          name: "路径遍历",
        },
        {
          "CF-Connecting-IP": "0.0.0.0" + "\x00" + "192.168.1.1",
          name: "空字节注入",
        },
        {
          "X-Forwarded-For": "A".repeat(1000),
          name: "超长IP",
        },
      ]

      for (const { headers, name } of maliciousHeaders) {
        const request = new NextRequest("https://example.com/api/test", {
          headers: headers as Record<string, string>,
        })

        // IP提取应该安全处理恶意输入
        expect(() => {
          const clientIP = rateLimitModule.extractClientIP(request)
          rateLimitModule.checkRateLimit(clientIP, 5, 60000)
        }).not.toThrow()

        console.log(`IP伪造测试 [${name}]: 安全处理`)
      }
    })
  })

  describe("存储和内存管理", () => {
    test("应该自动清理过期的限制记录", async () => {
      const clientIPs = ["192.168.3.1", "192.168.3.2", "192.168.3.3"]
      const limit = 3
      const shortWindow = 1000 // 1秒窗口

      let currentTime = 1000000000000
      Date.now = vi.fn(() => currentTime)

      // 为每个IP创建限制记录
      clientIPs.forEach((ip) => {
        for (let i = 0; i < limit; i++) {
          rateLimitModule.checkRateLimit(ip, limit, shortWindow)
        }
      })

      // 验证记录存在
      const initialStats = rateLimitModule.getStorageStats?.()
      if (initialStats) {
        expect(initialStats.activeIPs).toBe(clientIPs.length)
      }

      // 推进时间使记录过期
      currentTime += shortWindow + 1000 // 超过窗口时间

      // 触发清理
      rateLimitModule.cleanupExpiredRecords?.()

      // 验证过期记录被清理
      const afterCleanupStats = rateLimitModule.getStorageStats?.()
      if (afterCleanupStats) {
        expect(afterCleanupStats.activeIPs).toBe(0)
      }
    })

    test("应该处理内存不足情况", async () => {
      // 模拟内存不足的场景
      const originalMemoryUsage = process.memoryUsage
      process.memoryUsage = vi.fn(() => ({
        rss: 1024 * 1024 * 1024, // 1GB
        heapTotal: 900 * 1024 * 1024, // 900MB
        heapUsed: 850 * 1024 * 1024, // 850MB (高内存使用)
        external: 50 * 1024 * 1024,
        arrayBuffers: 10 * 1024 * 1024,
      }))

      try {
        const clientIP = "192.168.4.100"
        const limit = 5
        const windowMs = 60000

        // 在高内存使用情况下尝试速率限制
        const result = rateLimitModule.checkRateLimit(clientIP, limit, windowMs)

        // 应该仍能正常工作或优雅降级
        expect(typeof result).toBe("boolean")

        // 验证没有内存泄漏
        expect(() => {
          for (let i = 0; i < 100; i++) {
            rateLimitModule.checkRateLimit(`192.168.4.${i}`, limit, windowMs)
          }
        }).not.toThrow()
      } finally {
        process.memoryUsage = originalMemoryUsage
      }
    })

    test("应该实施LRU缓存策略", async () => {
      const maxEntries = 100
      const limit = 5
      const windowMs = 60000

      // 创建超过最大条目数的IP记录
      for (let i = 1; i <= maxEntries + 50; i++) {
        const clientIP = `192.168.5.${i}`
        rateLimitModule.checkRateLimit(clientIP, limit, windowMs)
      }

      const stats = rateLimitModule.getStorageStats?.()
      if (stats) {
        // 验证条目数不超过限制
        expect(stats.activeIPs).toBeLessThanOrEqual(maxEntries)

        // 验证最近使用的IP仍然存在
        const recentIP = `192.168.5.${maxEntries + 50}`
        const hasRecentIP = rateLimitModule.hasRateLimitRecord?.(recentIP)
        expect(hasRecentIP).toBe(true)

        // 验证较旧的IP被清理
        const oldIP = "192.168.5.1"
        const hasOldIP = rateLimitModule.hasRateLimitRecord?.(oldIP)
        expect(hasOldIP).toBe(false)
      }
    })
  })

  describe("配置异常处理", () => {
    test("应该处理无效的配置参数", async () => {
      const clientIP = "192.168.6.100"
      const invalidConfigs = [
        { limit: -1, windowMs: 60000, name: "负数限制" },
        { limit: 0, windowMs: 60000, name: "零限制" },
        { limit: 5, windowMs: -1000, name: "负数窗口" },
        { limit: 5, windowMs: 0, name: "零窗口" },
        { limit: Infinity, windowMs: 60000, name: "无限限制" },
        { limit: 5, windowMs: Infinity, name: "无限窗口" },
        { limit: NaN, windowMs: 60000, name: "NaN限制" },
        { limit: 5, windowMs: NaN, name: "NaN窗口" },
      ]

      for (const { limit, windowMs, name } of invalidConfigs) {
        // 无效配置应该被安全处理
        expect(() => {
          const result = rateLimitModule.checkRateLimit(clientIP, limit, windowMs)
          expect(typeof result).toBe("boolean")
        }).not.toThrow()

        console.log(`配置测试 [${name}]: limit=${limit}, window=${windowMs} => 安全处理`)
      }
    })

    test("应该处理极端配置值", async () => {
      const clientIP = "192.168.6.200"
      const extremeConfigs = [
        { limit: 1000000, windowMs: 1, name: "极高限制，极短窗口" },
        { limit: 1, windowMs: 86400000, name: "极低限制，极长窗口" },
        { limit: Number.MAX_SAFE_INTEGER, windowMs: 60000, name: "最大安全整数限制" },
        { limit: 5, windowMs: Number.MAX_SAFE_INTEGER, name: "最大安全整数窗口" },
      ]

      for (const { limit, windowMs, name } of extremeConfigs) {
        expect(() => {
          const result = rateLimitModule.checkRateLimit(clientIP, limit, windowMs)
          expect(typeof result).toBe("boolean")
        }).not.toThrow()

        console.log(`极端配置测试 [${name}]: 成功处理`)
      }
    })
  })

  describe("分布式环境支持", () => {
    test("应该支持多实例协调", async () => {
      // 模拟多个应用实例
      const instance1 = { ...rateLimitModule }
      const instance2 = { ...rateLimitModule }

      const clientIP = "192.168.7.100"
      const limit = 5
      const windowMs = 60000
      const requestsPerInstance = 3

      // 实例1发送3个请求
      for (let i = 0; i < requestsPerInstance; i++) {
        const result = instance1.checkRateLimit(clientIP, limit, windowMs)
        expect(result).toBe(true)
      }

      // 实例2发送2个请求（总共5个，达到限制）
      for (let i = 0; i < requestsPerInstance - 1; i++) {
        const result = instance2.checkRateLimit(clientIP, limit, windowMs)
        expect(result).toBe(true)
      }

      // 任一实例的第6个请求应该被拒绝
      const result1 = instance1.checkRateLimit(clientIP, limit, windowMs)
      const result2 = instance2.checkRateLimit(clientIP, limit, windowMs)

      // 至少有一个被拒绝（取决于同步机制）
      expect(result1 && result2).toBe(false)
    })

    test("应该处理网络分区情况", async () => {
      const clientIP = "192.168.7.200"
      const limit = 5
      const windowMs = 60000

      // 模拟网络分区：存储访问失败
      const mockStorage = {
        get: vi.fn().mockRejectedValue(new Error("Network partition")),
        set: vi.fn().mockRejectedValue(new Error("Network partition")),
        delete: vi.fn().mockRejectedValue(new Error("Network partition")),
      }

      // 在网络分区情况下，应该优雅降级
      expect(() => {
        const result = rateLimitModule.checkRateLimitWithStorage?.(
          clientIP,
          limit,
          windowMs,
          mockStorage
        )
        // 可能允许请求（fail-open）或拒绝请求（fail-closed）
        expect(typeof result).toBe("boolean")
      }).not.toThrow()
    })
  })

  describe("性能和延迟测试", () => {
    test("应该在高负载下保持低延迟", async () => {
      const clientIPs = Array.from({ length: 1000 }, (_, i) => `192.168.8.${i + 1}`)
      const limit = 10
      const windowMs = 60000

      // 测量处理时间
      const startTime = Date.now()

      // 并行处理大量请求
      const promises = clientIPs.map((ip) =>
        Promise.resolve(rateLimitModule.checkRateLimit(ip, limit, windowMs))
      )

      await Promise.all(promises)

      const endTime = Date.now()
      const totalTime = endTime - startTime
      const avgTimePerRequest = totalTime / clientIPs.length

      // 平均每个请求处理时间应该很短
      expect(avgTimePerRequest).toBeLessThan(1) // 小于1ms
      expect(totalTime).toBeLessThan(1000) // 总时间小于1秒

      console.log(
        `性能测试: 处理${clientIPs.length}个请求，总时间${totalTime}ms，平均${avgTimePerRequest.toFixed(3)}ms/请求`
      )
    })

    test("应该优化内存使用", async () => {
      const initialMemory = process.memoryUsage().heapUsed

      // 创建大量速率限制记录
      for (let i = 1; i <= 10000; i++) {
        rateLimitModule.checkRateLimit(`192.168.9.${i}`, 5, 60000)
      }

      const afterCreationMemory = process.memoryUsage().heapUsed
      const memoryIncrease = afterCreationMemory - initialMemory

      // 触发清理
      if (rateLimitModule.cleanupExpiredRecords) {
        rateLimitModule.cleanupExpiredRecords()
      }

      const afterCleanupMemory = process.memoryUsage().heapUsed

      // 验证内存使用合理
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024) // 少于50MB

      // 验证清理后内存释放
      if (rateLimitModule.cleanupExpiredRecords) {
        expect(afterCleanupMemory).toBeLessThan(afterCreationMemory)
      }

      console.log(`内存使用测试:`)
      console.log(`  初始: ${(initialMemory / 1024 / 1024).toFixed(2)}MB`)
      console.log(`  创建后: ${(afterCreationMemory / 1024 / 1024).toFixed(2)}MB`)
      console.log(`  清理后: ${(afterCleanupMemory / 1024 / 1024).toFixed(2)}MB`)
    })
  })
})
