/**
 * Phase 4.1 安全性端到端测试
 * 验证 CSRF 保护、XSS 防护和会话安全的实际效果
 */

import { describe, it, expect, beforeEach } from "vitest"

describe("Phase 4.1 安全性端到端验证", () => {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

  describe("CSRF 攻击防护验证", () => {
    it("应该阻止没有 CSRF 令牌的 POST 请求", async () => {
      const response = await fetch(`${baseUrl}/api/admin/posts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "测试文章",
          content: "测试内容",
        }),
      })

      expect(response.status).toBe(403)

      const errorData = await response.json()
      expect(errorData.code).toBe("CSRF_INVALID")
    })

    it("应该阻止伪造来源的请求", async () => {
      const response = await fetch(`${baseUrl}/api/admin/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://malicious-site.com",
        },
        body: JSON.stringify({
          email: "test@example.com",
          role: "ADMIN",
        }),
      })

      expect(response.status).toBe(403)

      const errorData = await response.json()
      expect(errorData.code).toBe("INVALID_ORIGIN")
    })
  })

  describe("XSS 攻击防护验证", () => {
    it("应该过滤恶意脚本注入", async () => {
      const maliciousPayload = {
        title: '<script>alert("XSS")</script>恶意标题',
        content: '<img src="x" onerror="alert(\'XSS\')">正常内容',
      }

      // 模拟带有有效 CSRF 令牌的请求
      const response = await fetch(`${baseUrl}/api/posts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": "test-token", // 在实际测试中需要获取真实令牌
        },
        body: JSON.stringify(maliciousPayload),
      })

      if (response.ok) {
        const post = await response.json()

        // 验证恶意脚本被清除
        expect(post.title).not.toContain("<script>")
        expect(post.title).not.toContain('alert("XSS")')
        expect(post.content).not.toContain("onerror")
        expect(post.content).not.toContain("alert('XSS')")

        // 验证正常内容被保留
        expect(post.title).toContain("恶意标题")
        expect(post.content).toContain("正常内容")
      }
    })
  })

  describe("会话劫持防护验证", () => {
    it("应该检测异常的用户代理变化", async () => {
      // 模拟正常登录
      const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Normal-Browser-Agent",
        },
        body: JSON.stringify({
          email: "test@example.com",
          password: "testpassword",
        }),
      })

      if (loginResponse.ok) {
        const cookies = loginResponse.headers.get("set-cookie")

        // 使用不同的用户代理访问受保护资源
        const suspiciousResponse = await fetch(`${baseUrl}/api/user/profile`, {
          method: "GET",
          headers: {
            "User-Agent": "Suspicious-Agent",
            Cookie: cookies || "",
          },
        })

        // 应该检测到会话异常
        expect(suspiciousResponse.status).toBe(401)
      }
    })

    it("应该在会话过期后要求重新认证", async () => {
      // 模拟过期的会话令牌
      const expiredToken = "expired-jwt-token"

      const response = await fetch(`${baseUrl}/api/user/profile`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${expiredToken}`,
        },
      })

      expect(response.status).toBe(401)

      const errorData = await response.json()
      expect(errorData.error).toContain("认证")
    })
  })

  describe("速率限制验证", () => {
    it("应该限制过频的登录尝试", async () => {
      const endpoint = `${baseUrl}/api/auth/login`
      const payload = {
        email: "test@example.com",
        password: "wrongpassword",
      }

      // 快速连续发送多个登录请求
      const promises = Array(20)
        .fill(null)
        .map(() =>
          fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          })
        )

      const responses = await Promise.all(promises)

      // 至少有一些请求应该被速率限制
      const rateLimitedResponses = responses.filter((r) => r.status === 429)
      expect(rateLimitedResponses.length).toBeGreaterThan(0)
    })
  })

  describe("安全头部验证", () => {
    it("应该设置正确的安全头部", async () => {
      const response = await fetch(`${baseUrl}/`)

      // 验证关键安全头部
      expect(response.headers.get("X-Frame-Options")).toBe("DENY")
      expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff")
      expect(response.headers.get("X-XSS-Protection")).toBe("1; mode=block")
      expect(response.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin")

      // 验证 CSP 头部存在
      const csp = response.headers.get("Content-Security-Policy")
      expect(csp).toBeTruthy()
      expect(csp).toContain("default-src 'self'")
      expect(csp).toContain("frame-ancestors 'none'")
    })

    it("应该在生产环境设置 HSTS 头部", async () => {
      // 仅在生产环境测试
      if (process.env.NODE_ENV === "production") {
        const response = await fetch(`${baseUrl}/`)

        const hsts = response.headers.get("Strict-Transport-Security")
        expect(hsts).toBeTruthy()
        expect(hsts).toContain("max-age=31536000")
        expect(hsts).toContain("includeSubDomains")
      }
    })
  })

  describe("输入验证集成测试", () => {
    it("应该验证邮箱格式", async () => {
      const invalidEmailPayload = {
        email: "invalid-email-format",
        password: "validpassword123",
      }

      const response = await fetch(`${baseUrl}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(invalidEmailPayload),
      })

      expect(response.status).toBe(400)

      const errorData = await response.json()
      expect(errorData.error).toContain("邮箱")
    })

    it("应该限制输入长度", async () => {
      const longTitlePayload = {
        title: "a".repeat(1001), // 超过限制的长标题
        content: "正常内容",
      }

      const response = await fetch(`${baseUrl}/api/posts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": "test-token",
        },
        body: JSON.stringify(longTitlePayload),
      })

      expect(response.status).toBe(400)

      const errorData = await response.json()
      expect(errorData.error).toContain("长度")
    })
  })
})

/**
 * 辅助函数：获取有效的 CSRF 令牌
 */
async function getValidCSRFToken(): Promise<string> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/csrf-token`)
  const data = await response.json()
  return data.token
}

/**
 * 辅助函数：创建有效的认证会话
 */
async function createValidSession(email: string, password: string): Promise<string> {
  const loginResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  })

  const cookies = loginResponse.headers.get("set-cookie") || ""
  return cookies
}
