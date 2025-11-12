/**
 * 认证错误处理工具
 * 处理 Supabase 认证相关的错误，特别是刷新令牌错误
 */

import { logger } from "@/lib/utils/logger"
import { AuthError } from "@supabase/supabase-js"

export interface AuthErrorInfo {
  code: string
  message: string
  shouldClearSession: boolean
  shouldRedirectToLogin: boolean
}

/**
 * 解析认证错误并返回处理建议
 *
 * ⚠️ Linus "实用主义"原则的权衡：
 * Supabase AuthError 不提供可靠的 code/status 字段，只能依赖 message 匹配
 * 这是 Supabase SDK 的限制，不是设计缺陷
 * 使用 includes() 而非精确匹配，提高容错性
 */
export function parseAuthError(error: unknown): AuthErrorInfo {
  // 如果不是 AuthError，返回通用错误信息
  if (!(error instanceof AuthError)) {
    return {
      code: "UNKNOWN_ERROR",
      message: "认证系统异常",
      shouldClearSession: false,
      shouldRedirectToLogin: false,
    }
  }

  const message = error.message.toLowerCase()

  // ✅ 使用 includes() 提高容错性，避免 Supabase 改文案导致失效
  // Refresh Token Not Found
  if (message.includes("refresh token not found") || message.includes("refresh_token_not_found")) {
    return {
      code: "REFRESH_TOKEN_NOT_FOUND",
      message: "登录状态已过期，请重新登录",
      shouldClearSession: true,
      shouldRedirectToLogin: true,
    }
  }

  // Refresh Token Expired
  if (message.includes("refresh token expired") || message.includes("refresh_token_expired")) {
    return {
      code: "REFRESH_TOKEN_EXPIRED",
      message: "登录状态已过期，请重新登录",
      shouldClearSession: true,
      shouldRedirectToLogin: true,
    }
  }

  // Invalid Refresh Token
  if (message.includes("invalid refresh token") || message.includes("invalid_refresh_token")) {
    return {
      code: "INVALID_REFRESH_TOKEN",
      message: "登录信息无效，请重新登录",
      shouldClearSession: true,
      shouldRedirectToLogin: true,
    }
  }

  // Session Not Found
  if (message.includes("session not found") || message.includes("session_not_found")) {
    return {
      code: "SESSION_NOT_FOUND",
      message: "未找到登录会话",
      shouldClearSession: true,
      shouldRedirectToLogin: false,
    }
  }

  // ✅ 兜底逻辑：记录未识别的错误类型，便于后续维护
  logger.warn("未识别的认证错误类型", {
    message: error.message,
    name: error.name,
  })

  return {
    code: "AUTH_ERROR",
    message: error.message || "认证错误",
    shouldClearSession: false,
    shouldRedirectToLogin: false,
  }
}

/**
 * 清除本地存储的认证信息
 */
export function clearLocalAuthData(): void {
  try {
    // 清除 Supabase 相关的 localStorage 数据
    const keysToRemove = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith("supabase.auth.")) {
        keysToRemove.push(key)
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key))

    logger.info("已清除本地认证数据")
  } catch (error) {
    logger.error("清除本地认证数据失败:", error as Error)
  }
}

/**
 * 处理认证错误的通用函数
 */
export async function handleAuthError(
  error: unknown,
  options: {
    onClearSession?: () => Promise<void>
    onRedirectToLogin?: () => void
    showToast?: (message: string) => void
  } = {}
): Promise<void> {
  const errorInfo = parseAuthError(error)

  logger.warn("认证错误:", {
    code: errorInfo.code,
    message: errorInfo.message,
    originalError: error,
  })

  // 显示用户友好的错误消息
  if (options.showToast) {
    options.showToast(errorInfo.message)
  }

  // 清除会话数据
  if (errorInfo.shouldClearSession) {
    clearLocalAuthData()

    if (options.onClearSession) {
      try {
        await options.onClearSession()
      } catch (clearError) {
        logger.error("清除会话失败:", clearError as Error)
      }
    }
  }

  // 重定向到登录页
  if (errorInfo.shouldRedirectToLogin && options.onRedirectToLogin) {
    // 延迟一点时间确保清理操作完成
    setTimeout(() => {
      options.onRedirectToLogin?.()
    }, 100)
  }
}

/**
 * 检查错误是否为刷新令牌相关错误
 *
 * ✅ Linus "Simplicity" 原则：统一大小写处理，与 parseSupabaseAuthError 保持一致
 */
export function isRefreshTokenError(error: unknown): boolean {
  if (!(error instanceof AuthError)) {
    return false
  }

  const message = error.message.toLowerCase() // ✅ 统一小写
  const refreshTokenErrors = [
    "invalid refresh token: refresh token not found", // ✅ 全部小写
    "refresh_token_not_found",
    "refresh_token_expired",
    "invalid_refresh_token",
  ]

  return refreshTokenErrors.some((errorMsg) => message.includes(errorMsg))
}

/**
 * 安全地执行可能触发认证错误的操作
 */
export async function safeAuthOperation<T>(
  operation: () => Promise<T>,
  errorHandler?: (error: unknown) => void
): Promise<T | null> {
  try {
    return await operation()
  } catch (error) {
    if (isRefreshTokenError(error)) {
      logger.warn("刷新令牌错误，跳过操作:", error as Error)
      if (errorHandler) {
        errorHandler(error)
      }
      return null
    }
    throw error // 重新抛出非刷新令牌错误
  }
}
