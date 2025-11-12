/**
 * Toast 错误分类测试
 * 验证真实的错误分类逻辑实现
 */

import { vi, expect, describe, it, beforeEach } from "vitest"
import { classifyAndFormatError } from "@/lib/error-handling/classify-auth-error"

// Mock依赖
vi.mock("@/lib/error-handling/auth-error", () => ({
  AuthError: vi.fn().mockImplementation((message, code) => ({
    message,
    code,
    name: "AuthError",
  })),
  isAuthError: vi.fn((error) => error?.name === "AuthError"),
}))

describe("错误分类逻辑测试", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("JWT 错误处理", () => {
    it("应该正确处理 JWT expired 错误", () => {
      const result = classifyAndFormatError({ message: "JWT expired" })
      expect(result.code).toBe("SESSION_EXPIRED")
      expect(result.message).toBe("您的登录已过期，请重新登录")
    })

    it("应该正确处理 Invalid JWT 错误", () => {
      const result = classifyAndFormatError({ message: "Invalid JWT token" })
      expect(result.code).toBe("INVALID_TOKEN")
      expect(result.message).toBe("登录信息无效，请重新登录")
    })
  })

  describe("权限错误处理", () => {
    it("应该正确处理权限不足消息", () => {
      const result = classifyAndFormatError({ message: "权限不足，无法访问" })
      expect(result.code).toBe("FORBIDDEN")
      expect(result.message).toBe("权限不足，无法执行此操作")
    })

    it("应该正确处理 HTTP 403", () => {
      const result = classifyAndFormatError({ status: 403, message: "Forbidden" })
      expect(result.code).toBe("FORBIDDEN")
      expect(result.message).toBe("权限不足，无法执行此操作")
    })
  })

  describe("网络错误处理", () => {
    it("应该正确处理 NetworkError", () => {
      const result = classifyAndFormatError({ name: "NetworkError", message: "Network failed" })
      expect(result.code).toBe("NETWORK_ERROR")
      expect(result.message).toBe("网络连接失败，请重试")
    })

    it("应该正确处理 NETWORK_ERROR 代码", () => {
      const result = classifyAndFormatError({ code: "NETWORK_ERROR", message: "Connection failed" })
      expect(result.code).toBe("NETWORK_ERROR")
      expect(result.message).toBe("网络连接失败，请重试")
    })
  })

  describe("验证错误处理", () => {
    it("应该正确处理验证失败消息", () => {
      const result = classifyAndFormatError({ message: "验证失败" })
      expect(result.code).toBe("VALIDATION_ERROR")
      expect(result.message).toBe("输入信息有误，请检查后重试")
    })

    it("应该正确处理 HTTP 400", () => {
      const result = classifyAndFormatError({ status: 400, message: "Bad Request" })
      expect(result.code).toBe("VALIDATION_ERROR")
      expect(result.message).toBe("输入信息有误，请检查后重试")
    })
  })

  describe("旧 AuthErrorType 兼容性", () => {
    it("应该正确处理 NETWORK_ERROR 类型", () => {
      const result = classifyAndFormatError({ type: "NETWORK_ERROR", message: "Network failure" })
      expect(result.code).toBe("NETWORK_ERROR")
      expect(result.message).toBe("网络连接失败，请重试")
    })

    it("应该正确处理 VALIDATION_ERROR 类型", () => {
      const result = classifyAndFormatError({
        type: "VALIDATION_ERROR",
        message: "Validation failed",
      })
      expect(result.code).toBe("VALIDATION_ERROR")
      expect(result.message).toBe("输入信息有误，请检查后重试")
    })

    it("应该正确处理 USER_NOT_FOUND 类型", () => {
      const result = classifyAndFormatError({ type: "USER_NOT_FOUND", message: "User not found" })
      expect(result.code).toBe("INVALID_CREDENTIALS")
      expect(result.message).toBe("用户不存在")
    })

    it("应该正确处理 SESSION_EXPIRED 类型", () => {
      const result = classifyAndFormatError({ type: "SESSION_EXPIRED" })
      expect(result.code).toBe("SESSION_EXPIRED")
      expect(result.message).toBe("您的登录已过期，请重新登录")
    })

    it("应该正确处理 TOKEN_INVALID 类型", () => {
      const result = classifyAndFormatError({ type: "TOKEN_INVALID" })
      expect(result.code).toBe("INVALID_TOKEN")
      expect(result.message).toBe("登录信息无效，请重新登录")
    })

    it("应该正确处理 INSUFFICIENT_PERMISSIONS 类型", () => {
      const result = classifyAndFormatError({ type: "INSUFFICIENT_PERMISSIONS" })
      expect(result.code).toBe("FORBIDDEN")
      expect(result.message).toBe("权限不足，无法执行此操作")
    })

    it("应该正确处理 ACCOUNT_BANNED 类型", () => {
      const result = classifyAndFormatError({ type: "ACCOUNT_BANNED" })
      expect(result.code).toBe("ACCOUNT_BANNED")
      expect(result.message).toBe("账户已被限制，请联系管理员")
    })

    it("应该正确处理 INVALID_CREDENTIALS 类型", () => {
      const result = classifyAndFormatError({ type: "INVALID_CREDENTIALS" })
      expect(result.code).toBe("INVALID_CREDENTIALS")
      expect(result.message).toBe("用户名或密码错误")
    })

    it("应该正确处理 EMAIL_ALREADY_REGISTERED 类型", () => {
      const result = classifyAndFormatError({ type: "EMAIL_ALREADY_REGISTERED" })
      expect(result.code).toBe("VALIDATION_ERROR")
      expect(result.message).toBe("邮箱已被注册")
    })

    it("应该正确处理 REGISTRATION_FAILED 类型", () => {
      const result = classifyAndFormatError({ type: "REGISTRATION_FAILED" })
      expect(result.code).toBe("VALIDATION_ERROR")
      expect(result.message).toBe("注册失败")
    })

    it("应该正确处理 GITHUB_AUTH_FAILED 类型", () => {
      const result = classifyAndFormatError({ type: "GITHUB_AUTH_FAILED" })
      expect(result.code).toBe("UNAUTHORIZED")
      expect(result.message).toBe("GitHub 登录失败")
    })

    it("应该正确处理 UNKNOWN_ERROR 类型", () => {
      const result = classifyAndFormatError({ type: "UNKNOWN_ERROR" })
      expect(result.code).toBe("UNKNOWN_ERROR")
      expect(result.message).toBe("操作失败，请稍后重试")
    })
  })

  describe("服务器错误处理", () => {
    it("应该正确处理 HTTP 500", () => {
      const result = classifyAndFormatError({ status: 500, message: "Internal Server Error" })
      expect(result.code).toBe("UNKNOWN_ERROR")
      expect(result.message).toBe("服务器错误，请稍后重试")
    })

    it("应该正确处理 HTTP 502", () => {
      const result = classifyAndFormatError({ status: 502, message: "Bad Gateway" })
      expect(result.code).toBe("UNKNOWN_ERROR")
      expect(result.message).toBe("服务器错误，请稍后重试")
    })

    it("应该正确处理 HTTP 503", () => {
      const result = classifyAndFormatError({ status: 503, message: "Service Unavailable" })
      expect(result.code).toBe("UNKNOWN_ERROR")
      expect(result.message).toBe("服务器错误，请稍后重试")
    })
  })

  describe("特定消息内容检测", () => {
    it('应该正确处理"会话已过期"消息', () => {
      const result = classifyAndFormatError({ message: "会话已过期，请登录" })
      expect(result.code).toBe("SESSION_EXPIRED")
      expect(result.message).toBe("您的登录已过期，请重新登录")
    })

    it('应该正确处理"认证令牌无效"消息', () => {
      const result = classifyAndFormatError({ message: "认证令牌无效" })
      expect(result.code).toBe("INVALID_TOKEN")
      expect(result.message).toBe("登录信息无效，请重新登录")
    })

    it('应该正确处理"用户名或密码错误"消息', () => {
      const result = classifyAndFormatError({ message: "用户名或密码错误" })
      expect(result.code).toBe("INVALID_CREDENTIALS")
      expect(result.message).toBe("用户名或密码错误")
    })

    it('应该正确处理"账户已被封禁"消息', () => {
      const result = classifyAndFormatError({ message: "账户已被封禁" })
      expect(result.code).toBe("ACCOUNT_BANNED")
      expect(result.message).toBe("账户已被限制，请联系管理员")
    })
  })

  describe("默认情况处理", () => {
    it("应该正确处理未知错误", () => {
      const result = classifyAndFormatError({ message: "Some unknown error" })
      expect(result.code).toBe("UNKNOWN_ERROR")
      expect(result.message).toBe("Some unknown error")
    })

    it("应该正确处理空错误对象", () => {
      const result = classifyAndFormatError({})
      expect(result.code).toBe("UNKNOWN_ERROR")
      expect(result.message).toBe("操作失败，请稍后重试")
    })

    it("应该正确处理 null", () => {
      const result = classifyAndFormatError(null)
      expect(result.code).toBe("UNKNOWN_ERROR")
      expect(result.message).toBe("操作失败，请稍后重试")
    })

    it("应该正确处理 undefined", () => {
      const result = classifyAndFormatError(undefined)
      expect(result.code).toBe("UNKNOWN_ERROR")
      expect(result.message).toBe("操作失败，请稍后重试")
    })
  })

  describe("综合场景测试", () => {
    it("优先级测试：JWT过期优先于其他检测", () => {
      const result = classifyAndFormatError({
        message: "JWT expired 权限不足",
        status: 403,
      })
      expect(result.code).toBe("SESSION_EXPIRED")
      expect(result.message).toBe("您的登录已过期，请重新登录")
    })

    it("优先级测试：权限错误优先于网络错误", () => {
      const result = classifyAndFormatError({
        message: "权限不足",
        name: "NetworkError",
      })
      expect(result.code).toBe("FORBIDDEN")
      expect(result.message).toBe("权限不足，无法执行此操作")
    })

    it("优先级测试：类型映射优先于状态码", () => {
      const result = classifyAndFormatError({
        type: "NETWORK_ERROR",
        status: 400,
      })
      expect(result.code).toBe("NETWORK_ERROR")
      expect(result.message).toBe("网络连接失败，请重试")
    })
  })
})
