/**
 * 结构化日志工具
 * 替换项目中的console.log，提供更好的日志管理和分析能力
 */

/* eslint-disable no-console */

// 日志级别定义
export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal"

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: Record<string, any>
  userId?: string
  requestId?: string
  module?: string
  operation?: string // 操作类型
  actor?: string // 执行者
  target?: string // 目标对象
  status?: string // 操作状态
  duration?: number
  error?: {
    name: string
    message: string
    stack?: string
  }
}

// 日志配置
interface LoggerConfig {
  level: LogLevel
  enableConsole: boolean
  enableFile: boolean
  enableRemote: boolean
  format: "json" | "pretty"
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
}

class Logger {
  private config: LoggerConfig
  private context: Record<string, any> = {}

  constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      level: (process.env.LOG_LEVEL as LogLevel) || "info",
      enableConsole: process.env.NODE_ENV !== "production",
      enableFile: false, // 暂时禁用文件日志
      enableRemote: process.env.NODE_ENV === "production",
      format: process.env.NODE_ENV === "production" ? "json" : "pretty",
      ...config,
    }
  }

  // 设置全局上下文
  setContext(context: Record<string, any>) {
    this.context = { ...this.context, ...context }
  }

  // 清除上下文
  clearContext() {
    this.context = {}
  }

  // 创建子logger
  child(childContext: Record<string, any>): Logger {
    const childLogger = new Logger(this.config)
    childLogger.context = { ...this.context, ...childContext }
    return childLogger
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level]
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { ...this.context, ...context },
    }

    // 添加请求ID（如果在请求上下文中）
    if (typeof window === "undefined" && (global as any).requestId) {
      entry.requestId = (global as any).requestId
    }

    // 添加错误信息
    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
    }

    return entry
  }

  private formatMessage(entry: LogEntry): string {
    if (this.config.format === "json") {
      return JSON.stringify(entry)
    }

    // Pretty format for development
    const timestamp = entry.timestamp.substring(11, 19)
    const level = entry.level.toUpperCase().padEnd(5)
    let formatted = `[${timestamp}] ${level} ${entry.message}`

    if (entry.context && Object.keys(entry.context).length > 0) {
      formatted += ` ${JSON.stringify(entry.context)}`
    }

    if (entry.error) {
      formatted += `\n  Error: ${entry.error.message}`
      if (entry.error.stack) {
        formatted += `\n  Stack: ${entry.error.stack.split("\n").slice(0, 5).join("\n    ")}`
      }
    }

    return formatted
  }

  private output(entry: LogEntry) {
    if (!this.shouldLog(entry.level)) return

    const message = this.formatMessage(entry)

    // Console output
    if (this.config.enableConsole) {
      switch (entry.level) {
        case "debug":
          console.debug(message)
          break
        case "info":
          console.info(message)
          break
        case "warn":
          console.warn(message)
          break
        case "error":
        case "fatal":
          console.error(message)
          break
      }
    }

    // Remote logging (如果配置了)
    if (this.config.enableRemote && entry.level !== "debug") {
      this.sendToRemote(entry).catch((error) => {
        console.error("Failed to send log to remote:", error)
      })
    }
  }

  private async sendToRemote(entry: LogEntry): Promise<void> {
    try {
      // 在实际项目中，这里应该发送到日志服务
      // 例如: Sentry, Winston, 或者自定义的日志API
      if (typeof window !== "undefined") {
        // 浏览器端 - 发送到API
        await fetch("/api/logs/client", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entry),
        })
      }
    } catch (error) {
      // 静默失败，避免日志发送错误影响主要功能
    }
  }

  // 基础日志方法
  debug(message: string, context?: Record<string, any>) {
    const entry = this.createLogEntry("debug", message, context)
    this.output(entry)
  }

  info(message: string, context?: Record<string, any>) {
    const entry = this.createLogEntry("info", message, context)
    this.output(entry)
  }

  warn(message: string, context?: Record<string, any>) {
    const entry = this.createLogEntry("warn", message, context)
    this.output(entry)
  }

  // 错误日志方法 - 增强版，支持 unknown 类型
  error(
    message: string,
    contextOrError?: Record<string, any> | unknown,
    errorOrUndefined?: Error | unknown
  ) {
    let context: Record<string, any> | undefined
    let error: Error | undefined

    // 处理重载参数
    if (contextOrError instanceof Error) {
      // error(message, Error)
      error = contextOrError
      context = undefined
    } else if (errorOrUndefined !== undefined) {
      // error(message, context, Error | unknown)
      context = contextOrError as Record<string, any>
      error = this.normalizeError(errorOrUndefined)
    } else if (
      contextOrError !== undefined &&
      typeof contextOrError === "object" &&
      contextOrError !== null
    ) {
      // 可能是 context 或 unknown 错误
      if ("stack" in contextOrError || "message" in contextOrError) {
        // 看起来像是错误对象
        error = this.normalizeError(contextOrError)
      } else {
        // 是 context
        context = contextOrError as Record<string, any>
      }
    } else if (contextOrError !== undefined) {
      // 其他 unknown 类型
      error = this.normalizeError(contextOrError)
    }

    const entry = this.createLogEntry("error", message, context, error)
    this.output(entry)
  }

  fatal(
    message: string,
    contextOrError?: Record<string, any> | unknown,
    errorOrUndefined?: Error | unknown
  ) {
    let context: Record<string, any> | undefined
    let error: Error | undefined

    // 同样的参数处理逻辑
    if (contextOrError instanceof Error) {
      error = contextOrError
      context = undefined
    } else if (errorOrUndefined !== undefined) {
      context = contextOrError as Record<string, any>
      error = this.normalizeError(errorOrUndefined)
    } else if (
      contextOrError !== undefined &&
      typeof contextOrError === "object" &&
      contextOrError !== null
    ) {
      if ("stack" in contextOrError || "message" in contextOrError) {
        error = this.normalizeError(contextOrError)
      } else {
        context = contextOrError as Record<string, any>
      }
    } else if (contextOrError !== undefined) {
      error = this.normalizeError(contextOrError)
    }

    const entry = this.createLogEntry("fatal", message, context, error)
    this.output(entry)
  }

  // 将 unknown 类型转换为 Error 对象
  private normalizeError(err: unknown): Error {
    if (err instanceof Error) {
      return err
    }

    if (typeof err === "string") {
      return new Error(err)
    }

    if (typeof err === "object" && err !== null) {
      // 尝试提取 message 属性
      if ("message" in err) {
        const error = new Error(String((err as any).message))
        if ("name" in err) {
          error.name = String((err as any).name)
        }
        if ("stack" in err) {
          error.stack = String((err as any).stack)
        }
        return error
      }

      // 如果没有 message，尝试序列化对象
      try {
        return new Error(JSON.stringify(err))
      } catch {
        return new Error(String(err))
      }
    }

    // 其他类型，转换为字符串
    return new Error(String(err))
  }

  // 性能监测
  time(label: string): () => void {
    const start = performance.now()
    return () => {
      const duration = performance.now() - start
      this.info(`Timer: ${label}`, { duration: `${duration.toFixed(2)}ms` })
    }
  }

  // HTTP请求日志
  http(
    method: string,
    url: string,
    status: number,
    duration: number,
    context?: Record<string, any>
  ) {
    const level = status >= 400 ? "error" : status >= 300 ? "warn" : "info"
    this[level](`${method} ${url} ${status}`, {
      method,
      url,
      status,
      duration: `${duration.toFixed(2)}ms`,
      ...context,
    })
  }

  // 认证相关日志
  auth(action: string, userId?: string, success: boolean = true, context?: Record<string, any>) {
    const level = success ? "info" : "warn"
    this[level](`Auth: ${action}`, {
      userId,
      success,
      action,
      ...context,
    })
  }

  // 数据库操作日志
  db(operation: string, table: string, duration: number, context?: Record<string, any>) {
    this.debug(`DB: ${operation} on ${table}`, {
      operation,
      table,
      duration: `${duration.toFixed(2)}ms`,
      ...context,
    })
  }

  // 安全事件日志
  security(
    event: string,
    severity: "low" | "medium" | "high" | "critical",
    context?: Record<string, any>
  ) {
    const level = severity === "critical" ? "fatal" : severity === "high" ? "error" : "warn"
    this[level](`Security: ${event}`, {
      event,
      severity,
      ...context,
    })
  }
}

// 默认logger实例
export const logger = new Logger()

// 创建专用logger
export const createLogger = (module: string) => {
  return logger.child({ module })
}

// 中间件logger
export const middlewareLogger = createLogger("middleware")

// API logger
export const apiLogger = createLogger("api")

// 认证logger
export const authLogger = createLogger("auth")

// 数据库logger
export const dbLogger = createLogger("database")

// 安全logger
export const securityLogger = createLogger("security")

// 评论logger
export const commentsLogger = createLogger("comments")

// 评论操作日志辅助函数
export function logCommentOperation(
  operation: string,
  actor: string | undefined,
  target: string,
  status: "success" | "failure",
  duration: number,
  context?: Record<string, any>
) {
  const entry: Partial<LogEntry> = {
    operation,
    actor: actor || "anonymous",
    target,
    status,
    duration,
  }

  const level = status === "failure" ? "error" : "info"
  commentsLogger[level](`Comment ${operation}: ${status}`, {
    ...entry,
    ...context,
  })
}

// 兼容性函数 - 用于替换现有的console.log
export const log = {
  debug: (message: string, ...args: any[]) => {
    logger.debug(message, args.length > 0 ? { args } : undefined)
  },
  info: (message: string, ...args: any[]) => {
    logger.info(message, args.length > 0 ? { args } : undefined)
  },
  warn: (message: string, ...args: any[]) => {
    logger.warn(message, args.length > 0 ? { args } : undefined)
  },
  error: (message: string, ...args: any[]) => {
    // 处理不同的调用格式
    if (args.length === 0) {
      logger.error(message)
    } else if (args.length === 1) {
      // 可能是 error 或 context
      logger.error(message, args[0])
    } else {
      // 多个参数，尝试找到 Error 对象
      const error = args.find(
        (arg) => arg instanceof Error || (arg && typeof arg === "object" && "message" in arg)
      )
      const otherArgs = args.filter((arg) => arg !== error)
      logger.error(message, otherArgs.length > 0 ? { args: otherArgs } : undefined, error)
    }
  },
}

// 类型导出
export type { LoggerConfig }
