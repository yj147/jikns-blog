/**
 * 错误监控增强模块
 * RFC Phase 1: 支持新增错误码的监控和报警
 */

import { logger } from "@/lib/utils/logger"
import { AuthErrorCode } from "@/lib/error-handling/auth-error"
import { ErrorCode } from "@/lib/api/unified-response"

/**
 * 错误监控指标
 */
export interface ErrorMetric {
  code: AuthErrorCode | ErrorCode | string
  count: number
  lastOccurrence: Date
  contexts: Array<{
    timestamp: Date
    requestId?: string
    path?: string
    userId?: string
    ip?: string
    message?: string
  }>
}

/**
 * 报警规则配置
 */
export interface AlertRule {
  errorCode: string
  threshold: number // 触发报警的阈值
  timeWindow: number // 时间窗口（毫秒）
  severity: "low" | "medium" | "high" | "critical"
  action: "log" | "alert" | "page" // 报警动作
}

/**
 * 错误监控器增强版
 */
export class EnhancedErrorMonitor {
  private static instance: EnhancedErrorMonitor
  private errorMetrics: Map<string, ErrorMetric> = new Map()
  private alertRules: Map<string, AlertRule> = new Map()

  constructor() {
    this.initializeAlertRules()
  }

  static getInstance(): EnhancedErrorMonitor {
    if (!EnhancedErrorMonitor.instance) {
      EnhancedErrorMonitor.instance = new EnhancedErrorMonitor()
    }
    return EnhancedErrorMonitor.instance
  }

  /**
   * 初始化报警规则
   */
  private initializeAlertRules() {
    // 新增错误码的报警规则
    const rules: AlertRule[] = [
      {
        errorCode: "NETWORK_ERROR",
        threshold: 10,
        timeWindow: 60000, // 1分钟内10次
        severity: "high",
        action: "alert",
      },
      {
        errorCode: "VALIDATION_ERROR",
        threshold: 50,
        timeWindow: 300000, // 5分钟内50次
        severity: "medium",
        action: "log",
      },
      {
        errorCode: "UNKNOWN_ERROR",
        threshold: 5,
        timeWindow: 60000, // 1分钟内5次
        severity: "critical",
        action: "page",
      },
      {
        errorCode: "SESSION_EXPIRED",
        threshold: 20,
        timeWindow: 300000, // 5分钟内20次
        severity: "low",
        action: "log",
      },
      {
        errorCode: "INVALID_TOKEN",
        threshold: 15,
        timeWindow: 180000, // 3分钟内15次
        severity: "medium",
        action: "alert",
      },
      {
        errorCode: "ACCOUNT_BANNED",
        threshold: 5,
        timeWindow: 60000, // 1分钟内5次
        severity: "high",
        action: "alert",
      },
      {
        errorCode: "INVALID_CREDENTIALS",
        threshold: 10,
        timeWindow: 60000, // 1分钟内10次（可能是暴力破解）
        severity: "critical",
        action: "page",
      },
      // 保留旧错误码规则
      {
        errorCode: "UNAUTHORIZED",
        threshold: 30,
        timeWindow: 300000,
        severity: "low",
        action: "log",
      },
      {
        errorCode: "FORBIDDEN",
        threshold: 20,
        timeWindow: 300000,
        severity: "medium",
        action: "log",
      },
    ]

    rules.forEach((rule) => {
      this.alertRules.set(rule.errorCode, rule)
    })
  }

  /**
   * 记录错误
   */
  recordError(
    code: AuthErrorCode | ErrorCode | string,
    context?: {
      requestId?: string
      path?: string
      userId?: string
      ip?: string
      message?: string
    }
  ) {
    const now = new Date()

    // 获取或创建错误指标
    let metric = this.errorMetrics.get(code)
    if (!metric) {
      metric = {
        code,
        count: 0,
        lastOccurrence: now,
        contexts: [],
      }
      this.errorMetrics.set(code, metric)
    }

    // 更新指标
    metric.count++
    metric.lastOccurrence = now
    metric.contexts.push({
      timestamp: now,
      ...context,
    })

    // 保留最近100条上下文记录
    if (metric.contexts.length > 100) {
      metric.contexts = metric.contexts.slice(-100)
    }

    // 检查报警规则
    this.checkAlertRule(code, metric)

    // 记录到日志
    logger.warn("错误监控记录", {
      code,
      count: metric.count,
      ...context,
    })
  }

  /**
   * 检查报警规则
   */
  private checkAlertRule(code: string, metric: ErrorMetric) {
    const rule = this.alertRules.get(code)
    if (!rule) return

    const now = Date.now()
    const windowStart = now - rule.timeWindow

    // 计算时间窗口内的错误次数
    const recentErrors = metric.contexts.filter(
      (ctx) => ctx.timestamp.getTime() >= windowStart
    ).length

    if (recentErrors >= rule.threshold) {
      this.triggerAlert(rule, metric, recentErrors)
    }
  }

  /**
   * 触发报警
   */
  private triggerAlert(rule: AlertRule, metric: ErrorMetric, count: number) {
    const alertData = {
      errorCode: rule.errorCode,
      severity: rule.severity,
      count,
      threshold: rule.threshold,
      timeWindow: rule.timeWindow,
      lastOccurrence: metric.lastOccurrence,
      message: `错误 ${rule.errorCode} 在 ${rule.timeWindow / 1000}秒内发生了 ${count} 次，超过阈值 ${rule.threshold}`,
    }

    switch (rule.action) {
      case "log":
        logger.warn("错误阈值预警", alertData)
        break
      case "alert":
        logger.error("错误阈值报警", alertData)
        // 这里可以集成外部报警系统（如 Slack、邮件等）
        this.sendAlert(alertData)
        break
      case "page":
        logger.error("错误阈值严重报警（需要立即处理）", alertData)
        // 这里可以触发电话/短信报警
        this.sendCriticalAlert(alertData)
        break
    }
  }

  /**
   * 发送普通报警
   */
  private sendAlert(alertData: any) {
    // TODO: 集成外部报警系统
    // 例如：发送到 Slack、发送邮件等
    logger.info("报警已发送", alertData)
  }

  /**
   * 发送严重报警
   */
  private sendCriticalAlert(alertData: any) {
    // TODO: 集成紧急报警系统
    // 例如：发送短信、打电话等
    logger.error("紧急报警已触发", alertData)
  }

  /**
   * 获取错误统计
   */
  getErrorStats(timeWindow?: number): Record<string, any> {
    const stats: Record<string, any> = {}
    const now = Date.now()
    const windowStart = timeWindow ? now - timeWindow : 0

    this.errorMetrics.forEach((metric, code) => {
      const recentErrors = timeWindow
        ? metric.contexts.filter((ctx) => ctx.timestamp.getTime() >= windowStart).length
        : metric.count

      stats[code] = {
        totalCount: metric.count,
        recentCount: recentErrors,
        lastOccurrence: metric.lastOccurrence,
        rule: this.alertRules.get(code),
      }
    })

    return stats
  }

  /**
   * 获取特定错误码的详细信息
   */
  getErrorDetails(code: string): ErrorMetric | undefined {
    return this.errorMetrics.get(code)
  }

  /**
   * 清理旧的错误记录
   */
  cleanupOldMetrics(olderThan: number) {
    const cutoff = Date.now() - olderThan

    this.errorMetrics.forEach((metric, code) => {
      // 过滤掉旧的上下文
      metric.contexts = metric.contexts.filter((ctx) => ctx.timestamp.getTime() >= cutoff)

      // 重新计算计数
      metric.count = metric.contexts.length

      // 如果没有最近的错误，删除该指标
      if (metric.contexts.length === 0) {
        this.errorMetrics.delete(code)
      }
    })
  }

  /**
   * 导出监控数据（用于仪表盘）
   */
  exportMetrics() {
    const metrics: any[] = []

    this.errorMetrics.forEach((metric) => {
      metrics.push({
        code: metric.code,
        count: metric.count,
        lastOccurrence: metric.lastOccurrence.toISOString(),
        recentContexts: metric.contexts.slice(-10), // 最近10条
      })
    })

    return {
      timestamp: new Date().toISOString(),
      totalErrors: metrics.reduce((sum, m) => sum + m.count, 0),
      uniqueErrorCodes: metrics.length,
      metrics,
      alertRules: Array.from(this.alertRules.values()),
    }
  }

  /**
   * 重置所有指标（用于测试）
   */
  resetMetrics() {
    this.errorMetrics.clear()
  }

  /**
   * 更新报警规则
   */
  updateAlertRule(rule: AlertRule) {
    this.alertRules.set(rule.errorCode, rule)
  }

  /**
   * 获取所有报警规则
   */
  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values())
  }
}

// 导出单例实例
export const enhancedErrorMonitor = EnhancedErrorMonitor.getInstance()
