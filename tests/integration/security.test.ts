/**
 * Phase 4.1 安全性增强测试套件
 * 测试 CSRF 保护、XSS 防护和会话安全管理
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { NextRequest, NextResponse } from "next/server"
import {
  CSRFProtection,
  XSSProtection,
  SessionSecurity,
  RateLimiter,
  validateRequestOrigin,
} from "@/lib/security"
import { GET as csrfTokenHandler } from "@/app/api/csrf-token/route"

describe("Phase 4.1 安全性增强测试", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("CSRF 保护测试", () => {
    it("应该生成有效的 CSRF 令牌", () => {
      const token = CSRFProtection.generateToken()
      expect(token).toBeDefined()
      expect(typeof token).toBe("string")
      expect(token.length).toBeGreaterThan(0)
    })

    it("应该验证匹配的 CSRF 令牌", () => {
      const token = "test-csrf-token-123"

      const request = new NextRequest("http://localhost:3000/api/test", {
        method: "POST",
        headers: {
          "X-CSRF-Token": token,
        },
        cookies: new Map([["csrf-token", token]]),
      } as any)

      // 模拟 cookies.get 方法
      vi.spyOn(request.cookies, "get").mockReturnValue({ value: token } as any)

      const isValid = CSRFProtection.validateToken(request)
      expect(isValid).toBe(true)
    })

    it("应该拒绝不匹配的 CSRF 令牌", () => {
      const request = new NextRequest("http://localhost:3000/api/test", {
        method: "POST",
        headers: {
          "X-CSRF-Token": "token1",
        },
      })

      vi.spyOn(request.cookies, "get").mockReturnValue({ value: "token2" } as any)

      const isValid = CSRFProtection.validateToken(request)
      expect(isValid).toBe(false)
    })

    it("应该拒绝缺失的 CSRF 令牌", () => {
      const request = new NextRequest("http://localhost:3000/api/test", {
        method: "POST",
      })

      vi.spyOn(request.cookies, "get").mockReturnValue(undefined)

      const isValid = CSRFProtection.validateToken(request)
      expect(isValid).toBe(false)
    })

    it("GET /api/csrf-token 应该返回与 Cookie 匹配的令牌", async () => {
      const request = new NextRequest("http://localhost:3000/api/csrf-token")
      const response = await csrfTokenHandler(request)
      const body = await response.json()

      const csrfCookie = response.cookies.get("csrf-token")
      expect(csrfCookie?.value).toBeDefined()
      expect(body.token).toBe(csrfCookie?.value)

      const protectedRequest = new NextRequest("http://localhost:3000/api/tags", {
        method: "POST",
        headers: { "X-CSRF-Token": body.token },
      })

      vi.spyOn(protectedRequest.cookies, "get").mockReturnValue({ value: body.token } as any)

      expect(CSRFProtection.validateToken(protectedRequest)).toBe(true)
    })
  })

  describe("XSS 防护测试", () => {
    it("应该清理恶意 script 标签", () => {
      const maliciousInput = '<script>alert("XSS")</script>正常文本'
      const sanitized = XSSProtection.sanitizeHTML(maliciousInput)

      expect(sanitized).not.toContain("<script>")
      expect(sanitized).not.toContain('alert("XSS")')
      expect(sanitized).toContain("正常文本")
    })

    it("应该保留安全的 HTML 标签", () => {
      const safeInput = "<p>这是<strong>安全的</strong>文本</p>"
      const sanitized = XSSProtection.sanitizeHTML(safeInput)

      expect(sanitized).toContain("<p>")
      expect(sanitized).toContain("<strong>")
      expect(sanitized).toContain("安全的")
    })

    it("应该移除危险属性", () => {
      const dangerousInput = '<div onclick="alert(1)" onload="bad()">文本</div>'
      const sanitized = XSSProtection.sanitizeHTML(dangerousInput)

      expect(sanitized).not.toContain("onclick")
      expect(sanitized).not.toContain("onload")
      expect(sanitized).toContain("文本")
    })

    it("应该转义 HTML 实体", () => {
      const input = '<script>alert("test")</script>'
      const escaped = XSSProtection.escapeHTML(input)

      expect(escaped).toBe("&lt;script&gt;alert(&quot;test&quot;)&lt;/script&gt;")
    })

    it("应该验证并清理用户输入", () => {
      const maliciousInput = '<script>alert("XSS")</script>正常文本'
      const result = XSSProtection.validateAndSanitizeInput(maliciousInput)

      expect(result).not.toBeNull()
      expect(result).not.toContain("<script>")
      expect(result).toContain("正常文本")
    })

    it("应该拒绝过长的输入", () => {
      const longInput = "a".repeat(10001)

      expect(() => {
        XSSProtection.validateAndSanitizeInput(longInput)
      }).toThrow("输入内容过长")
    })

    it("应该拒绝非字符串输入", () => {
      const result = XSSProtection.validateAndSanitizeInput(null)
      expect(result).toBeNull()
    })
  })

  describe("会话安全管理测试", () => {
    it("应该检测过期会话", () => {
      const oldDate = new Date(Date.now() - 2 * 60 * 60 * 1000) // 2小时前
      const isExpired = SessionSecurity.isSessionExpired(oldDate)
      expect(isExpired).toBe(true)
    })

    it("应该验证有效会话", () => {
      const recentDate = new Date(Date.now() - 30 * 60 * 1000) // 30分钟前
      const isExpired = SessionSecurity.isSessionExpired(recentDate)
      expect(isExpired).toBe(false)
    })

    it("应该检测需要刷新的会话", () => {
      const oldRefresh = new Date(Date.now() - 35 * 60 * 1000) // 35分钟前
      const shouldRefresh = SessionSecurity.shouldRefreshSession(oldRefresh)
      expect(shouldRefresh).toBe(true)
    })

    it("应该生成会话指纹", () => {
      const request = new NextRequest("http://localhost:3000/", {
        headers: {
          "user-agent": "test-agent",
          "accept-language": "zh-CN",
          "accept-encoding": "gzip",
        },
      })

      const fingerprint = SessionSecurity.generateSessionFingerprint(request)
      expect(fingerprint).toBeDefined()
      expect(typeof fingerprint).toBe("string")
      expect(fingerprint.length).toBeGreaterThan(0)
    })

    it("应该验证相同的会话指纹", () => {
      const request = new NextRequest("http://localhost:3000/", {
        headers: {
          "user-agent": "test-agent",
          "accept-language": "zh-CN",
        },
      })

      const fingerprint1 = SessionSecurity.generateSessionFingerprint(request)
      const fingerprint2 = SessionSecurity.generateSessionFingerprint(request)

      expect(fingerprint1).toBe(fingerprint2)

      const isValid = SessionSecurity.validateSessionFingerprint(request, fingerprint1)
      expect(isValid).toBe(true)
    })

    it("应该生成安全令牌", () => {
      const token = SessionSecurity.generateSecureToken(32)
      expect(token).toBeDefined()
      expect(token.length).toBe(32)

      const token2 = SessionSecurity.generateSecureToken(32)
      expect(token).not.toBe(token2) // 应该生成不同的令牌
    })
  })

  describe("速率限制测试", () => {
    const prevNodeEnv = process.env.NODE_ENV
    const prevDisableRateLimit = process.env.DISABLE_RATE_LIMIT

    beforeEach(() => {
      process.env.NODE_ENV = "production"
      delete process.env.DISABLE_RATE_LIMIT
    })

    afterEach(() => {
      process.env.NODE_ENV = prevNodeEnv
      if (prevDisableRateLimit === undefined) {
        delete process.env.DISABLE_RATE_LIMIT
      } else {
        process.env.DISABLE_RATE_LIMIT = prevDisableRateLimit
      }
    })

    it("应该允许正常频率的请求", () => {
      const identifier = "test-ip-1"
      const result = RateLimiter.checkRateLimit(identifier, 10, 60000)
      expect(result).toBe(true)
    })

    it("应该限制超频请求", () => {
      const identifier = "test-ip-2"

      // 模拟快速连续请求
      for (let i = 0; i < 5; i++) {
        RateLimiter.checkRateLimit(identifier, 5, 60000)
      }

      // 第6个请求应该被限制
      const result = RateLimiter.checkRateLimit(identifier, 5, 60000)
      expect(result).toBe(false)
    })

    it("应该在时间窗口后重置计数", () => {
      const identifier = "test-ip-3"

      // 模拟请求达到限制
      for (let i = 0; i < 3; i++) {
        RateLimiter.checkRateLimit(identifier, 3, 100) // 100ms 窗口
      }

      // 等待时间窗口过期
      return new Promise((resolve) => {
        setTimeout(() => {
          const result = RateLimiter.checkRateLimit(identifier, 3, 100)
          expect(result).toBe(true)
          resolve(undefined)
        }, 150)
      })
    })
  })

  describe("请求来源验证测试", () => {
    it("应该在缺少 NEXT_PUBLIC_SITE_URL 时仍允许同源请求", () => {
      const prevSiteUrl = process.env.NEXT_PUBLIC_SITE_URL
      delete process.env.NEXT_PUBLIC_SITE_URL

      try {
        const request = new NextRequest("http://localhost:3000/api/test", {
          headers: {
            origin: "http://localhost:3000",
          },
        })

        const isValid = validateRequestOrigin(request)
        expect(isValid).toBe(true)
      } finally {
        if (prevSiteUrl === undefined) {
          delete process.env.NEXT_PUBLIC_SITE_URL
        } else {
          process.env.NEXT_PUBLIC_SITE_URL = prevSiteUrl
        }
      }
    })

    it("应该允许与请求 URL 同源的 origin，即使 NEXT_PUBLIC_SITE_URL 配置不同", () => {
      const prevSiteUrl = process.env.NEXT_PUBLIC_SITE_URL
      process.env.NEXT_PUBLIC_SITE_URL = "https://example.com"

      try {
        const request = new NextRequest("https://www.example.com/api/test", {
          headers: {
            origin: "https://www.example.com",
          },
        })

        const isValid = validateRequestOrigin(request)
        expect(isValid).toBe(true)
      } finally {
        if (prevSiteUrl === undefined) {
          delete process.env.NEXT_PUBLIC_SITE_URL
        } else {
          process.env.NEXT_PUBLIC_SITE_URL = prevSiteUrl
        }
      }
    })

    it("应该验证有效的请求来源", () => {
      const request = new NextRequest("http://localhost:3000/api/test", {
        headers: {
          origin: "http://localhost:3000",
        },
      })

      const isValid = validateRequestOrigin(request)
      expect(isValid).toBe(true)
    })

    it("应该拒绝无效的请求来源", () => {
      const request = new NextRequest("http://localhost:3000/api/test", {
        headers: {
          origin: "http://malicious-site.com",
        },
      })

      const isValid = validateRequestOrigin(request)
      expect(isValid).toBe(false)
    })

    it("应该验证有效的 referer", () => {
      const request = new NextRequest("http://localhost:3000/api/test", {
        headers: {
          referer: "http://localhost:3000/page",
        },
      })

      const isValid = validateRequestOrigin(request)
      expect(isValid).toBe(true)
    })

    it("应该拒绝无效的 referer", () => {
      const request = new NextRequest("http://localhost:3000/api/test", {
        headers: {
          referer: "http://malicious-site.com/page",
        },
      })

      const isValid = validateRequestOrigin(request)
      expect(isValid).toBe(false)
    })
  })
})
