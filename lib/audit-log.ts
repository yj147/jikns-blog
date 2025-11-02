/**
 * 认证事件日志系统
 * 记录登录/登出事件、权限变更、异常操作等审计信息
 */

import { prisma } from "./prisma"
import { getCurrentUser } from "./auth"

/**
 * 审计事件类型
 */
export enum AuditEventType {
  // 认证相关事件
  USER_LOGIN = "USER_LOGIN",
  USER_LOGOUT = "USER_LOGOUT",
  LOGIN_FAILED = "LOGIN_FAILED",
  SESSION_EXPIRED = "SESSION_EXPIRED",

  // OAuth 相关事件
  OAUTH_LOGIN_START = "OAUTH_LOGIN_START",
  OAUTH_LOGIN_SUCCESS = "OAUTH_LOGIN_SUCCESS",
  OAUTH_LOGIN_FAILED = "OAUTH_LOGIN_FAILED",

  // 用户管理事件
  USER_REGISTERED = "USER_REGISTERED",
  USER_EMAIL_VERIFIED = "USER_EMAIL_VERIFIED",
  USER_PROFILE_UPDATED = "USER_PROFILE_UPDATED",
  PASSWORD_CHANGED = "PASSWORD_CHANGED",

  // 权限相关事件
  PERMISSION_GRANTED = "PERMISSION_GRANTED",
  PERMISSION_REVOKED = "PERMISSION_REVOKED",
  ROLE_CHANGED = "ROLE_CHANGED",
  ACCOUNT_BANNED = "ACCOUNT_BANNED",
  ACCOUNT_UNBANNED = "ACCOUNT_UNBANNED",

  // 异常操作事件
  UNAUTHORIZED_ACCESS = "UNAUTHORIZED_ACCESS",
  SUSPICIOUS_LOGIN = "SUSPICIOUS_LOGIN",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  BRUTE_FORCE_DETECTED = "BRUTE_FORCE_DETECTED",

  // 系统事件
  SYSTEM_ERROR = "SYSTEM_ERROR",
  DATA_EXPORT = "DATA_EXPORT",
  ADMIN_ACTION = "ADMIN_ACTION",
  RETRY_ATTEMPT = "RETRY_ATTEMPT",
}

/**
 * 审计日志条目接口
 */
export interface AuditLogEntry {
  id?: string
  eventType: AuditEventType
  userId?: string
  userEmail?: string
  ipAddress?: string
  userAgent?: string
  action: string
  resource?: string
  details?: Record<string, any>
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  timestamp: Date
  success: boolean
  errorMessage?: string
  sessionId?: string
  traceId?: string
}

/**
 * 错误日志条目接口
 */
export interface ErrorLogEntry {
  type: string
  message: string
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  context?: Record<string, any>
  timestamp: string
  traceId?: string
  userId?: string
}

/**
 * 审计日志记录器
 */
export class AuditLogger {
  private static instance: AuditLogger
  private logQueue: AuditLogEntry[] = []
  private isProcessing = false

  static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger()
    }
    return AuditLogger.instance
  }

  /**
   * 记录审计事件
   */
  async logEvent(params: {
    eventType?: AuditEventType
    action: string
    resource?: string
    details?: Record<string, any>
    success?: boolean
    errorMessage?: string
    severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
    userId?: string
    ipAddress?: string
    userAgent?: string
    sessionId?: string
    traceId?: string
  }): Promise<void> {
    try {
      // 获取当前用户信息
      let currentUser = null
      if (!params.userId) {
        try {
          currentUser = await getCurrentUser()
        } catch (error) {
          // 在某些情况下获取用户信息可能失败，这是正常的
        }
      }

      const logEntry: AuditLogEntry = {
        eventType: params.eventType || AuditEventType.ADMIN_ACTION,
        userId: params.userId || currentUser?.id,
        userEmail: currentUser?.email,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        action: params.action,
        resource: params.resource,
        details: params.details,
        severity: params.severity || "LOW",
        timestamp: new Date(),
        success: params.success ?? true,
        errorMessage: params.errorMessage,
        sessionId: params.sessionId,
        traceId: params.traceId,
      }

      // 添加到队列
      this.logQueue.push(logEntry)

      // 异步处理队列
      this.processQueue()
    } catch (error) {
      console.error("审计日志记录失败:", error)
    }
  }

  /**
   * 记录错误事件
   */
  async logError(error: ErrorLogEntry): Promise<void> {
    await this.logEvent({
      eventType: AuditEventType.SYSTEM_ERROR,
      action: "SYSTEM_ERROR",
      details: {
        errorType: error.type,
        errorMessage: error.message,
        context: error.context,
      },
      severity: error.severity,
      success: false,
      errorMessage: error.message,
      traceId: error.traceId,
      userId: error.userId,
    })
  }

  /**
   * 记录用户登录事件
   */
  async logUserLogin(params: {
    userId: string
    userEmail: string
    method: "EMAIL_PASSWORD" | "GITHUB_OAUTH"
    ipAddress?: string
    userAgent?: string
    success: boolean
    errorMessage?: string
  }): Promise<void> {
    await this.logEvent({
      eventType: params.success ? AuditEventType.USER_LOGIN : AuditEventType.LOGIN_FAILED,
      action: params.success ? "USER_LOGIN_SUCCESS" : "USER_LOGIN_FAILED",
      userId: params.userId,
      details: {
        loginMethod: params.method,
        userEmail: params.userEmail,
      },
      severity: params.success ? "LOW" : "MEDIUM",
      success: params.success,
      errorMessage: params.errorMessage,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    })
  }

  /**
   * 记录用户登出事件
   */
  async logUserLogout(params: {
    userId: string
    userEmail: string
    method: "MANUAL" | "SESSION_EXPIRED"
    ipAddress?: string
    userAgent?: string
  }): Promise<void> {
    await this.logEvent({
      eventType: AuditEventType.USER_LOGOUT,
      action: "USER_LOGOUT",
      userId: params.userId,
      details: {
        logoutMethod: params.method,
        userEmail: params.userEmail,
      },
      severity: "LOW",
      success: true,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    })
  }

  /**
   * 记录权限变更事件
   */
  async logPermissionChange(params: {
    targetUserId: string
    targetUserEmail: string
    action: "ROLE_CHANGED" | "ACCOUNT_BANNED" | "ACCOUNT_UNBANNED"
    oldValue?: string
    newValue?: string
    adminUserId?: string
  }): Promise<void> {
    await this.logEvent({
      eventType: params.action as AuditEventType,
      action: params.action,
      resource: `user:${params.targetUserId}`,
      details: {
        targetUserId: params.targetUserId,
        targetUserEmail: params.targetUserEmail,
        oldValue: params.oldValue,
        newValue: params.newValue,
        adminUserId: params.adminUserId,
      },
      severity: "HIGH",
      success: true,
      userId: params.adminUserId,
    })
  }

  /**
   * 记录未授权访问事件
   */
  async logUnauthorizedAccess(params: {
    resource: string
    userId?: string
    ipAddress?: string
    userAgent?: string
    attemptedAction?: string
  }): Promise<void> {
    await this.logEvent({
      eventType: AuditEventType.UNAUTHORIZED_ACCESS,
      action: "UNAUTHORIZED_ACCESS_ATTEMPT",
      resource: params.resource,
      details: {
        attemptedAction: params.attemptedAction,
        resource: params.resource,
      },
      severity: "MEDIUM",
      success: false,
      userId: params.userId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    })
  }

  /**
   * 记录可疑登录事件
   */
  async logSuspiciousLogin(params: {
    userId?: string
    userEmail?: string
    ipAddress?: string
    userAgent?: string
    reason: string
    details?: Record<string, any>
  }): Promise<void> {
    await this.logEvent({
      eventType: AuditEventType.SUSPICIOUS_LOGIN,
      action: "SUSPICIOUS_LOGIN_DETECTED",
      details: {
        reason: params.reason,
        suspiciousDetails: params.details,
        userEmail: params.userEmail,
      },
      severity: "HIGH",
      success: false,
      userId: params.userId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    })
  }

  /**
   * 处理日志队列
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.logQueue.length === 0) {
      return
    }

    this.isProcessing = true

    try {
      const batchSize = 10 // 批量处理以提高性能
      while (this.logQueue.length > 0) {
        const batch = this.logQueue.splice(0, batchSize)
        await this.writeBatchToDatabase(batch)
      }
    } catch (error) {
      console.error("审计日志批量写入失败:", error)
      // 将失败的日志重新加入队列（可选）
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * 批量写入数据库
   */
  private async writeBatchToDatabase(entries: AuditLogEntry[]): Promise<void> {
    try {
      // 注意：这里假设你已经在 Prisma schema 中定义了 AuditLog 模型
      // 如果没有，这个功能暂时会在内存中保存日志
      if (process.env.NODE_ENV === "development") {
        // 开发环境下只输出到控制台
        entries.forEach((entry) => {})
        return
      }

      // 生产环境写入数据库
      // 由于当前项目可能还没有 AuditLog 表，我们先将日志写入文件
      await this.writeToFile(entries)
    } catch (error) {
      console.error("审计日志数据库写入失败:", error)
      // 备用方案：写入文件
      await this.writeToFile(entries)
    }
  }

  /**
   * 写入文件备用方案
   */
  private async writeToFile(entries: AuditLogEntry[]): Promise<void> {
    try {
      const fs = await import("fs/promises")
      const path = await import("path")

      const logDir = path.join(process.cwd(), "logs")
      const logFile = path.join(logDir, `audit-${new Date().toISOString().split("T")[0]}.log`)

      // 确保日志目录存在
      await fs.mkdir(logDir, { recursive: true })

      // 写入日志
      const logLines = entries.map((entry) => JSON.stringify(entry)).join("\n") + "\n"
      await fs.appendFile(logFile, logLines, "utf8")
    } catch (error) {
      console.error("审计日志文件写入失败:", error)
    }
  }

  /**
   * 查询审计日志
   */
  async queryLogs(params: {
    userId?: string
    eventType?: AuditEventType
    startDate?: Date
    endDate?: Date
    severity?: string
    limit?: number
    offset?: number
  }): Promise<AuditLogEntry[]> {
    try {
      // 这里应该从数据库查询，目前返回空数组
      // 在实际实现中，需要根据 Prisma schema 中的 AuditLog 模型进行查询
      return []
    } catch (error) {
      console.error("查询审计日志失败:", error)
      return []
    }
  }

  /**
   * 获取用户活动统计
   */
  async getUserActivityStats(
    userId: string,
    days: number = 30
  ): Promise<{
    totalEvents: number
    loginCount: number
    lastLogin: Date | null
    failedLogins: number
    suspiciousActivities: number
  }> {
    try {
      // 这里应该从数据库统计，目前返回模拟数据
      return {
        totalEvents: 0,
        loginCount: 0,
        lastLogin: null,
        failedLogins: 0,
        suspiciousActivities: 0,
      }
    } catch (error) {
      console.error("获取用户活动统计失败:", error)
      return {
        totalEvents: 0,
        loginCount: 0,
        lastLogin: null,
        failedLogins: 0,
        suspiciousActivities: 0,
      }
    }
  }

  /**
   * 清理旧日志（用于定期清理）
   */
  async cleanupOldLogs(daysToKeep: number = 90): Promise<void> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
      // 这里应该删除数据库中的旧记录
      // 同时清理文件日志
    } catch (error) {
      console.error("清理旧审计日志失败:", error)
    }
  }
}

// 导出单例实例
export const auditLogger = AuditLogger.getInstance()

/**
 * 审计日志装饰器 - 用于自动记录函数调用
 */
export function withAuditLog(
  eventType: AuditEventType,
  action: string,
  getDetails?: (args: any[], result: any) => Record<string, any>
) {
  return function <T extends any[], R>(
    target: any,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<(...args: T) => Promise<R>>
  ) {
    const method = descriptor.value!

    descriptor.value = async function (...args: T): Promise<R> {
      let result: R
      let success = true
      let errorMessage: string | undefined

      try {
        result = await method.apply(this, args)
        return result
      } catch (error) {
        success = false
        errorMessage = error instanceof Error ? error.message : String(error)
        throw error
      } finally {
        // 记录审计日志
        await auditLogger.logEvent({
          eventType,
          action,
          details: getDetails ? getDetails(args, result!) : undefined,
          success,
          errorMessage,
        })
      }
    }
  }
}

/**
 * 获取客户端 IP 地址
 */
export function getClientIP(request: Request): string | undefined {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-client-ip") ||
    undefined
  )
}

/**
 * 获取客户端 User Agent
 */
export function getClientUserAgent(request: Request): string | undefined {
  return request.headers.get("user-agent") || undefined
}
