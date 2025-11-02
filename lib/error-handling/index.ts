/**
 * 错误处理模块统一导出
 * Phase 5: 前端错误处理与用户体验优化
 */

// 核心错误处理类
export { default as ErrorFactory } from "./error-factory"
export { default as errorHandler } from "./error-handler"
export { default as RetryManager } from "./retry-manager"
export { default as ErrorLogger } from "./error-logger"

// React 错误边界
export { default as ErrorBoundary, withErrorBoundary, useErrorHandler } from "./error-boundary"
export type { ErrorBoundaryProps, ErrorBoundaryFallbackProps } from "./error-boundary"

// 类型定义
export type {
  AppError,
  ErrorType,
  SecurityErrorType,
  NetworkErrorType,
  BusinessErrorType,
  ErrorContext,
  RetryStrategy,
  RecoveryAction,
  ErrorHandlingConfig,
  ErrorHandlingResult,
  SecurityState,
  NetworkState,
  ErrorFeedback,
  ErrorAnalytics,
  ErrorToastOptions,
  ErrorBoundaryState,
  SecurityEvent,
  ApiErrorResponse,
} from "@/types/error"
