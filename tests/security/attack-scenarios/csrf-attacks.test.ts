/**
 * CSRF 攻击场景测试套件
 * 测试跨站请求伪造攻击的各种变体和防护措施
 */

import { describe, test, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { createSecurityContext } from "@/lib/security/middleware"
import { securityConfig } from "@/lib/security/config"

// 模拟恶意网站的攻击场景
const MALICIOUS_ORIGINS = [
  "http://evil.com",
  "https://phishing-site.net",
  "http://192.168.1.100:3000",
  "data:text/html,<script>attack()</script>",
]

describe("CSRF 攻击场景测试", () => {
  let csrfModule: any

  beforeEach(async () => {
    vi.clearAllMocks()
    csrfModule = await import("@/lib/security/csrf-protection")
  })

  describe("跨站请求伪造攻击", () => {
    test("应该阻止无CSRF令牌的状态修改请求", async () => {
      const maliciousRequest = new NextRequest("https://target-site.com/api/admin/posts", {
        method: "POST",
        headers: {
          Origin: "http://evil.com",
          Referer: "http://evil.com/attack.html",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "恶意文章",
          content: "<script>stealData()</script>",
          published: true,
        }),
      })

      const validation = await csrfModule.validateCSRFToken(maliciousRequest)

      expect(validation.isValid).toBe(false)
      expect(validation.errorCode).toBe("CSRF_TOKEN_MISSING")
      expect(validation.riskLevel).toBe("HIGH")
    })

    test("应该检测令牌重用攻击", async () => {
      // 生成合法令牌
      const legitimateToken = csrfModule.generateCSRFToken("session-123")

      // 模拟第一次合法使用
      const firstRequest = new NextRequest("https://target-site.com/api/user/profile", {
        method: "POST",
        headers: {
          "X-CSRF-Token": legitimateToken,
          Cookie: `csrf-token=${legitimateToken}; session=valid-session`,
        },
      })

      const firstValidation = await csrfModule.validateCSRFToken(firstRequest)
      expect(firstValidation.isValid).toBe(true)

      // 模拟攻击者重用令牌
      const replayRequest = new NextRequest("https://target-site.com/api/admin/users", {
        method: "DELETE",
        headers: {
          "X-CSRF-Token": legitimateToken, // 重用令牌
          Origin: "http://evil.com",
          Referer: "http://evil.com/csrf-attack.html",
        },
      })

      const replayValidation = await csrfModule.validateCSRFToken(replayRequest)
      expect(replayValidation.isValid).toBe(false)
      expect(replayValidation.errorCode).toBe("CSRF_TOKEN_REUSE_DETECTED")
    })

    test("应该防止令牌篡改攻击", async () => {
      const originalToken = csrfModule.generateCSRFToken("session-123")

      // 尝试各种令牌篡改方式
      const tamperedTokens = [
        originalToken.substring(0, originalToken.length - 1) + "x", // 修改最后一个字符
        originalToken.split("").reverse().join(""), // 反转令牌
        originalToken + "extra", // 添加额外字符
        originalToken.replace(/[a-f]/g, "0"), // 替换十六进制字符
        Buffer.from(originalToken, "hex").toString("base64"), // 改变编码
      ]

      for (const tamperedToken of tamperedTokens) {
        const maliciousRequest = new NextRequest("https://target-site.com/api/user/posts", {
          method: "POST",
          headers: {
            "X-CSRF-Token": tamperedToken,
            Cookie: `csrf-token=${originalToken}`,
            "Content-Type": "application/json",
          },
        })

        const validation = await csrfModule.validateCSRFToken(maliciousRequest)

        expect(validation.isValid).toBe(false)
        expect(validation.errorCode).toBe("CSRF_TOKEN_INVALID")
        expect(validation.attackPattern).toContain("TOKEN_TAMPERING")
      }
    })

    test("应该检测时序攻击防护", async () => {
      const validToken = csrfModule.generateCSRFToken("session-123")
      const invalidToken = "invalid-token-12345"

      // 测量验证时间
      const measureValidationTime = async (token: string): Promise<number> => {
        const startTime = process.hrtime.bigint()

        const request = new NextRequest("https://target-site.com/api/test", {
          method: "POST",
          headers: {
            "X-CSRF-Token": token,
            Cookie: `csrf-token=${validToken}`,
          },
        })

        await csrfModule.validateCSRFToken(request)

        const endTime = process.hrtime.bigint()
        return Number(endTime - startTime) / 1000000 // 转换为毫秒
      }

      // 多次测量验证时间
      const validTokenTimes: number[] = []
      const invalidTokenTimes: number[] = []

      for (let i = 0; i < 10; i++) {
        validTokenTimes.push(await measureValidationTime(validToken))
        invalidTokenTimes.push(await measureValidationTime(invalidToken))
      }

      // 计算平均时间
      const avgValidTime = validTokenTimes.reduce((a, b) => a + b) / validTokenTimes.length
      const avgInvalidTime = invalidTokenTimes.reduce((a, b) => a + b) / invalidTokenTimes.length

      // 验证时间差不应该泄露令牌有效性信息
      const timeDifference = Math.abs(avgValidTime - avgInvalidTime)
      expect(timeDifference).toBeLessThan(1) // 差异应小于1毫秒
    })
  })

  describe("Origin 和 Referer 验证攻击", () => {
    test("应该阻止恶意Origin头部", async () => {
      for (const maliciousOrigin of MALICIOUS_ORIGINS) {
        const request = new NextRequest("https://target-site.com/api/admin/settings", {
          method: "PUT",
          headers: {
            Origin: maliciousOrigin,
            "X-CSRF-Token": csrfModule.generateCSRFToken("session-123"),
          },
        })

        const validation = await csrfModule.validateOrigin(request)

        expect(validation.isValid).toBe(false)
        expect(validation.errorMessage).toContain("不受信任的来源")
      }
    })

    test("应该检测Origin/Referer不匹配攻击", async () => {
      const request = new NextRequest("https://target-site.com/api/user/delete", {
        method: "DELETE",
        headers: {
          Origin: "https://target-site.com",
          Referer: "http://evil.com/csrf-frame.html", // 不匹配的Referer
          "X-CSRF-Token": csrfModule.generateCSRFToken("session-123"),
        },
      })

      const validation = await csrfModule.validateOriginAndReferer(request)

      expect(validation.isValid).toBe(false)
      expect(validation.errorCode).toBe("ORIGIN_REFERER_MISMATCH")
      expect(validation.suspiciousActivity).toBe(true)
    })

    test("应该处理缺失的Origin/Referer头部", async () => {
      // 某些合法请求可能缺少这些头部
      const legitimateRequest = new NextRequest("https://target-site.com/api/health", {
        method: "GET",
        // 缺少 Origin 和 Referer 头部
      })

      const strictValidation = await csrfModule.validateOrigin(legitimateRequest, { strict: true })
      const relaxedValidation = await csrfModule.validateOrigin(legitimateRequest, {
        strict: false,
      })

      expect(strictValidation.isValid).toBe(false)
      expect(relaxedValidation.isValid).toBe(true) // GET请求通常允许
    })
  })

  describe("Cookie 安全性攻击", () => {
    test("应该检测Cookie注入攻击", async () => {
      const maliciousCookies = [
        "csrf-token=valid-token; admin=true; role=ADMIN", // 尝试注入管理员权限
        "csrf-token=valid-token\r\nSet-Cookie: session=hijacked", // HTTP头注入
        "csrf-token=valid-token; Path=/; Domain=.evil.com", // 跨域Cookie
        'csrf-token=<script>alert("xss")</script>', // XSS尝试
      ]

      for (const maliciousCookie of maliciousCookies) {
        const request = new NextRequest("https://target-site.com/api/user/profile", {
          method: "POST",
          headers: {
            Cookie: maliciousCookie,
            "X-CSRF-Token": "valid-token",
          },
        })

        const validation = await csrfModule.validateCookies(request)

        expect(validation.isValid).toBe(false)
        expect(validation.securityViolations).toContain("MALICIOUS_COOKIE_DETECTED")
      }
    })

    test("应该验证Cookie属性安全性", async () => {
      const securityContext = createSecurityContext(new NextRequest("https://target-site.com/test"))

      const csrfCookie = csrfModule.createCSRFCookie("test-token", securityContext)

      // 验证安全属性
      expect(csrfCookie).toContain("HttpOnly")
      expect(csrfCookie).toContain("Secure")
      expect(csrfCookie).toContain("SameSite=Strict")
      expect(csrfCookie).not.toContain("Domain=") // 不应设置跨域

      // 验证过期时间合理
      const maxAgeMatch = csrfCookie.match(/Max-Age=(\d+)/)
      if (maxAgeMatch) {
        const maxAge = parseInt(maxAgeMatch[1])
        expect(maxAge).toBeLessThanOrEqual(24 * 60 * 60) // 不超过24小时
        expect(maxAge).toBeGreaterThan(60) // 至少1分钟
      }
    })
  })

  describe("双重提交Cookie攻击", () => {
    test("应该验证令牌一致性", async () => {
      const sessionToken = "session-12345"
      const validToken = csrfModule.generateCSRFToken(sessionToken)
      const differentToken = csrfModule.generateCSRFToken("different-session")

      // 攻击场景：头部令牌和Cookie令牌不匹配
      const mismatchRequest = new NextRequest("https://target-site.com/api/user/update", {
        method: "PUT",
        headers: {
          "X-CSRF-Token": validToken,
          Cookie: `csrf-token=${differentToken}; session=${sessionToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: "hacker@evil.com" }),
      })

      const validation = await csrfModule.validateDoubleSubmitCookie(mismatchRequest)

      expect(validation.isValid).toBe(false)
      expect(validation.errorCode).toBe("CSRF_TOKEN_MISMATCH")
      expect(validation.attackPattern).toContain("DOUBLE_SUBMIT_BYPASS_ATTEMPT")
    })

    test("应该处理子域名攻击", async () => {
      const baseToken = csrfModule.generateCSRFToken("session-123")

      // 模拟子域名攻击场景
      const subdomainRequest = new NextRequest("https://app.target-site.com/api/transfer", {
        method: "POST",
        headers: {
          Origin: "https://evil.target-site.com", // 恶意子域名
          "X-CSRF-Token": baseToken,
          Cookie: `csrf-token=${baseToken}`,
          Referer: "https://evil.target-site.com/transfer.html",
        },
      })

      const validation = await csrfModule.validateSubdomainSecurity(subdomainRequest)

      expect(validation.isValid).toBe(false)
      expect(validation.errorCode).toBe("UNTRUSTED_SUBDOMAIN")
    })
  })

  describe("状态修改操作保护", () => {
    test("应该区分安全和危险的HTTP方法", async () => {
      const safeMethodsTests = [
        { method: "GET", shouldRequireCSRF: false },
        { method: "HEAD", shouldRequireCSRF: false },
        { method: "OPTIONS", shouldRequireCSRF: false },
      ]

      const dangerousMethodsTests = [
        { method: "POST", shouldRequireCSRF: true },
        { method: "PUT", shouldRequireCSRF: true },
        { method: "DELETE", shouldRequireCSRF: true },
        { method: "PATCH", shouldRequireCSRF: true },
      ]

      for (const { method, shouldRequireCSRF } of [...safeMethodsTests, ...dangerousMethodsTests]) {
        const request = new NextRequest("https://target-site.com/api/test", {
          method,
          headers: shouldRequireCSRF ? {} : { "X-CSRF-Token": "not-needed" },
        })

        const requiresProtection = csrfModule.requiresCSRFProtection(request)
        expect(requiresProtection).toBe(shouldRequireCSRF)
      }
    })

    test("应该基于路径配置保护级别", async () => {
      const pathTests = [
        { path: "/api/public/health", requiresCSRF: false },
        { path: "/api/auth/login", requiresCSRF: false },
        { path: "/api/user/profile", requiresCSRF: true },
        { path: "/api/admin/users", requiresCSRF: true },
        { path: "/api/admin/system", requiresCSRF: true },
      ]

      for (const { path, requiresCSRF } of pathTests) {
        const request = new NextRequest(`https://target-site.com${path}`, {
          method: "POST",
        })

        const config = csrfModule.getPathCSRFConfig(path)
        expect(config.required).toBe(requiresCSRF)
      }
    })
  })

  describe("攻击检测和响应", () => {
    test("应该记录和分析攻击模式", async () => {
      const attackLogger = vi.fn()
      vi.mocked(csrfModule.logSecurityEvent).mockImplementation(attackLogger)

      // 模拟连续的CSRF攻击
      const attackRequests = Array.from(
        { length: 5 },
        (_, i) =>
          new NextRequest("https://target-site.com/api/user/delete", {
            method: "DELETE",
            headers: {
              Origin: `http://evil${i}.com`,
              "X-Forwarded-For": "192.168.1.100",
              "User-Agent": "AttackBot/1.0",
            },
          })
      )

      for (const request of attackRequests) {
        await csrfModule.validateCSRFToken(request)
      }

      // 验证攻击记录
      expect(attackLogger).toHaveBeenCalledTimes(5)
      expect(attackLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "CSRF_ATTACK_ATTEMPT",
          severity: "HIGH",
          clientIP: "192.168.1.100",
          userAgent: "AttackBot/1.0",
        })
      )

      // 验证攻击模式识别
      const patterns = csrfModule.analyzeAttackPatterns()
      expect(patterns.suspiciousIPs).toContain("192.168.1.100")
      expect(patterns.attackFrequency).toBeGreaterThan(0)
    })

    test("应该实施自动防护响应", async () => {
      const clientIP = "192.168.1.200"

      // 模拟高频攻击
      for (let i = 0; i < 10; i++) {
        const request = new NextRequest("https://target-site.com/api/admin/delete", {
          method: "DELETE",
          headers: {
            "X-Forwarded-For": clientIP,
            Origin: "http://evil.com",
          },
        })

        await csrfModule.validateCSRFToken(request)
      }

      // 验证IP是否被临时阻止
      const isBlocked = await csrfModule.isIPTemporarilyBlocked(clientIP)
      expect(isBlocked).toBe(true)

      // 验证阻止时间合理
      const blockInfo = await csrfModule.getIPBlockInfo(clientIP)
      expect(blockInfo.duration).toBeLessThanOrEqual(60 * 60 * 1000) // 最多1小时
      expect(blockInfo.reason).toContain("CSRF_ATTACK_PATTERN")
    })
  })

  describe("配置和绕过测试", () => {
    test("应该正确处理配置异常", async () => {
      // 备份原始配置
      const originalConfig = { ...securityConfig.csrf }

      try {
        // 测试无效配置
        securityConfig.csrf.tokenLength = 0 // 无效长度

        expect(() => {
          csrfModule.generateCSRFToken("test-session")
        }).toThrow("CSRF配置无效")

        // 测试缺少必需配置
        delete (securityConfig.csrf as any).cookieName

        expect(() => {
          csrfModule.createCSRFCookie("token", {})
        }).toThrow("CSRF配置不完整")
      } finally {
        // 恢复原始配置
        Object.assign(securityConfig.csrf, originalConfig)
      }
    })

    test("应该防止配置绕过攻击", async () => {
      // 尝试通过环境变量绕过安全检查
      const originalNodeEnv = process.env.NODE_ENV

      try {
        process.env.NODE_ENV = "production"

        const request = new NextRequest("https://target-site.com/api/admin/config", {
          method: "PUT",
          headers: {
            "X-Debug-Mode": "true", // 尝试启用调试模式
            "X-Skip-CSRF": "true", // 尝试跳过检查
            "X-Override-Security": "disabled", // 尝试禁用安全检查
          },
        })

        const validation = await csrfModule.validateCSRFToken(request)

        // 即使在攻击者尝试绕过的情况下，验证仍应失败
        expect(validation.isValid).toBe(false)
        expect(validation.bypassAttempted).toBe(true)
      } finally {
        process.env.NODE_ENV = originalNodeEnv
      }
    })
  })
})
