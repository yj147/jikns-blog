/**
 * 错误日志记录器 - 前端错误日志收集和上报
 * Phase 5: 前端错误处理与用户体验优化
 */

import { AppError, ErrorContext } from "@/types/error"

interface LogOptions {
  console?: boolean
  server?: boolean
  includeStackTrace?: boolean
  metadata?: Record<string, any>
}

interface LogEntry {
  id: string
  error: AppError
  environment: string
  userAgent: string
  url: string
  timestamp: number
  metadata?: Record<string, any>
}

class ErrorLogger {
  private logQueue: LogEntry[] = []
  private isOnline: boolean = typeof navigator !== "undefined" ? navigator.onLine : true
  private maxQueueSize = 100
  private batchSize = 10
  private flushInterval = 30000 // 30秒
  private retryInterval = 60000 // 1分钟
  private flushTimer?: NodeJS.Timeout
  private retryTimer?: NodeJS.Timeout

  constructor() {
    this.initializeNetworkListeners()
    this.startPeriodicFlush()
  }

  /**
   * 记录错误
   */
  async log(error: AppError, options: LogOptions = {}): Promise<void> {
    const logEntry: LogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      error,
      environment: process.env.NODE_ENV || "unknown",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      url: typeof window !== "undefined" ? window.location.href : "",
      timestamp: Date.now(),
      metadata: options.metadata,
    }

    // 控制台日志
    if (options.console) {
      this.logToConsole(logEntry, options.includeStackTrace)
    }

    // 服务器日志
    if (options.server) {
      this.queueForServer(logEntry)
    }
  }

  /**
   * 批量记录错误
   */
  async logBatch(errors: AppError[], options: LogOptions = {}): Promise<void> {
    const promises = errors.map((error) => this.log(error, options))
    await Promise.all(promises)
  }

  /**
   * 强制刷新日志队列到服务器
   */
  async flush(): Promise<void> {
    if (this.logQueue.length === 0) {
      return
    }

    const batch = this.logQueue.splice(0, this.batchSize)

    try {
      await this.sendLogsToServer(batch)
    } catch (error) {
      // 如果发送失败，将日志重新放回队列
      this.logQueue.unshift(...batch)
      console.warn("日志上传失败，将在稍后重试:", error)
      this.scheduleRetry()
    }
  }

  /**
   * 获取当前日志队列状态
   */
  getQueueStats(): {
    queueSize: number
    isOnline: boolean
    nextFlush?: number
    nextRetry?: number
  } {
    return {
      queueSize: this.logQueue.length,
      isOnline: this.isOnline,
      nextFlush: this.flushTimer ? Date.now() + this.flushInterval : undefined,
      nextRetry: this.retryTimer ? Date.now() + this.retryInterval : undefined,
    }
  }

  /**
   * 清空日志队列
   */
  clearQueue(): void {
    this.logQueue = []
  }

  /**
   * 销毁日志记录器
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
    }
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
    }
    this.clearQueue()
  }

  /**
   * 记录到控制台
   */
  private logToConsole(logEntry: LogEntry, includeStackTrace?: boolean): void {
    const { error } = logEntry
    const prefix = `[错误日志] ${new Date().toISOString()}`

    switch (error.severity) {
      case "critical":
        console.error(prefix, error.userMessage, error)
        break
      case "high":
        console.error(prefix, error.userMessage, error)
        break
      case "medium":
        console.warn(prefix, error.userMessage, error)
        break
      case "low":
        break
      default:
    }

    // 输出详细信息（仅在开发环境）
    if (includeStackTrace && process.env.NODE_ENV === "development") {
      console.group("错误详情:")
      if (error.details) {
      }
      if (error.stackTrace) {
      }
      console.groupEnd()
    }
  }

  /**
   * 加入服务器日志队列
   */
  private queueForServer(logEntry: LogEntry): void {
    // 防止队列过大
    if (this.logQueue.length >= this.maxQueueSize) {
      // 移除最早的日志
      this.logQueue.shift()
    }

    this.logQueue.push(logEntry)

    // 如果网络可用且队列达到批处理大小，立即刷新
    if (this.isOnline && this.logQueue.length >= this.batchSize) {
      this.flush()
    }
  }

  /**
   * 发送日志到服务器
   */
  private async sendLogsToServer(logs: LogEntry[]): Promise<void> {
    if (!this.isOnline || logs.length === 0) {
      throw new Error("网络不可用或无日志需要发送")
    }

    const payload = {
      logs,
      metadata: {
        timestamp: Date.now(),
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
        url: typeof window !== "undefined" ? window.location.href : "",
        environment: process.env.NODE_ENV,
      },
    }

    const response = await fetch("/api/logs/errors", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`日志上传失败: ${response.status} ${response.statusText}`)
    }
  }

  /**
   * 初始化网络状态监听
   */
  private initializeNetworkListeners(): void {
    if (typeof window === "undefined") {
      return
    }

    // 监听网络状态变化
    window.addEventListener("online", () => {
      this.isOnline = true
      // 网络恢复后立即刷新队列
      this.flush()
    })

    window.addEventListener("offline", () => {
      this.isOnline = false
    })
  }

  /**
   * 启动定期刷新
   */
  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flush()
    }, this.flushInterval)
  }

  /**
   * 安排重试
   */
  private scheduleRetry(): void {
    if (this.retryTimer) {
      return // 已经安排了重试
    }

    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined
      this.flush()
    }, this.retryInterval)
  }
}

export default ErrorLogger
