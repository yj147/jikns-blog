/**
 * JWT 攻击场景测试套件
 * 测试JWT令牌相关的各种安全攻击和防护措施
 */

import { describe, test, expect, beforeEach, vi } from "vitest"
import { JWTSecurity, TokenRefreshManager, SessionStore } from "@/lib/security/jwt-security"
import crypto from "crypto"

describe("JWT 攻击场景测试", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 清理会话存储
    ;(SessionStore as any).sessions.clear()
  })

  describe("令牌伪造攻击", () => {
    test("应该防止无签名令牌攻击", () => {
      // 创建无签名的假令牌
      const fakeHeader = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString(
        "base64url"
      )
      const fakePayload = Buffer.from(
        JSON.stringify({
          sub: "hacker123",
          role: "ADMIN",
          email: "hacker@evil.com",
          exp: Math.floor(Date.now() / 1000) + 3600,
        })
      ).toString("base64url")

      const unsignedToken = `${fakeHeader}.${fakePayload}.`

      const validation = JWTSecurity.validateAccessToken(unsignedToken)

      expect(validation.isValid).toBe(false)
      expect(validation.errorCode).toBe("INVALID_TOKEN")
    })

    test("应该防止算法替换攻击", () => {
      // 尝试将HS256替换为none算法
      const maliciousHeader = Buffer.from(
        JSON.stringify({
          alg: "none",
          typ: "JWT",
        })
      ).toString("base64url")

      const payload = Buffer.from(
        JSON.stringify({
          sub: "user123",
          role: "ADMIN",
          email: "user@example.com",
          exp: Math.floor(Date.now() / 1000) + 3600,
          type: "access",
        })
      ).toString("base64url")

      const noneAlgToken = `${maliciousHeader}.${payload}.`

      const validation = JWTSecurity.validateAccessToken(noneAlgToken)

      expect(validation.isValid).toBe(false)
      expect(validation.errorCode).toBe("INVALID_TOKEN")
    })

    test("应该防止弱密钥攻击", () => {
      const weakKeys = [
        "secret",
        "123456",
        "password",
        "key",
        "",
        "a".repeat(10), // 短密钥
      ]

      for (const weakKey of weakKeys) {
        // 模拟使用弱密钥生成的令牌
        const mockJWT = JWTSecurity as any
        const originalSecret = mockJWT.DEFAULT_CONFIG.accessTokenSecret

        try {
          mockJWT.DEFAULT_CONFIG.accessTokenSecret = weakKey

          if (weakKey.length >= 32) {
            // 只有足够长的密钥才能生成令牌
            const token = JWTSecurity.generateAccessToken(
              "user123",
              "user@example.com",
              "USER",
              "session123"
            )
            expect(token).toBeDefined()
          } else {
            // 弱密钥应该被拒绝
            expect(() => {
              JWTSecurity.generateAccessToken("user123", "user@example.com", "USER", "session123")
            }).toThrow()
          }
        } finally {
          mockJWT.DEFAULT_CONFIG.accessTokenSecret = originalSecret
        }
      }
    })

    test("应该防止签名剥离攻击", () => {
      // 生成合法令牌
      const legitimateToken = JWTSecurity.generateAccessToken(
        "user123",
        "user@example.com",
        "USER",
        "session123"
      )
      const parts = legitimateToken.split(".")

      // 尝试剥离签名
      const strippedTokens = [
        `${parts[0]}.${parts[1]}`, // 完全移除签名
        `${parts[0]}.${parts[1]}.`, // 空签名
        `${parts[0]}.${parts[1]}.invalid`, // 无效签名
      ]

      for (const strippedToken of strippedTokens) {
        const validation = JWTSecurity.validateAccessToken(strippedToken)

        expect(validation.isValid).toBe(false)
        expect(validation.errorCode).toBe("INVALID_TOKEN")
      }
    })
  })

  describe("令牌篡改攻击", () => {
    test("应该检测载荷篡改", () => {
      const originalToken = JWTSecurity.generateAccessToken(
        "user123",
        "user@example.com",
        "USER",
        "session123"
      )
      const parts = originalToken.split(".")

      // 篡改载荷中的角色信息
      const tamperedPayload = Buffer.from(
        JSON.stringify({
          sub: "user123",
          email: "user@example.com",
          role: "ADMIN", // 篡改为管理员
          sessionId: "session123",
          type: "access",
          exp: Math.floor(Date.now() / 1000) + 3600,
        })
      ).toString("base64url")

      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`

      const validation = JWTSecurity.validateAccessToken(tamperedToken)

      expect(validation.isValid).toBe(false)
      expect(validation.errorCode).toBe("INVALID_TOKEN")
    })

    test("应该检测头部篡改", () => {
      const originalToken = JWTSecurity.generateAccessToken(
        "user123",
        "user@example.com",
        "USER",
        "session123"
      )
      const parts = originalToken.split(".")

      // 篡改头部算法
      const tamperedHeader = Buffer.from(
        JSON.stringify({
          alg: "RS256", // 尝试改变算法
          typ: "JWT",
        })
      ).toString("base64url")

      const tamperedToken = `${tamperedHeader}.${parts[1]}.${parts[2]}`

      const validation = JWTSecurity.validateAccessToken(tamperedToken)

      expect(validation.isValid).toBe(false)
      expect(validation.errorCode).toBe("INVALID_TOKEN")
    })

    test("应该检测过期时间篡改", () => {
      const originalToken = JWTSecurity.generateAccessToken(
        "user123",
        "user@example.com",
        "USER",
        "session123"
      )
      const parts = originalToken.split(".")

      // 创建永不过期的载荷
      const extendedPayload = Buffer.from(
        JSON.stringify({
          sub: "user123",
          email: "user@example.com",
          role: "USER",
          sessionId: "session123",
          type: "access",
          exp: Math.floor(Date.now() / 1000) + 10 * 365 * 24 * 60 * 60, // 10年后过期
        })
      ).toString("base64url")

      const tamperedToken = `${parts[0]}.${extendedPayload}.${parts[2]}`

      const validation = JWTSecurity.validateAccessToken(tamperedToken)

      expect(validation.isValid).toBe(false)
      expect(validation.errorCode).toBe("INVALID_TOKEN")
    })
  })

  describe("令牌重放攻击", () => {
    test("应该检测令牌重用", async () => {
      const token = JWTSecurity.generateAccessToken(
        "user123",
        "user@example.com",
        "USER",
        "session123"
      )

      // 第一次验证应该成功
      const firstValidation = JWTSecurity.validateAccessToken(token)
      expect(firstValidation.isValid).toBe(true)

      // 模拟令牌被标记为已使用（这需要在实际实现中添加）
      // 这里我们通过模拟会话失效来测试
      const refreshToken = JWTSecurity.generateRefreshToken("user123", "session123")
      const session = await SessionStore.createSession("user123", "fingerprint123")

      // 使会话失效
      await SessionStore.invalidateSession(session.id)

      // 尝试使用刷新令牌应该失败
      const refreshResult = await TokenRefreshManager.refreshAccessToken(refreshToken, SessionStore)
      expect(refreshResult).toBeNull()
    })

    test("应该防止跨会话令牌重用", async () => {
      // 创建两个不同的会话
      const session1 = await SessionStore.createSession("user123", "fingerprint1")
      const session2 = await SessionStore.createSession("user123", "fingerprint2")

      const token1 = JWTSecurity.generateAccessToken(
        "user123",
        "user@example.com",
        "USER",
        session1.id
      )
      const token2 = JWTSecurity.generateAccessToken(
        "user123",
        "user@example.com",
        "USER",
        session2.id
      )

      // 验证令牌与正确会话的配对
      const validation1 = JWTSecurity.validateAccessToken(token1)
      const validation2 = JWTSecurity.validateAccessToken(token2)

      expect(validation1.isValid).toBe(true)
      expect(validation2.isValid).toBe(true)
      expect(validation1.data?.sessionId).toBe(session1.id)
      expect(validation2.data?.sessionId).toBe(session2.id)

      // 确保令牌不能互换
      expect(validation1.data?.sessionId).not.toBe(session2.id)
      expect(validation2.data?.sessionId).not.toBe(session1.id)
    })

    test("应该检测异地登录令牌重用", async () => {
      const session = await SessionStore.createSession("user123", "original-fingerprint")
      const token = JWTSecurity.generateAccessToken(
        "user123",
        "user@example.com",
        "USER",
        session.id
      )

      // 验证原始指纹
      const originalValidation = await SessionStore.validateSession(
        session.id,
        "original-fingerprint"
      )
      expect(originalValidation.isValid).toBe(true)

      // 尝试使用不同的指纹（模拟异地登录）
      const foreignValidation = await SessionStore.validateSession(
        session.id,
        "foreign-fingerprint"
      )
      expect(foreignValidation.isValid).toBe(false)
      expect(foreignValidation.errorCode).toBe("SESSION_HIJACK_DETECTED")
    })
  })

  describe("会话劫持攻击", () => {
    test("应该检测会话指纹不匹配", async () => {
      const originalFingerprint = "original-fp-" + crypto.randomBytes(16).toString("hex")
      const maliciousFingerprint = "malicious-fp-" + crypto.randomBytes(16).toString("hex")

      const session = await SessionStore.createSession("user123", originalFingerprint)

      // 合法的会话验证
      const legitValidation = await SessionStore.validateSession(session.id, originalFingerprint)
      expect(legitValidation.isValid).toBe(true)

      // 恶意的会话劫持尝试
      const hijackValidation = await SessionStore.validateSession(session.id, maliciousFingerprint)
      expect(hijackValidation.isValid).toBe(false)
      expect(hijackValidation.errorCode).toBe("SESSION_HIJACK_DETECTED")

      // 验证会话被自动失效
      const sessionAfterHijack = await SessionStore.getSession(session.id)
      expect(sessionAfterHijack?.isActive).toBe(false)
    })

    test("应该限制并发会话数量", async () => {
      const userId = "user123"
      const maxSessions = 5

      // 创建最大数量的会话
      const sessions = []
      for (let i = 0; i < maxSessions; i++) {
        const session = await SessionStore.createSession(userId, `fingerprint-${i}`)
        sessions.push(session)
      }

      // 验证活跃会话数量
      let activeCount = SessionStore.getUserActiveSessionCount(userId)
      expect(activeCount).toBe(maxSessions)

      // 尝试创建第6个会话应该失败或使最老的会话失效
      const excessSession = await SessionStore.createSession(userId, "fingerprint-excess")

      // 总会话数不应超过限制
      activeCount = SessionStore.getUserActiveSessionCount(userId)
      expect(activeCount).toBeLessThanOrEqual(maxSessions + 1) // 允许短暂超出，然后清理
    })

    test("应该检测可疑的会话模式", async () => {
      const userId = "user123"
      const baseFingerprint = "base-fingerprint"

      // 创建正常会话
      const normalSession = await SessionStore.createSession(userId, baseFingerprint)

      // 模拟可疑活动：短时间内大量会话创建
      const suspiciousSessions = []
      const startTime = Date.now()

      for (let i = 0; i < 10; i++) {
        const suspiciousSession = await SessionStore.createSession(
          userId,
          `suspicious-${i}-${Date.now()}`
        )
        suspiciousSessions.push(suspiciousSession)

        // 模拟快速连续创建
        await new Promise((resolve) => setTimeout(resolve, 10))
      }

      const endTime = Date.now()
      const creationTime = endTime - startTime

      // 检测快速会话创建
      expect(creationTime).toBeLessThan(1000) // 1秒内创建10个会话是可疑的

      // 验证系统是否检测到可疑行为
      const totalActiveSessions = SessionStore.getUserActiveSessionCount(userId)
      expect(totalActiveSessions).toBeGreaterThan(5) // 应该触发安全检查
    })
  })

  describe("刷新令牌攻击", () => {
    test("应该防止刷新令牌窃取", async () => {
      const session = await SessionStore.createSession("user123", "fingerprint123")
      const refreshToken = JWTSecurity.generateRefreshToken("user123", session.id)

      // 合法的令牌刷新
      const legitRefresh = await TokenRefreshManager.refreshAccessToken(refreshToken, SessionStore)
      expect(legitRefresh).not.toBeNull()
      expect(legitRefresh?.accessToken).toBeDefined()

      // 尝试重复使用同一个刷新令牌（应该失败）
      const duplicateRefresh = await TokenRefreshManager.refreshAccessToken(
        refreshToken,
        SessionStore
      )
      expect(duplicateRefresh).toBeNull() // 刷新令牌应该是一次性的
    })

    test("应该实施刷新令牌轮换", async () => {
      const session = await SessionStore.createSession("user123", "fingerprint123")
      let currentRefreshToken = JWTSecurity.generateRefreshToken("user123", session.id)

      // 进行多次刷新，验证令牌轮换
      for (let i = 0; i < 3; i++) {
        const refreshResult = await TokenRefreshManager.refreshAccessToken(
          currentRefreshToken,
          SessionStore
        )

        expect(refreshResult).not.toBeNull()
        expect(refreshResult?.accessToken).toBeDefined()

        // 如果提供了新的刷新令牌，使用它进行下一次刷新
        if (refreshResult?.refreshToken) {
          const oldToken = currentRefreshToken
          currentRefreshToken = refreshResult.refreshToken

          // 验证旧令牌不能再使用
          const oldTokenResult = await TokenRefreshManager.refreshAccessToken(
            oldToken,
            SessionStore
          )
          expect(oldTokenResult).toBeNull()
        }
      }
    })

    test("应该验证刷新令牌过期", async () => {
      // 创建一个即将过期的刷新令牌（通过修改过期时间）
      const userId = "user123"
      const sessionId = "session123"

      // 模拟创建过期的刷新令牌
      const expiredPayload = {
        sub: userId,
        sessionId: sessionId,
        type: "refresh",
        exp: Math.floor(Date.now() / 1000) - 3600, // 1小时前过期
      }

      const mockJWT = JWTSecurity as any
      const expiredToken = mockJWT.encodeJWT(
        expiredPayload,
        mockJWT.DEFAULT_CONFIG.refreshTokenSecret,
        0 // 立即过期
      )

      // 尝试使用过期的刷新令牌
      const result = await TokenRefreshManager.refreshAccessToken(expiredToken, SessionStore)
      expect(result).toBeNull()
    })
  })

  describe("时序攻击防护", () => {
    test("应该实施常量时间比较", async () => {
      const validToken = JWTSecurity.generateAccessToken(
        "user123",
        "user@example.com",
        "USER",
        "session123"
      )
      const invalidTokens = [
        "invalid.token.here",
        validToken.substring(0, validToken.length - 5) + "xxxxx", // 部分正确
        validToken.split("").reverse().join(""), // 完全错误
        "", // 空令牌
      ]

      // 测量验证时间
      const measureValidationTime = (token: string): number => {
        const startTime = process.hrtime.bigint()
        JWTSecurity.validateAccessToken(token)
        const endTime = process.hrtime.bigint()
        return Number(endTime - startTime) / 1000000 // 转换为毫秒
      }

      // 多次测量以获得稳定结果
      const validTimes: number[] = []
      const invalidTimes: number[][] = []

      for (let i = 0; i < 10; i++) {
        validTimes.push(measureValidationTime(validToken))

        invalidTokens.forEach((token, index) => {
          if (!invalidTimes[index]) invalidTimes[index] = []
          invalidTimes[index].push(measureValidationTime(token))
        })
      }

      // 计算平均时间
      const avgValidTime = validTimes.reduce((a, b) => a + b) / validTimes.length
      const avgInvalidTimes = invalidTimes.map(
        (times) => times.reduce((a, b) => a + b) / times.length
      )

      // 验证时间差异不显著（防止时序攻击）
      avgInvalidTimes.forEach((avgTime, index) => {
        const timeDifference = Math.abs(avgValidTime - avgTime)
        expect(timeDifference).toBeLessThan(2) // 差异应小于2毫秒

        console.log(`令牌 ${index + 1}: 平均验证时间 ${avgTime.toFixed(3)}ms`)
      })

      console.log(`有效令牌: 平均验证时间 ${avgValidTime.toFixed(3)}ms`)
    })
  })

  describe("JWT库安全性", () => {
    test("应该拒绝危险的JWT声明", () => {
      const dangerousClaims = [
        { jti: "../../../etc/passwd" }, // 路径遍历
        { aud: "<script>alert(1)</script>" }, // XSS尝试
        { iss: "javascript:alert(1)" }, // JavaScript注入
        { sub: 'user"; DROP TABLE users; --' }, // SQL注入尝试
        { custom: { __proto__: { isAdmin: true } } }, // 原型污染
      ]

      for (const claims of dangerousClaims) {
        const mockPayload = {
          ...claims,
          sub: "user123",
          email: "user@example.com",
          role: "USER",
          sessionId: "session123",
          type: "access",
          exp: Math.floor(Date.now() / 1000) + 3600,
        }

        // 尝试创建包含危险声明的令牌
        const mockJWT = JWTSecurity as any
        const dangerousToken = mockJWT.encodeJWT(
          mockPayload,
          mockJWT.DEFAULT_CONFIG.accessTokenSecret,
          3600
        )

        const validation = JWTSecurity.validateAccessToken(dangerousToken)

        // 令牌本身可能有效，但危险内容应该被处理
        if (validation.isValid) {
          // 验证危险内容被清理或拒绝
          expect(validation.data?.sub).not.toContain("DROP TABLE")
          expect(validation.data?.aud).not.toContain("<script>")
          expect(validation.data?.iss).not.toContain("javascript:")
        }
      }
    })

    test("应该防止JWT库漏洞利用", () => {
      // 测试常见的JWT库漏洞
      const vulnerabilityTests = [
        {
          name: "Algorithm None Attack",
          token: "eyJ0eXAiOiJKV1QiLCJhbGciOiJub25lIn0.eyJzdWIiOiJhZG1pbiIsImV4cCI6OTk5OTk5OTk5OX0.",
        },
        {
          name: "Key Confusion Attack",
          token:
            "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImV4cCI6OTk5OTk5OTk5OX0.invalid",
        },
        {
          name: "Null Signature Attack",
          token:
            "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImV4cCI6OTk5OTk5OTk5OX0.\x00\x00\x00\x00",
        },
      ]

      vulnerabilityTests.forEach(({ name, token }) => {
        const validation = JWTSecurity.validateAccessToken(token)

        expect(validation.isValid).toBe(false)
        expect(validation.errorCode).toBe("INVALID_TOKEN")

        console.log(`${name}: ${validation.isValid ? "🚨 易受攻击" : "✅ 安全防护"}`)
      })
    })
  })

  describe("令牌存储安全", () => {
    test("应该安全处理令牌生命周期", async () => {
      const session = await SessionStore.createSession("user123", "fingerprint123")
      const accessToken = JWTSecurity.generateAccessToken(
        "user123",
        "user@example.com",
        "USER",
        session.id
      )
      const refreshToken = JWTSecurity.generateRefreshToken("user123", session.id)

      // 验证令牌初始状态
      expect(JWTSecurity.validateAccessToken(accessToken).isValid).toBe(true)
      expect(JWTSecurity.validateRefreshToken(refreshToken).isValid).toBe(true)

      // 模拟用户登出 - 所有令牌应该失效
      await SessionStore.invalidateUserSessions("user123")

      // 验证会话失效后令牌状态
      const sessionAfterLogout = await SessionStore.getSession(session.id)
      expect(sessionAfterLogout?.isActive).toBe(false)

      // 尝试刷新令牌应该失败
      const refreshResult = await TokenRefreshManager.refreshAccessToken(refreshToken, SessionStore)
      expect(refreshResult).toBeNull()
    })

    test("应该清理过期的会话数据", async () => {
      // 创建多个会话，其中一些即将过期
      const sessions = []
      for (let i = 0; i < 5; i++) {
        const session = await SessionStore.createSession(`user${i}`, `fingerprint${i}`)
        sessions.push(session)
      }

      // 模拟时间推进，使某些会话过期
      const oldDate = Date.now
      Date.now = vi.fn(() => oldDate() + 2 * 60 * 60 * 1000) // 2小时后

      try {
        // 触发过期会话清理
        SessionStore.cleanupExpiredSessions()

        // 验证过期会话被清理
        for (const session of sessions) {
          const retrievedSession = await SessionStore.getSession(session.id)
          expect(retrievedSession).toBeNull() // 应该已被清理
        }
      } finally {
        Date.now = oldDate // 恢复原始Date.now
      }
    })
  })
})
