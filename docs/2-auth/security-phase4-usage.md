# Phase 4 安全增强使用指南

本文档介绍如何使用 Phase
4 安全增强功能，包括 CSRF 保护、XSS 防护、JWT 会话管理等企业级安全特性。

## 📋 目录

1. [安全架构概览](#安全架构概览)
2. [JWT 会话管理](#jwt-会话管理)
3. [XSS 防护与内容清理](#xss-防护与内容清理)
4. [API 安全装饰器](#api-安全装饰器)
5. [Server Actions 安全](#server-actions-安全)
6. [安全中间件](#安全中间件)
7. [配置管理](#配置管理)
8. [最佳实践](#最佳实践)

## 安全架构概览

Phase 4 安全系统采用多层防护架构：

```
请求 → 中间件安全检查 → API安全装饰器 → 业务逻辑 → 响应
     ↓                ↓               ↓
   速率限制         JWT验证         输入清理
   CSRF保护         权限检查        输出编码
   XSS检测          会话验证        安全头部
```

### 核心安全组件

- **SecurityMiddleware**: 统一的安全中间件处理器
- **JWTSecurity**: JWT 令牌生成和验证
- **AdvancedXSSCleaner**: 高级 XSS 清理器
- **SessionStore**: 会话存储和管理
- **InputSanitizer**: 输入数据清理器

## JWT 会话管理

### 基础用法

```typescript
import { JWTSecurity, TokenRefreshManager, SessionStore } from "@/lib/security"

// 生成访问令牌
const accessToken = JWTSecurity.generateAccessToken(
  "user123", // 用户ID
  "user@example.com", // 用户邮箱
  "USER", // 用户角色
  "session123" // 会话ID
)

// 验证访问令牌
const validation = JWTSecurity.validateAccessToken(accessToken)
if (validation.isValid) {
  const payload = validation.data
  console.log("用户ID:", payload.sub)
  console.log("用户角色:", payload.role)
}
```

### 令牌刷新

```typescript
// 生成刷新令牌
const refreshToken = JWTSecurity.generateRefreshToken("user123", "session123")

// 使用刷新令牌获取新的访问令牌
const refreshResult = await TokenRefreshManager.refreshAccessToken(
  refreshToken,
  SessionStore
)

if (refreshResult) {
  const { accessToken, refreshToken: newRefreshToken } = refreshResult
  // 更新客户端令牌
}
```

### 会话管理

```typescript
// 创建会话
const session = await SessionStore.createSession("user123", "fingerprint123", {
  userAgent: "Mozilla/5.0...",
  ipAddress: "192.168.1.1",
})

// 验证会话
const validation = await SessionStore.validateSession(
  session.id,
  "fingerprint123",
  {
    checkFingerprint: true,
    updateLastAccessed: true,
    extendSession: false,
  }
)

// 使会话失效
await SessionStore.invalidateSession(session.id)
```

## XSS 防护与内容清理

### 高级 HTML 清理

```typescript
import {
  AdvancedXSSCleaner,
  ContentValidator,
  InputSanitizer,
} from "@/lib/security"

// 深度 HTML 清理
const userInput = '<p>安全内容</p><script>alert("XSS")</script>'
const cleaned = AdvancedXSSCleaner.deepSanitizeHTML(userInput, {
  allowHtml: true,
  removeScripts: true,
  removeStyles: true,
  removeLinks: false,
  maxLength: 5000,
})
// 结果: '<p>安全内容</p>' (脚本已被移除)
```

### 内容验证

```typescript
// 验证内容安全性
const validation = ContentValidator.validateContent(userInput)
if (!validation.isValid) {
  console.error("发现安全违规:", validation.errorMessage)
  console.log("违规详情:", validation.data?.violations)
}

// 添加自定义验证规则
ContentValidator.addValidationRule({
  name: "custom_rule",
  validate: (input: string) => !input.includes("禁用词"),
  errorMessage: "内容包含禁用词汇",
  severity: "medium",
})
```

### 输入清理

```typescript
// 按类型清理输入
const cleanedText = InputSanitizer.sanitizeUserInput("  用户输入  ", "text")
const cleanedEmail = InputSanitizer.sanitizeUserInput(
  "User@Example.com",
  "email"
)
const cleanedUrl = InputSanitizer.sanitizeUserInput(
  "https://example.com",
  "url"
)

// 清理对象中的所有字符串
const dirtyData = {
  name: "  用户名  ",
  email: "USER@EXAMPLE.COM",
  bio: '<script>alert("xss")</script>个人简介',
}

const cleanedData = InputSanitizer.sanitizeObject(dirtyData, {
  name: "text",
  email: "email",
  bio: "html",
})
```

## API 安全装饰器

### 基础用法

```typescript
import {
  withApiSecurity,
  SecurityConfigs,
  createSuccessResponse,
} from "@/lib/security"

// 公开API - 基础安全防护
export const GET = withApiSecurity(async (request: NextRequest) => {
  const data = { message: "Hello World" }
  return createSuccessResponse(data)
}, SecurityConfigs.public)

// 需要认证的API
export const POST = withApiSecurity(
  async (request: NextRequest, { security }) => {
    const userId = security?.userId // 从JWT令牌中获取
    const body = await request.json()

    // 业务逻辑处理
    return createSuccessResponse({ userId, data: body })
  },
  SecurityConfigs.authenticated
)

// 管理员专用API
export const DELETE = withApiSecurity(
  async (request: NextRequest, { security }) => {
    // 只有管理员能执行删除操作
    return createSuccessResponse({ deleted: true })
  },
  SecurityConfigs.admin
)
```

### 自定义安全配置

```typescript
export const PATCH = withApiSecurity(
  async (request: NextRequest) => {
    // API 处理逻辑
    return createSuccessResponse({ updated: true })
  },
  {
    requireAuth: true,
    requireAdmin: false,
    validateCSRF: true,
    sanitizeInput: true,
    allowedMethods: ["PATCH"],
    rateLimit: { maxRequests: 10, windowMs: 60 * 1000 },
    customValidation: async (request, context) => {
      // 自定义验证逻辑
      const { searchParams } = new URL(request.url)
      const id = searchParams.get("id")

      if (!id || id.length > 50) {
        return {
          isValid: false,
          errorCode: "INVALID_ID",
          errorMessage: "ID参数无效",
        }
      }

      return { isValid: true }
    },
  }
)
```

## Server Actions 安全

```typescript
import { withServerActionSecurity } from "@/lib/security"

// 保护 Server Action
const createPost = withServerActionSecurity(
  async (formData: FormData) => {
    const title = formData.get("title") as string
    const content = formData.get("content") as string

    // 输入会被自动清理
    // 业务逻辑处理

    return { success: true, postId: "new-post-id" }
  },
  {
    requireAuth: true,
    sanitizeInput: true,
  }
)
```

## 安全中间件

### 集成到现有中间件

```typescript
// middleware.ts
import { SecurityMiddleware, createSecurityContext } from "@/lib/security"

export async function middleware(request: NextRequest) {
  // 创建安全上下文
  const securityContext = createSecurityContext(request)

  // 执行安全检查
  const securityResult = await SecurityMiddleware.processSecurityChecks(
    request,
    securityContext
  )

  if (securityResult) {
    // 安全检查失败，返回错误响应
    return securityResult
  }

  // 继续正常处理
  return NextResponse.next()
}
```

### 安全上下文使用

```typescript
// 在API路由中访问安全上下文
export const POST = withApiSecurity(
  async (request: NextRequest, { security }) => {
    console.log("请求ID:", security?.requestId)
    console.log("客户端IP:", security?.clientIP)
    console.log("用户ID:", security?.userId)
    console.log("用户角色:", security?.userRole)
    console.log("会话ID:", security?.sessionId)

    return createSuccessResponse({ message: "处理成功" })
  },
  SecurityConfigs.authenticated
)
```

## 配置管理

### 环境特定配置

```typescript
import { getSecurityConfig, securityConfig } from "@/lib/security"

// 获取当前环境的安全配置
const config = getSecurityConfig()

// 访问特定配置项
console.log("JWT访问令牌有效期:", config.jwt.accessTokenExpiresIn)
console.log("CSRF令牌长度:", config.csrf.tokenLength)
console.log("XSS严格模式:", config.xss.strictMode)
console.log("速率限制:", config.rateLimit.maxRequests)
```

### 路径特定配置

```typescript
import { pathSecurityConfigs } from "@/lib/security"

// 获取特定路径的安全配置
const adminConfig = pathSecurityConfigs["/api/admin"]
const publicConfig = pathSecurityConfigs["/api/public"]
```

### 自定义配置

```typescript
// 在生产环境中设置环境变量
/*
JWT_ACCESS_SECRET=your-super-secure-access-secret-key-here
JWT_REFRESH_SECRET=your-super-secure-refresh-secret-key-here
JWT_ISSUER=your-app-name
JWT_AUDIENCE=your-app-users
*/
```

## 最佳实践

### 1. JWT 令牌管理

```typescript
// ✅ 正确：短期访问令牌 + 长期刷新令牌
const accessToken = JWTSecurity.generateAccessToken(
  userId,
  email,
  role,
  sessionId
)
const refreshToken = JWTSecurity.generateRefreshToken(userId, sessionId)

// ✅ 正确：检查令牌是否需要刷新
if (TokenRefreshManager.shouldRefreshToken(accessToken)) {
  const newTokens = await TokenRefreshManager.refreshAccessToken(
    refreshToken,
    SessionStore
  )
}

// ❌ 错误：长期访问令牌
// 不要设置过长的访问令牌有效期
```

### 2. 输入验证与清理

```typescript
// ✅ 正确：先清理，再验证
const sanitizedInput = InputSanitizer.sanitizeUserInput(userInput, "html")
if (sanitizedInput) {
  const validation = ContentValidator.validateContent(sanitizedInput)
  if (validation.isValid) {
    // 使用清理和验证后的数据
  }
}

// ❌ 错误：直接使用用户输入
// 不要直接将未清理的用户输入存储到数据库
```

### 3. API 安全防护

```typescript
// ✅ 正确：使用预定义的安全配置
export const POST = withApiSecurity(handler, SecurityConfigs.authenticated)

// ✅ 正确：针对敏感操作使用严格配置
export const DELETE = withApiSecurity(handler, {
  ...SecurityConfigs.admin,
  rateLimit: { maxRequests: 5, windowMs: 60 * 1000 }, // 更严格的限制
})

// ❌ 错误：跳过安全检查
// 不要为了方便而绕过安全装饰器
```

### 4. 会话管理

```typescript
// ✅ 正确：定期验证会话指纹
const validation = await SessionStore.validateSession(sessionId, fingerprint, {
  checkFingerprint: true,
  updateLastAccessed: true,
})

// ✅ 正确：检测到异常时立即使会话失效
if (validation.errorCode === "SESSION_HIJACK_DETECTED") {
  await SessionStore.invalidateUserSessions(userId) // 使所有会话失效
}

// ❌ 错误：忽略会话安全
// 不要跳过会话指纹验证
```

### 5. 错误处理

```typescript
// ✅ 正确：提供有用的错误信息，但不暴露敏感细节
try {
  const result = await someSecureOperation()
  return createSuccessResponse(result)
} catch (error) {
  console.error("操作失败:", error) // 记录详细错误
  return createSuccessResponse(
    { error: "操作失败，请稍后重试" }, // 返回通用错误信息
    500
  )
}

// ❌ 错误：暴露系统内部信息
// 不要将详细的错误堆栈返回给客户端
```

### 6. 安全监控

```typescript
// ✅ 正确：记录安全事件
const securityContext = createSecurityContext(request)
// 安全中间件会自动记录可疑活动

// ✅ 正确：监控API响应时间
export const GET = withApiSecurity(async (request, { security }) => {
  const startTime = Date.now()
  const result = await businessLogic()
  const duration = Date.now() - startTime

  if (duration > 1000) {
    console.warn(`API响应时间过长: ${request.url} - ${duration}ms`)
  }

  return createSuccessResponse(result)
}, SecurityConfigs.authenticated)
```

## 环境变量配置

在 `.env.local` 文件中设置：

```bash
# JWT 配置
JWT_ACCESS_SECRET=your-super-secure-access-secret-key-minimum-32-chars
JWT_REFRESH_SECRET=your-super-secure-refresh-secret-key-minimum-32-chars
JWT_ISSUER=jikns-blog
JWT_AUDIENCE=jikns-blog-users

# 站点配置
NEXT_PUBLIC_SITE_URL=https://your-domain.com

# Supabase 配置（已有）
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## 性能考虑

1. **JWT 验证缓存**: JWT 验证是无状态的，性能良好
2. **会话存储**: 使用内存存储，生产环境建议使用 Redis
3. **内容清理**: XSS 清理有性能开销，建议对输入长度设置合理限制
4. **速率限制**: 内存实现，重启后重置，生产环境建议使用分布式存储

## 故障排除

### 常见错误

1. **JWT_ACCESS_SECRET 过短**: 确保密钥至少32个字符
2. **CSRF 验证失败**: 检查请求头是否包含正确的 CSRF 令牌
3. **会话劫持检测**: 用户代理或网络环境变化可能触发误报
4. **输入清理过度**: 调整 XSS 清理配置以适应业务需求

### 调试技巧

```typescript
// 启用详细日志（开发环境）
process.env.DEBUG_SECURITY = "true"

// 检查安全上下文
console.log("安全上下文:", JSON.stringify(securityContext, null, 2))

// 验证配置
import { validateSecurityConfig } from "@/lib/security"
const validation = validateSecurityConfig(securityConfig)
console.log("配置验证:", validation)
```

通过遵循这些指南和最佳实践，你可以充分利用 Phase
4 安全增强功能，为你的应用构建强大的安全防护体系。
