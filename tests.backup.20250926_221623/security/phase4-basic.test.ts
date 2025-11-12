/**
 * Phase 4 安全增强基础功能测试
 * 测试单个安全模块的基础功能
 */

import { describe, test, expect } from "vitest"
import { NextRequest } from "next/server"

describe("Phase 4 安全基础功能", () => {
  describe("JWT安全类", () => {
    test("应该能导入JWTSecurity类", async () => {
      const { JWTSecurity } = await import("@/lib/security/jwt-security")
      expect(JWTSecurity).toBeDefined()
      expect(typeof JWTSecurity.generateAccessToken).toBe("function")
    })

    test("应该能生成JWT令牌", async () => {
      const { JWTSecurity } = await import("@/lib/security/jwt-security")

      const token = JWTSecurity.generateAccessToken(
        "test-user",
        "test@example.com",
        "USER",
        "test-session"
      )

      expect(token).toBeDefined()
      expect(typeof token).toBe("string")
      expect(token.split(".")).toHaveLength(3) // JWT格式
    })

    test("应该能验证JWT令牌", async () => {
      const { JWTSecurity } = await import("@/lib/security/jwt-security")

      const token = JWTSecurity.generateAccessToken(
        "test-user",
        "test@example.com",
        "USER",
        "test-session"
      )

      const validation = JWTSecurity.validateAccessToken(token)
      expect(validation.isValid).toBe(true)
      expect(validation.data?.sub).toBe("test-user")
    })
  })

  describe("XSS清理器", () => {
    test("应该能导入AdvancedXSSCleaner类", async () => {
      const { AdvancedXSSCleaner } = await import("@/lib/security/xss-cleaner")
      expect(AdvancedXSSCleaner).toBeDefined()
      expect(typeof AdvancedXSSCleaner.deepSanitizeHTML).toBe("function")
    })

    test("应该能清理危险脚本", async () => {
      const { AdvancedXSSCleaner } = await import("@/lib/security/xss-cleaner")

      const dangerous = '<script>alert("XSS")</script><p>安全内容</p>'
      const cleaned = AdvancedXSSCleaner.deepSanitizeHTML(dangerous)

      expect(cleaned).not.toContain("<script>")
      expect(cleaned).not.toContain("alert")
      expect(cleaned).toContain("安全内容")
    })
  })

  describe("输入清理器", () => {
    test("应该能导入InputSanitizer类", async () => {
      const { InputSanitizer } = await import("@/lib/security/xss-cleaner")
      expect(InputSanitizer).toBeDefined()
      expect(typeof InputSanitizer.sanitizeUserInput).toBe("function")
    })

    test("应该能清理文本输入", async () => {
      const { InputSanitizer } = await import("@/lib/security/xss-cleaner")

      const dirty = "  测试文本\x00\x1F  "
      const clean = InputSanitizer.sanitizeUserInput(dirty, "text")

      expect(clean).toBe("测试文本")
    })

    test("应该能验证邮箱", async () => {
      const { InputSanitizer } = await import("@/lib/security/xss-cleaner")

      const validEmail = "  Test@Example.COM  "
      const invalidEmail = "not-an-email"

      const clean1 = InputSanitizer.sanitizeUserInput(validEmail, "email")
      const clean2 = InputSanitizer.sanitizeUserInput(invalidEmail, "email")

      expect(clean1).toBe("test@example.com")
      expect(clean2).toBeNull()
    })
  })

  describe("会话存储", () => {
    test("应该能导入SessionStore类", async () => {
      const { SessionStore } = await import("@/lib/security/jwt-security")
      expect(SessionStore).toBeDefined()
      expect(typeof SessionStore.createSession).toBe("function")
    })

    test("应该能创建会话", async () => {
      const { SessionStore } = await import("@/lib/security/jwt-security")

      const session = await SessionStore.createSession("test-user", "test-fingerprint")

      expect(session).toBeDefined()
      expect(session.userId).toBe("test-user")
      expect(session.fingerprint).toBe("test-fingerprint")
      expect(session.isActive).toBe(true)
    })
  })

  describe("安全上下文", () => {
    test("应该能创建安全上下文", async () => {
      const { createSecurityContext } = await import("@/lib/security/middleware")

      const mockRequest = new NextRequest("https://example.com/test", {
        headers: {
          "user-agent": "test-agent",
          "x-forwarded-for": "192.168.1.1",
        },
      })

      const context = createSecurityContext(mockRequest)

      expect(context).toBeDefined()
      expect(context.requestId).toBeDefined()
      expect(context.clientIP).toBe("192.168.1.1")
      expect(context.userAgent).toBe("test-agent")
    })
  })

  describe("配置管理", () => {
    test("应该能加载安全配置", async () => {
      const { securityConfig } = await import("@/lib/security/config")

      expect(securityConfig).toBeDefined()
      expect(securityConfig.csrf).toBeDefined()
      expect(securityConfig.xss).toBeDefined()
      expect(securityConfig.jwt).toBeDefined()
      expect(securityConfig.rateLimit).toBeDefined()
    })

    test("配置应该有合理的默认值", async () => {
      const { securityConfig } = await import("@/lib/security/config")

      expect(securityConfig.csrf.tokenLength).toBeGreaterThanOrEqual(16)
      expect(securityConfig.jwt.accessTokenExpiresIn).toBeGreaterThan(0)
      expect(securityConfig.xss.maxInputLength).toBeGreaterThan(1000)
      expect(securityConfig.rateLimit.maxRequests).toBeGreaterThan(0)
    })
  })
})
