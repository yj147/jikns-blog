/**
 * 认证错误分类工具
 * 将各种错误格式映射到标准的 AuthErrorCode
 *
 * Phase 4.1 Quality Enhancement:
 * - 提取自 hooks/use-toast.ts 以支持独立测试
 * - 支持新增的 NETWORK_ERROR、VALIDATION_ERROR、UNKNOWN_ERROR
 * - 保留旧 AuthErrorType 的兼容性映射
 */

import type { AuthErrorCode } from "./auth-error"

/**
 * 错误分类结果
 */
export interface ClassifiedError {
  code: AuthErrorCode
  message: string
}

/**
 * 轻量适配层：完整复现旧错误处理系统的判定逻辑
 * 与旧 ErrorHandler.handleError + getUserFriendlyMessage 保持完全一致
 *
 * @param error 任意错误对象
 * @returns 分类后的错误代码和用户友好消息
 */
export function classifyAndFormatError(error: any): ClassifiedError {
  // 1. JWT 过期检测 (优先级最高)
  if (error?.message?.includes("JWT expired")) {
    return {
      code: "SESSION_EXPIRED",
      message: "您的登录已过期，请重新登录",
    }
  }

  // 2. JWT 无效检测
  if (error?.message?.includes("Invalid JWT")) {
    return {
      code: "INVALID_TOKEN",
      message: "登录信息无效，请重新登录",
    }
  }

  // 3. 权限错误检测
  if (error?.message?.includes("权限不足") || error?.status === 403) {
    return {
      code: "FORBIDDEN",
      message: "权限不足，无法执行此操作",
    }
  }

  // 4. 账户被封禁检测
  if (error?.message?.includes("账户已被封禁")) {
    return {
      code: "ACCOUNT_BANNED",
      message: "账户已被限制，请联系管理员",
    }
  }

  // 5. AuthErrorType 兼容 - 处理旧枚举值 (优先级高于状态码)
  if (error?.type) {
    return classifyByLegacyType(error.type, error.message)
  }

  // 6. 网络错误检测
  if (error?.name === "NetworkError" || error?.code === "NETWORK_ERROR") {
    return {
      code: "NETWORK_ERROR",
      message: "网络连接失败，请重试",
    }
  }

  // 7. 验证错误检测 (HTTP 400)
  if (error?.message?.includes("验证失败") || error?.status === 400) {
    return {
      code: "VALIDATION_ERROR",
      message: "输入信息有误，请检查后重试",
    }
  }

  // 8. 其他消息内容检测
  const message = error?.message || ""
  if (message.includes("会话已过期")) {
    return { code: "SESSION_EXPIRED", message: "您的登录已过期，请重新登录" }
  }
  // 支持中英文的令牌无效检测
  if (
    message.includes("认证令牌无效") ||
    message.toLowerCase().includes("invalid token") ||
    message.toLowerCase().includes("invalid refresh token") ||
    message.toLowerCase().includes("token has been revoked")
  ) {
    return { code: "INVALID_TOKEN", message: "登录信息无效，请重新登录" }
  }
  if (message.includes("用户名或密码错误")) {
    return { code: "INVALID_CREDENTIALS", message: "用户名或密码错误" }
  }

  // 9. 服务器错误检测 (HTTP 500+)
  if (error?.status >= 500) {
    return {
      code: "UNKNOWN_ERROR",
      message: "服务器错误，请稍后重试",
    }
  }

  // 10. 默认情况
  return {
    code: "UNKNOWN_ERROR",
    message: error?.message || "操作失败，请稍后重试",
  }
}

/**
 * 处理旧 AuthErrorType 枚举的兼容映射
 * @param type 旧错误类型字符串
 * @param originalMessage 原始错误消息
 * @returns 分类后的错误
 */
function classifyByLegacyType(type: string, originalMessage?: string): ClassifiedError {
  const legacyTypeMap: Record<string, string> = {
    SESSION_EXPIRED: "您的登录已过期，请重新登录",
    TOKEN_INVALID: "登录信息无效，请重新登录",
    INSUFFICIENT_PERMISSIONS: "权限不足，无法执行此操作",
    ACCOUNT_BANNED: "账户已被限制，请联系管理员",
    NETWORK_ERROR: "网络连接失败，请重试",
    VALIDATION_ERROR: "输入信息有误，请检查后重试",
    UNKNOWN_ERROR: "操作失败，请稍后重试",
    USER_NOT_FOUND: "用户不存在",
    INVALID_CREDENTIALS: "用户名或密码错误",
    EMAIL_ALREADY_REGISTERED: "邮箱已被注册",
    REGISTRATION_FAILED: "注册失败",
    GITHUB_AUTH_FAILED: "GitHub 登录失败",
  }

  const message = legacyTypeMap[type] || originalMessage || "操作失败，请稍后重试"

  // 映射到新的AuthErrorCode
  let code: AuthErrorCode
  switch (type) {
    case "SESSION_EXPIRED":
      code = "SESSION_EXPIRED"
      break
    case "TOKEN_INVALID":
      code = "INVALID_TOKEN"
      break
    case "INSUFFICIENT_PERMISSIONS":
      code = "FORBIDDEN"
      break
    case "ACCOUNT_BANNED":
      code = "ACCOUNT_BANNED"
      break
    case "INVALID_CREDENTIALS":
    case "USER_NOT_FOUND":
      code = "INVALID_CREDENTIALS"
      break
    case "NETWORK_ERROR":
      code = "NETWORK_ERROR"
      break
    case "VALIDATION_ERROR":
    case "EMAIL_ALREADY_REGISTERED":
    case "REGISTRATION_FAILED":
      code = "VALIDATION_ERROR"
      break
    case "GITHUB_AUTH_FAILED":
      code = "UNAUTHORIZED"
      break
    case "UNKNOWN_ERROR":
    default:
      code = "UNKNOWN_ERROR"
  }

  return { code, message }
}
