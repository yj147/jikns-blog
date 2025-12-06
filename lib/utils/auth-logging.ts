/**
 * 认证日志辅助工具
 * 统一认证系统的日志格式和字段标准
 */

import { NextRequest } from "next/server"
import { getClientIp } from "@/lib/api/get-client-ip"
import { authLogger } from "./logger"

/**
 * 认证上下文接口
 * 标准化的四字段结构：{requestId, path, ip, userId}
 */
interface AuthContext {
  requestId?: string
  path?: string
  ip?: string
  userId?: string
}

/**
 * 额外字段接口
 */
interface ExtraFields {
  [key: string]: any
}

/**
 * 统一认证日志事件记录函数
 *
 * @param level 日志级别
 * @param message 日志消息
 * @param context 认证上下文（包含四个基础字段）
 * @param extra 额外字段
 */
export function logAuthEvent(
  level: "info" | "warn" | "error",
  message: string,
  context?: AuthContext | null,
  extra: ExtraFields = {}
): void {
  const safeContext = context || {}

  const logData = {
    requestId: safeContext.requestId || "unknown",
    path: safeContext.path || "unknown",
    ip: safeContext.ip || "unknown",
    userId: safeContext.userId || undefined,
    timestamp: new Date().toISOString(),
    ...extra,
  }

  authLogger[level](message, logData)
}

/**
 * 便捷日志函数
 */
export const authLog = {
  info: (message: string, context: AuthContext, extra?: ExtraFields) =>
    logAuthEvent("info", message, context, extra),

  warn: (message: string, context: AuthContext, extra?: ExtraFields) =>
    logAuthEvent("warn", message, context, extra),

  error: (message: string, context: AuthContext, extra?: ExtraFields) =>
    logAuthEvent("error", message, context, extra),
}

/**
 * 从NextRequest提取认证上下文的辅助函数
 *
 * @param request NextRequest对象
 * @param requestId 请求ID
 * @param userId 用户ID（可选）
 * @returns 标准化的认证上下文
 */
export function extractAuthContext(
  request?: NextRequest,
  requestId?: string,
  userId?: string
): AuthContext {
  if (!request) {
    return {
      requestId: requestId || "unknown",
      userId,
    }
  }

  return {
    requestId: requestId || "unknown",
    path: request.nextUrl.pathname,
    ip: getClientIp(request),
    userId,
  }
}

/**
 * 认证成功日志
 */
export function logAuthSuccess(policy: string, context: AuthContext, extra?: ExtraFields) {
  authLog.info(`认证成功 - ${policy} 策略`, context, extra)
}

/**
 * 认证失败日志
 */
export function logAuthFailure(
  policy: string,
  context: AuthContext,
  error: string | Error,
  extra?: ExtraFields
) {
  const errorMessage = error instanceof Error ? error.message : error
  authLog.warn(`认证失败 - ${policy} 策略`, context, {
    error: errorMessage,
    ...extra,
  })
}

/**
 * OAuth认证事件日志
 */
export function logOAuthEvent(
  event: "callback_start" | "callback_success" | "callback_error" | "profile_sync",
  context: AuthContext,
  extra?: ExtraFields
) {
  authLog.info(`OAuth事件 - ${event}`, context, extra)
}

/**
 * 审计日志事件
 */
export function logAuditEvent(
  action: string,
  resource: string,
  context: AuthContext,
  extra?: ExtraFields
) {
  authLog.info("审计日志", context, {
    action,
    resource,
    ...extra,
  })
}

/**
 * 权限检查日志
 */
export function logPermissionCheck(
  result: "granted" | "denied",
  permission: string,
  context: AuthContext,
  extra?: ExtraFields
) {
  const level = result === "granted" ? "info" : "warn"
  authLog[level](`权限检查 - ${result}`, context, {
    permission,
    result,
    ...extra,
  })
}

/**
 * 会话事件日志
 */
export function logSessionEvent(
  event: "created" | "expired" | "refreshed" | "invalidated",
  context: AuthContext,
  extra?: ExtraFields
) {
  authLog.info(`会话事件 - ${event}`, context, extra)
}

/**
 * 为 session.ts 内部函数构建日志上下文
 * 当没有完整的请求对象时使用
 *
 * @param userId 用户ID（可选）
 * @param extra 额外的上下文信息
 * @returns 标准化的认证上下文
 */
export function buildSessionLogContext(
  userId?: string,
  extra?: { requestId?: string; path?: string; ip?: string }
): AuthContext {
  return {
    requestId: extra?.requestId || "session-internal",
    path: extra?.path || "internal-function",
    ip: extra?.ip || "unknown",
    userId,
  }
}
