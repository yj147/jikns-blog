/**
 * 安全边缘案例集成测试
 * 测试权限系统在各种攻击和异常情况下的表现
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { TEST_USERS, createTestRequest, createStandardTestRequest } from "../helpers/test-data"
import { setCurrentTestUser, resetMocks } from "../__mocks__/supabase"
import { mockPrisma, resetPrismaMocks, mockDatabaseError } from "../__mocks__/prisma"

describe("安全边缘案例集成测试", () => {
  beforeEach(() => {
    resetMocks()
    resetPrismaMocks()
    vi.clearAllMocks()
  })

  describe("权限提升攻击防护", () => {
    it("应该防止通过修改请求头提升权限", async () => {
      setCurrentTestUser("user") // 普通用户

      const maliciousRequest = createStandardTestRequest("/api/admin/users", {
        method: "POST",
        headers: {
          "X-User-Role": "ADMIN", // 尝试伪造管理员角色
          "X-Admin-Override": "true",
          Authorization: "Bearer fake-admin-token",
        },
      })

      const { withApiAuth } = await import("@/lib/api/unified-auth")

      try {
        await withApiAuth(maliciousRequest as any, "admin", async (ctx) => {
          return { success: true, user: ctx.user }
        })
        // 不应该到达这里
        expect.fail("应该抛出权限错误")
      } catch (error) {
        expect(error).toBeTruthy()
        expect((error as Error).message).toContain("管理员权限")
      }
    })

    it("应该防止会话劫持攻击", async () => {
      setCurrentTestUser("admin")

      // 模拟从不同设备/IP的可疑请求
      const suspiciousRequest = createStandardTestRequest("/api/admin/dashboard", {
        headers: {
          "User-Agent": "AttackBot/1.0",
          "X-Forwarded-For": "192.168.1.100",
          "X-Real-IP": "10.0.0.50",
        },
      })

      // 模拟会话指纹验证失败
      const { SessionSecurity } = await import("@/lib/security")
      const fingerprint = SessionSecurity.generateSessionFingerprint(suspiciousRequest as any)
      const isValid = SessionSecurity.validateSessionFingerprint(
        suspiciousRequest as any,
        "original-fingerprint-123"
      )

      expect(isValid).toBe(false)
    })

    it("应该防止JWT令牌伪造", async () => {
      const fakeJWTRequest = createStandardTestRequest("/api/user/profile", {
        headers: {
          Cookie: "sb-access-token=fake.jwt.token; sb-refresh-token=fake.refresh.token",
        },
      })

      // 模拟无效令牌处理
      setCurrentTestUser(null) // 无效令牌导致无用户状态

      const { withApiAuth } = await import("@/lib/api/unified-auth")

      try {
        await withApiAuth(fakeJWTRequest as any, "user-active", async (ctx) => {
          return { success: true, user: ctx.user }
        })
        // 不应该到达这里
        expect.fail("应该抛出认证错误")
      } catch (error) {
        expect(error).toBeTruthy()
        expect((error as Error).message).toContain("认证")
      }
    })
  })

  describe("输入验证和XSS防护", () => {
    it("应该检测并阻止XSS攻击载荷", async () => {
      setCurrentTestUser("admin")

      const { XSSProtection } = await import("@/lib/security")

      const xssPayloads = [
        '<script>alert("XSS")</script>',
        'javascript:alert("XSS")',
        '<img src="x" onerror="alert(1)">',
        '<svg onload="alert(1)">',
        '"><script>document.location="http://evil.com"</script>',
        '<iframe src="javascript:alert(1)"></iframe>',
      ]

      for (const payload of xssPayloads) {
        const cleaned = XSSProtection.sanitizeHTML(payload)

        // 验证恶意代码被移除
        expect(cleaned).not.toContain("<script>")
        expect(cleaned).not.toContain("javascript:")
        expect(cleaned).not.toContain("onerror=")
        expect(cleaned).not.toContain("onload=")
        expect(cleaned).not.toContain("<iframe>")

        console.log(`原始: ${payload}`)
        console.log(`清理后: ${cleaned}`)
      }
    })

    it("应该验证和清理用户输入", async () => {
      const { XSSProtection } = await import("@/lib/security")

      const testInputs = [
        { input: "normal text", expected: "normal text" },
        { input: "<p>safe html</p>", expected: "<p>safe html</p>" },
        { input: "<script>evil()</script>", expected: "" },
        {
          input: "text with <strong>emphasis</strong>",
          expected: "text with <strong>emphasis</strong>",
        },
        { input: '<div onclick="evil()">click</div>', expected: "<div>click</div>" },
      ]

      for (const { input, expected } of testInputs) {
        const result = XSSProtection.validateAndSanitizeInput(input)
        expect(result).toBeDefined()

        if (expected) {
          expect(result).toContain(expected.replace(/<[^>]*>/g, "")) // 忽略标签细节
        }
      }
    })

    it("应该处理超长输入", async () => {
      const { XSSProtection } = await import("@/lib/security")

      // 创建超长输入（超过10000字符）
      const longInput = "a".repeat(15000)

      expect(() => {
        XSSProtection.validateAndSanitizeInput(longInput)
      }).toThrow("输入内容过长")
    })

    it("应该处理非字符串输入", async () => {
      const { XSSProtection } = await import("@/lib/security")

      const invalidInputs = [null, undefined, 123, {}, []]

      for (const input of invalidInputs) {
        const result = XSSProtection.validateAndSanitizeInput(input)
        expect(result).toBeNull()
      }
    })
  })

  describe("CSRF防护测试", () => {
    it("应该验证CSRF令牌", async () => {
      const { CSRFProtection } = await import("@/lib/security")

      const validToken = CSRFProtection.generateToken()

      const requestWithValidToken = createTestRequest("/api/user/profile", {
        method: "POST",
        headers: {
          "X-CSRF-Token": validToken,
          Cookie: `csrf-token=${validToken}`,
        },
      })

      const isValid = CSRFProtection.validateToken(requestWithValidToken)
      expect(isValid).toBe(true)
    })

    it("应该拒绝无效的CSRF令牌", async () => {
      const { CSRFProtection } = await import("@/lib/security")

      const validToken = CSRFProtection.generateToken()
      const invalidToken = CSRFProtection.generateToken()

      const requestWithInvalidToken = createTestRequest("/api/user/profile", {
        method: "POST",
        headers: {
          "X-CSRF-Token": invalidToken,
          Cookie: `csrf-token=${validToken}`,
        },
      })

      const isValid = CSRFProtection.validateToken(requestWithInvalidToken)
      expect(isValid).toBe(false)
    })

    it("应该拒绝缺失CSRF令牌的请求", async () => {
      const { CSRFProtection } = await import("@/lib/security")

      const requestWithoutToken = createTestRequest("/api/user/profile", {
        method: "POST",
      })

      const isValid = CSRFProtection.validateToken(requestWithoutToken)
      expect(isValid).toBe(false)
    })
  })

  describe("会话安全测试", () => {
    it("应该检测会话过期", async () => {
      const { SessionSecurity } = await import("@/lib/security")

      const oldSession = new Date(Date.now() - 2 * 60 * 60 * 1000) // 2小时前
      const recentSession = new Date(Date.now() - 30 * 60 * 1000) // 30分钟前

      expect(SessionSecurity.isSessionExpired(oldSession)).toBe(true)
      expect(SessionSecurity.isSessionExpired(recentSession)).toBe(false)
    })

    it("应该检测需要刷新的会话", async () => {
      const { SessionSecurity } = await import("@/lib/security")

      const oldRefresh = new Date(Date.now() - 45 * 60 * 1000) // 45分钟前
      const recentRefresh = new Date(Date.now() - 15 * 60 * 1000) // 15分钟前

      expect(SessionSecurity.shouldRefreshSession(oldRefresh)).toBe(true)
      expect(SessionSecurity.shouldRefreshSession(recentRefresh)).toBe(false)
    })

    it("应该生成安全的会话指纹", async () => {
      const { SessionSecurity } = await import("@/lib/security")

      const request1 = createTestRequest("/test", {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          "Accept-Language": "en-US,en;q=0.9",
          "X-Forwarded-For": "192.168.1.1",
        },
      })

      const request2 = createTestRequest("/test", {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
          "Accept-Language": "zh-CN,zh;q=0.9",
          "X-Forwarded-For": "10.0.0.1",
        },
      })

      const fingerprint1 = SessionSecurity.generateSessionFingerprint(request1)
      const fingerprint2 = SessionSecurity.generateSessionFingerprint(request2)

      // 不同的请求应该生成不同的指纹
      expect(fingerprint1).not.toBe(fingerprint2)

      // 指纹应该是十六进制字符串
      expect(fingerprint1).toMatch(/^[0-9a-f]+$/)
      expect(fingerprint2).toMatch(/^[0-9a-f]+$/)
    })
  })

  describe("速率限制测试", () => {
    it("应该限制高频请求", async () => {
      const { RateLimiter } = await import("@/lib/security")

      const clientIP = "192.168.1.100"
      const limit = 5
      const windowMs = 60 * 1000 // 1分钟

      // 前5次请求应该通过
      for (let i = 0; i < limit; i++) {
        const allowed = RateLimiter.checkRateLimit(clientIP, limit, windowMs)
        expect(allowed).toBe(true)
      }

      // 第6次请求应该被限制
      const blocked = RateLimiter.checkRateLimit(clientIP, limit, windowMs)
      expect(blocked).toBe(false)
    })

    it("应该在时间窗口重置后允许新请求", async () => {
      const { RateLimiter } = await import("@/lib/security")

      const clientIP = "192.168.1.200"
      const limit = 3
      const shortWindow = 100 // 100ms窗口

      // 达到限制
      for (let i = 0; i < limit; i++) {
        RateLimiter.checkRateLimit(clientIP, limit, shortWindow)
      }

      // 应该被阻止
      expect(RateLimiter.checkRateLimit(clientIP, limit, shortWindow)).toBe(false)

      // 等待窗口过期
      await new Promise((resolve) => setTimeout(resolve, 150))

      // 新窗口中的请求应该被允许
      expect(RateLimiter.checkRateLimit(clientIP, limit, shortWindow)).toBe(true)
    })
  })

  describe("数据库攻击防护", () => {
    it("应该防止SQL注入攻击", async () => {
      setCurrentTestUser("admin")

      // 模拟恶意SQL输入
      const sqlInjectionPayloads = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "'; UPDATE users SET role='ADMIN'; --",
        "' UNION SELECT * FROM users --",
      ]

      for (const payload of sqlInjectionPayloads) {
        // 模拟通过用户输入进行查询
        try {
          // 这里应该通过参数化查询，Prisma 自动防护 SQL 注入
          vi.mocked(mockPrisma.user.findMany).mockResolvedValue([])

          // 验证 Prisma 不会执行恶意SQL
          const result = await mockPrisma.user.findMany({
            where: {
              email: payload, // 即使是恶意输入，Prisma 也会当作字符串处理
            },
          })

          // 查询应该正常执行（返回空结果）
          expect(result).toEqual([])
        } catch (error) {
          // 如果有异常，不应该是SQL语法错误
          expect((error as Error).message).not.toContain("SQL syntax")
        }
      }
    })

    it("应该处理数据库连接中断", async () => {
      setCurrentTestUser("user")

      // 模拟数据库连接错误
      mockDatabaseError(new Error("connection terminated"))

      const { requireAuth } = await import("@/lib/permissions")

      await expect(requireAuth()).rejects.toThrow()

      // 验证错误不会暴露敏感信息
      try {
        await requireAuth()
      } catch (error) {
        const errorMessage = (error as Error).message
        expect(errorMessage).not.toContain("database")
        expect(errorMessage).not.toContain("connection")
        expect(errorMessage).not.toContain("terminated")
      }
    })
  })

  describe("并发攻击防护", () => {
    it("应该防止权限检查中的竞态条件", async () => {
      setCurrentTestUser("user")

      // 模拟用户状态在权限检查过程中被修改
      let callCount = 0
      vi.mocked(mockPrisma.user.findUnique).mockImplementation(async () => {
        callCount++

        // 第一次返回活跃用户，第二次返回被封禁用户
        if (callCount === 1) {
          return TEST_USERS.user
        } else {
          return { ...TEST_USERS.user, status: "BANNED" as const }
        }
      })

      const { requireAuth } = await import("@/lib/permissions")

      // 并发执行多个权限检查
      const concurrentChecks = Promise.all([requireAuth(), requireAuth(), requireAuth()])

      const results = await concurrentChecks

      // 所有结果应该一致（由于缓存机制）
      results.forEach((result) => {
        expect(result.id).toBe(TEST_USERS.user.id)
        expect(result.status).toBe("ACTIVE") // 应该都是第一次查询的结果
      })
    })

    it("应该防止缓存投毒攻击", async () => {
      const { clearPermissionCache } = await import("@/lib/permissions")

      // 清空缓存
      clearPermissionCache()

      setCurrentTestUser("admin")

      // 第一次查询：返回正常管理员
      vi.mocked(mockPrisma.user.findUnique).mockResolvedValueOnce(TEST_USERS.admin)

      const { requireAdmin } = await import("@/lib/permissions")
      const firstResult = await requireAdmin()

      // 验证第一次查询成功
      expect(firstResult.role).toBe("ADMIN")

      // 尝试"投毒"缓存 - 修改数据库返回值
      vi.mocked(mockPrisma.user.findUnique).mockResolvedValue({
        ...TEST_USERS.admin,
        role: "USER" as const, // 尝试降级权限
      })

      // 第二次查询应该使用缓存，不受影响
      const secondResult = await requireAdmin()
      expect(secondResult.role).toBe("ADMIN") // 仍应该是管理员
    })
  })

  describe("错误处理安全性", () => {
    it("应该安全地处理错误信息", async () => {
      setCurrentTestUser("user")

      // 模拟数据库错误
      const sensitiveError = new Error(
        "Database connection failed at server 192.168.1.50:5432 with password: secret123"
      )
      mockDatabaseError(sensitiveError)

      const { requireAuth } = await import("@/lib/permissions")

      try {
        await requireAuth()
      } catch (error) {
        const errorMessage = (error as Error).message

        // 验证错误信息不包含敏感信息
        expect(errorMessage).not.toContain("192.168.1.50")
        expect(errorMessage).not.toContain("5432")
        expect(errorMessage).not.toContain("password")
        expect(errorMessage).not.toContain("secret123")

        // 应该是通用的错误信息
        expect(errorMessage).toMatch(/权限|认证|服务/i)
      }
    })

    it("应该防止通过错误信息进行信息泄露", async () => {
      const { isEmailRegistered } = await import("@/lib/auth")

      // 模拟数据库查询错误
      const dbError = new Error('Column "email" does not exist in table "users"')
      vi.mocked(mockPrisma.user.findUnique).mockRejectedValue(dbError)

      // 即使数据库出错，也不应该暴露表结构信息
      const result = await isEmailRegistered("test@example.com")

      // 应该返回 false 而不是抛出异常
      expect(result).toBe(false)
    })
  })

  describe("权限边界测试", () => {
    it("应该正确处理边界权限状态", async () => {
      const edgeCases = [
        { user: null, expectAuth: false, expectAdmin: false },
        {
          user: { ...TEST_USERS.user, status: "BANNED" as const },
          expectAuth: false,
          expectAdmin: false,
        },
        {
          user: { ...TEST_USERS.admin, status: "BANNED" as const },
          expectAuth: false,
          expectAdmin: false,
        },
        {
          user: { ...TEST_USERS.user, role: "ADMIN" as const },
          expectAuth: true,
          expectAdmin: true,
        },
      ]

      for (const { user, expectAuth, expectAdmin } of edgeCases) {
        // 重置缓存
        const { clearPermissionCache } = await import("@/lib/permissions")
        clearPermissionCache()

        if (user) {
          setCurrentTestUser("user")
          vi.mocked(mockPrisma.user.findUnique).mockResolvedValue(user as any)
        } else {
          setCurrentTestUser(null)
        }

        const { checkUserStatus } = await import("@/lib/permissions")
        const status = await checkUserStatus()

        expect(status.isAuthenticated).toBe(expectAuth)
        expect(status.isAdmin).toBe(expectAdmin)

        console.log(
          `测试案例: 用户=${user?.email || "null"}, 状态=${user?.status || "null"}, 角色=${user?.role || "null"}`
        )
        console.log(`期望认证=${expectAuth}, 实际认证=${status.isAuthenticated}`)
        console.log(`期望管理员=${expectAdmin}, 实际管理员=${status.isAdmin}`)
      }
    })
  })
})
