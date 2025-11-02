/**
 * Phase 4 安全增强功能测试
 * 测试新实现的安全功能：JWT管理、XSS清理、安全中间件等
 */

import { describe, test, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"
import {
  JWTSecurity,
  TokenRefreshManager,
  SessionStore,
  AdvancedXSSCleaner,
  ContentValidator,
  InputSanitizer,
  SecurityMiddleware,
  createSecurityContext,
  securityConfig,
} from "@/lib/security/index"

describe("Phase 4 安全增强功能", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("JWT 安全管理", () => {
    test("应该能生成和验证访问令牌", () => {
      const token = JWTSecurity.generateAccessToken(
        "user123",
        "test@example.com",
        "USER",
        "session123"
      )

      expect(token).toBeDefined()
      expect(typeof token).toBe("string")
      expect(token.split(".")).toHaveLength(3) // JWT格式验证

      const validation = JWTSecurity.validateAccessToken(token)
      expect(validation.isValid).toBe(true)
      expect(validation.data?.sub).toBe("user123")
      expect(validation.data?.email).toBe("test@example.com")
      expect(validation.data?.role).toBe("USER")
    })

    test("应该能生成和验证刷新令牌", () => {
      const token = JWTSecurity.generateRefreshToken("user123", "session123")

      expect(token).toBeDefined()

      const validation = JWTSecurity.validateRefreshToken(token)
      expect(validation.isValid).toBe(true)
      expect(validation.data?.sub).toBe("user123")
      expect(validation.data?.type).toBe("refresh")
    })

    test("应该拒绝无效的令牌", () => {
      const invalidToken = "invalid.token.here"

      const validation = JWTSecurity.validateAccessToken(invalidToken)
      expect(validation.isValid).toBe(false)
      expect(validation.errorCode).toBe("INVALID_TOKEN")
    })

    test("应该拒绝错误类型的令牌", () => {
      const refreshToken = JWTSecurity.generateRefreshToken("user123", "session123")

      // 尝试将刷新令牌当作访问令牌验证
      const validation = JWTSecurity.validateAccessToken(refreshToken)
      expect(validation.isValid).toBe(false)
      expect(validation.errorCode).toBe("WRONG_TOKEN_TYPE")
    })
  })

  describe("会话存储管理", () => {
    test("应该能创建和获取会话", async () => {
      const session = await SessionStore.createSession("user123", "fingerprint123", {
        userAgent: "test-agent",
      })

      expect(session).toBeDefined()
      expect(session.userId).toBe("user123")
      expect(session.fingerprint).toBe("fingerprint123")
      expect(session.isActive).toBe(true)

      const retrieved = await SessionStore.getSession(session.id)
      expect(retrieved).toEqual(session)
    })

    test("应该能验证会话指纹", async () => {
      const session = await SessionStore.createSession("user123", "fingerprint123")

      const validValidation = await SessionStore.validateSession(session.id, "fingerprint123")
      expect(validValidation.isValid).toBe(true)

      const invalidValidation = await SessionStore.validateSession(session.id, "wrong-fingerprint")
      expect(invalidValidation.isValid).toBe(false)
      expect(invalidValidation.errorCode).toBe("SESSION_HIJACK_DETECTED")
    })

    test("应该能使会话失效", async () => {
      const session = await SessionStore.createSession("user123", "fingerprint123")

      await SessionStore.invalidateSession(session.id)

      const retrieved = await SessionStore.getSession(session.id)
      expect(retrieved?.isActive).toBe(false)
    })
  })

  describe("高级 XSS 清理", () => {
    test("应该清理危险的脚本标签", () => {
      const dangerousInput = '<p>安全内容</p><script>alert("XSS")</script>'
      const cleaned = AdvancedXSSCleaner.deepSanitizeHTML(dangerousInput)

      expect(cleaned).toContain("安全内容")
      expect(cleaned).not.toContain("<script>")
      expect(cleaned).not.toContain("alert")
    })

    test("应该清理事件处理器", () => {
      const dangerousInput = "<p onclick=\"alert('XSS')\">点击我</p>"
      const cleaned = AdvancedXSSCleaner.deepSanitizeHTML(dangerousInput)

      expect(cleaned).toContain("点击我")
      expect(cleaned).not.toContain("onclick")
      expect(cleaned).not.toContain("alert")
    })

    test("应该清理危险的协议", () => {
      const dangerousInput = "<a href=\"javascript:alert('XSS')\">链接</a>"
      const cleaned = AdvancedXSSCleaner.deepSanitizeHTML(dangerousInput)

      expect(cleaned).toContain("链接")
      expect(cleaned).not.toContain("javascript:")
      expect(cleaned).toContain("blocked:")
    })

    test("应该处理自定义过滤器", () => {
      const input = "<p>测试内容</p>"
      const cleaned = AdvancedXSSCleaner.deepSanitizeHTML(input, {
        allowHtml: true,
        removeScripts: true,
        removeStyles: true,
        removeLinks: false,
        customFilters: [(text) => text.replace("测试", "已过滤")],
      })

      expect(cleaned).toContain("已过滤内容")
      expect(cleaned).not.toContain("测试")
    })
  })

  describe("内容验证器", () => {
    test("应该检测脚本注入", () => {
      const maliciousContent = '<script>alert("XSS")</script>'
      const validation = ContentValidator.validateContent(maliciousContent)

      expect(validation.isValid).toBe(false)
      expect(validation.data?.violations).toBeDefined()
      expect(validation.data.violations[0].severity).toBe("critical")
    })

    test("应该检测事件处理器注入", () => {
      const maliciousContent = '<div onload="stealData()">内容</div>'
      const validation = ContentValidator.validateContent(maliciousContent)

      expect(validation.isValid).toBe(false)
      expect(validation.data?.violations?.some((v) => v.rule === "event_handler_injection")).toBe(
        true
      )
    })

    test("应该通过安全内容", () => {
      const safeContent = "<p>这是安全的内容</p><strong>重要文本</strong>"
      const validation = ContentValidator.validateContent(safeContent)

      expect(validation.isValid).toBe(true)
    })
  })

  describe("输入清理器", () => {
    test("应该清理文本输入", () => {
      const dirtyText = "  \x00测试文本\x1F  \t\n  "
      const cleaned = InputSanitizer.sanitizeUserInput(dirtyText, "text")

      expect(cleaned).toBe("测试文本")
      expect(cleaned).not.toContain("\x00")
      expect(cleaned).not.toContain("\x1F")
    })

    test("应该验证邮箱格式", () => {
      const validEmail = "  TEST@EXAMPLE.COM  "
      const invalidEmail = "invalid-email"

      const cleaned1 = InputSanitizer.sanitizeUserInput(validEmail, "email")
      const cleaned2 = InputSanitizer.sanitizeUserInput(invalidEmail, "email")

      expect(cleaned1).toBe("test@example.com")
      expect(cleaned2).toBeNull()
    })

    test("应该验证URL格式", () => {
      const validUrl = "https://example.com/path"
      const invalidUrl = 'javascript:alert("xss")'

      const cleaned1 = InputSanitizer.sanitizeUserInput(validUrl, "url")
      const cleaned2 = InputSanitizer.sanitizeUserInput(invalidUrl, "url")

      expect(cleaned1).toBe(validUrl)
      expect(cleaned2).toBeNull()
    })

    test("应该清理对象中的所有字符串", () => {
      const dirtyObject = {
        name: "  测试用户  ",
        email: "  TEST@EXAMPLE.COM  ",
        bio: '<script>alert("xss")</script>个人简介',
        age: 25,
      }

      const cleaned = InputSanitizer.sanitizeObject(dirtyObject, {
        name: "text",
        email: "email",
        bio: "html",
      })

      expect(cleaned.name).toBe("测试用户")
      expect(cleaned.email).toBe("test@example.com")
      expect(cleaned.bio).not.toContain("<script>")
      expect(cleaned.age).toBe(25)
    })
  })

  describe("安全上下文", () => {
    test("应该创建安全上下文", () => {
      const mockRequest = new NextRequest("https://example.com/api/test", {
        method: "POST",
        headers: {
          "user-agent": "test-agent",
          "x-forwarded-for": "192.168.1.1",
          "x-csrf-token": "test-token",
        },
      })

      const context = createSecurityContext(mockRequest)

      expect(context.requestId).toBeDefined()
      expect(context.clientIP).toBe("192.168.1.1")
      expect(context.userAgent).toBe("test-agent")
      expect(context.csrfToken).toBe("test-token")
      expect(context.sessionFingerprint).toBeDefined()
      expect(context.timestamp).toBeGreaterThan(0)
    })
  })

  describe("安全配置", () => {
    test("应该有有效的默认配置", () => {
      expect(securityConfig).toBeDefined()
      expect(securityConfig.csrf).toBeDefined()
      expect(securityConfig.xss).toBeDefined()
      expect(securityConfig.jwt).toBeDefined()
      expect(securityConfig.rateLimit).toBeDefined()
      expect(securityConfig.session).toBeDefined()
    })

    test("CSRF配置应该合理", () => {
      expect(securityConfig.csrf.tokenLength).toBeGreaterThanOrEqual(16)
      expect(securityConfig.csrf.cookieOptions.httpOnly).toBe(true)
      expect(securityConfig.csrf.cookieOptions.sameSite).toBe("strict")
    })

    test("JWT配置应该安全", () => {
      expect(securityConfig.jwt.accessTokenExpiresIn).toBeGreaterThan(0)
      expect(securityConfig.jwt.refreshTokenExpiresIn).toBeGreaterThan(
        securityConfig.jwt.accessTokenExpiresIn
      )
      expect(securityConfig.jwt.algorithm).toBe("HS256")
    })

    test("XSS配置应该严格", () => {
      expect(securityConfig.xss.forbiddenTags).toContain("script")
      expect(securityConfig.xss.forbiddenAttributes).toContain("onclick")
      expect(securityConfig.xss.maxInputLength).toBeGreaterThan(0)
    })
  })

  describe("令牌刷新管理", () => {
    test("应该判断令牌是否需要刷新", () => {
      // 创建一个即将过期的令牌
      const token = JWTSecurity.generateAccessToken(
        "user123",
        "test@example.com",
        "USER",
        "session123"
      )

      // 新创建的令牌不应该需要刷新
      const shouldRefresh = TokenRefreshManager.shouldRefreshToken(token)
      expect(shouldRefresh).toBe(false)
    })

    test("应该拒绝无效的刷新令牌", async () => {
      const invalidToken = "invalid-refresh-token"

      const result = await TokenRefreshManager.refreshAccessToken(invalidToken, SessionStore)

      expect(result).toBeNull()
    })
  })
})
