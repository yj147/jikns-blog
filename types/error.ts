/**
 * 前端错误处理类型定义
 * Phase 5: 前端错误处理与用户体验优化
 */

// 错误类型枚举
export enum ErrorType {
  SECURITY = "SECURITY",
  NETWORK = "NETWORK",
  BUSINESS = "BUSINESS",
  SYSTEM = "SYSTEM",
  VALIDATION = "VALIDATION",
}

// 安全错误子类型
export enum SecurityErrorType {
  CSRF_FAILED = "CSRF_FAILED",
  SESSION_EXPIRED = "SESSION_EXPIRED",
  INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS",
  ACCOUNT_BANNED = "ACCOUNT_BANNED",
  TOKEN_INVALID = "TOKEN_INVALID",
  AUTH_REQUIRED = "AUTH_REQUIRED",
}

// 网络错误子类型
export enum NetworkErrorType {
  CONNECTION_FAILED = "CONNECTION_FAILED",
  TIMEOUT = "TIMEOUT",
  OFFLINE = "OFFLINE",
  SERVER_ERROR = "SERVER_ERROR",
  RATE_LIMITED = "RATE_LIMITED",
}

// 业务错误子类型
export enum BusinessErrorType {
  VALIDATION_FAILED = "VALIDATION_FAILED",
  RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
  DUPLICATE_RESOURCE = "DUPLICATE_RESOURCE",
  OPERATION_FAILED = "OPERATION_FAILED",
}

// 统一错误接口
export interface AppError {
  id: string // 唯一错误ID
  type: ErrorType
  subType?: SecurityErrorType | NetworkErrorType | BusinessErrorType | string
  message: string
  userMessage: string // 用户友好的错误信息
  details?: Record<string, any>
  timestamp: number
  recoverable: boolean // 是否可恢复
  retryable: boolean // 是否可重试
  severity: "low" | "medium" | "high" | "critical"
  source?: string // 错误来源
  stackTrace?: string
  context?: ErrorContext
}

// 错误上下文
export interface ErrorContext {
  userId?: string
  sessionId?: string
  path: string
  userAgent?: string
  timestamp: number
  action?: string
  component?: string
  requestId?: string
}

// 重试策略
export interface RetryStrategy {
  maxRetries: number
  baseDelay: number // 基础延迟 (ms)
  maxDelay: number // 最大延迟 (ms)
  exponentialBackoff: boolean
  jitter: boolean // 随机化延迟
}

// 错误恢复操作
export interface RecoveryAction {
  type: "retry" | "redirect" | "refresh" | "logout" | "contact_support" | "custom"
  label: string
  action: () => void | Promise<void>
  primary?: boolean
  variant?: "default" | "destructive" | "outline" | "secondary"
}

// 错误处理配置
export interface ErrorHandlingConfig {
  showNotification: boolean
  showDialog: boolean
  autoRetry: boolean
  retryStrategy: RetryStrategy
  logToConsole: boolean
  logToServer: boolean
  showStackTrace: boolean // 仅开发环境
  recoveryActions: RecoveryAction[]
}

// 错误处理结果
export interface ErrorHandlingResult {
  handled: boolean
  recovery?: {
    attempted: boolean
    successful: boolean
    action?: string
  }
  logged: boolean
  userNotified: boolean
}

// 安全状态
export interface SecurityState {
  authenticated: boolean
  sessionValid: boolean
  csrfTokenValid: boolean
  permissions: string[]
  role: string
  accountStatus: "ACTIVE" | "BANNED" | "PENDING"
  lastActivity: number
  sessionExpiry: number
  requiresReauth: boolean
}

// 网络状态
export interface NetworkState {
  online: boolean
  effectiveType?: string
  downlink?: number
  rtt?: number
  lastConnected?: number
}

// 用户反馈数据
export interface ErrorFeedback {
  errorId: string
  rating?: number // 1-5 星级评分
  comment?: string
  helpful: boolean
  resolved: boolean
  reportedAt: number
  userId?: string
}

// 错误分析数据
export interface ErrorAnalytics {
  errorId: string
  type: ErrorType
  subType?: string
  frequency: number
  firstOccurrence: number
  lastOccurrence: number
  affectedUsers: number
  resolved: boolean
  resolution?: {
    method: string
    timestamp: number
    successful: boolean
  }
}

// Toast 通知选项
export interface ErrorToastOptions {
  title: string
  description?: string
  variant?: "default" | "destructive"
  duration?: number
  action?: {
    altText: string
    label: string
    onClick: () => void
  }
}

// 错误边界状态
export interface ErrorBoundaryState {
  hasError: boolean
  error?: Error | null
  errorInfo?: React.ErrorInfo | null
  errorId?: string
  retryCount: number
  lastRetry?: number
}

// 安全事件类型
export interface SecurityEvent {
  id: string
  type: SecurityErrorType
  severity: "low" | "medium" | "high" | "critical"
  message: string
  timestamp: number
  userId?: string
  sessionId?: string
  ipAddress?: string
  userAgent?: string
  resolved: boolean
  metadata?: Record<string, any>
}

// API 错误响应
export interface ApiErrorResponse {
  error: boolean
  code: string
  message: string
  details?: Record<string, any>
  timestamp: number
  requestId?: string
  retryAfter?: number
}
