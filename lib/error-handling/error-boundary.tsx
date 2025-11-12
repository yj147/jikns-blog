/**
 * React 错误边界组件 - 捕获和处理 React 组件错误
 * Phase 5: 前端错误处理与用户体验优化
 */

"use client"

import React, { Component, ReactNode } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle, RefreshCw, Home, Bug } from "lucide-react"
import { ErrorBoundaryState } from "@/types/error"
import ErrorFactory from "./error-factory"
import errorHandler from "./error-handler"
import { logger } from "@/lib/utils/logger"

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ComponentType<ErrorBoundaryFallbackProps> | ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  enableRetry?: boolean
  maxRetries?: number
  showErrorDetails?: boolean
  isolationLevel?: "component" | "page" | "app"
  resetOnPropsChange?: boolean
  resetKeys?: Array<string | number>
}

interface ErrorBoundaryFallbackProps {
  error: Error | null
  errorInfo: React.ErrorInfo | null
  retry: () => void
  canRetry: boolean
  retryCount: number
}

type ComponentType<P = {}> = React.ComponentType<P>

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId?: NodeJS.Timeout
  private previousResetKeys?: Array<string | number>

  constructor(props: ErrorBoundaryProps) {
    super(props)

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: undefined,
      retryCount: 0,
      lastRetry: undefined,
    }

    this.previousResetKeys = props.resetKeys
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const errorId = `boundary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    this.setState({
      errorInfo,
      errorId,
    })

    // 创建 AppError 并发送给错误处理器
    const appError = ErrorFactory.createSystemError(
      error.message,
      "页面发生错误，正在尝试修复",
      error,
      {
        component: this.constructor.name,
        action: "component_render",
        requestId: errorId,
      }
    )

    // 异步处理错误，不阻塞渲染
    setTimeout(() => {
      errorHandler.handle(appError, {
        showNotification: this.props.isolationLevel !== "app", // 应用级错误不显示通知
        logToServer: true,
        logToConsole: true,
        showStackTrace: process.env.NODE_ENV === "development",
      })
    }, 0)

    // 调用用户提供的错误回调
    if (this.props.onError) {
      try {
        this.props.onError(error, errorInfo)
      } catch (callbackError) {
        logger.error("错误边界回调函数执行失败", {}, callbackError)
      }
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    const { resetOnPropsChange, resetKeys } = this.props
    const { hasError } = this.state

    // 如果有错误且允许在 props 变化时重置
    if (hasError && resetOnPropsChange) {
      if (resetKeys) {
        // 检查指定的 resetKeys
        const hasResetKeyChanged = resetKeys.some(
          (key, idx) => this.previousResetKeys?.[idx] !== key
        )
        if (hasResetKeyChanged) {
          this.resetErrorBoundary()
          this.previousResetKeys = resetKeys
        }
      } else {
        // 简单比较 props 对象
        if (prevProps !== this.props) {
          this.resetErrorBoundary()
        }
      }
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId)
    }
  }

  /**
   * 重置错误边界状态
   */
  resetErrorBoundary = () => {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId)
      this.retryTimeoutId = undefined
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: undefined,
      retryCount: 0,
      lastRetry: undefined,
    })
  }

  /**
   * 重试渲染
   */
  handleRetry = () => {
    const { maxRetries = 3 } = this.props
    const { retryCount } = this.state

    if (retryCount >= maxRetries) {
      return
    }

    this.setState({
      retryCount: retryCount + 1,
      lastRetry: Date.now(),
    })

    // 延迟重置，给用户反馈
    this.retryTimeoutId = setTimeout(() => {
      this.resetErrorBoundary()
    }, 500)
  }

  render() {
    const { hasError, error, errorInfo, retryCount } = this.state
    const {
      children,
      fallback,
      enableRetry = true,
      maxRetries = 3,
      showErrorDetails = false,
    } = this.props

    if (hasError) {
      const canRetry = enableRetry && retryCount < maxRetries

      // 如果提供了自定义 fallback
      if (fallback) {
        if (React.isValidElement(fallback)) {
          return fallback
        }

        if (typeof fallback === "function") {
          const FallbackComponent = fallback as ComponentType<ErrorBoundaryFallbackProps>
          return (
            <FallbackComponent
              error={error ?? null}
              errorInfo={errorInfo ?? null}
              retry={this.handleRetry}
              canRetry={canRetry}
              retryCount={retryCount}
            />
          )
        }
      }

      // 默认的错误显示组件
      return (
        <DefaultErrorFallback
          error={error ?? null}
          errorInfo={errorInfo ?? null}
          retry={this.handleRetry}
          canRetry={canRetry}
          retryCount={retryCount}
          maxRetries={maxRetries}
          showErrorDetails={showErrorDetails}
          isolationLevel={this.props.isolationLevel}
        />
      )
    }

    return children
  }
}

/**
 * 默认错误显示组件
 */
interface DefaultErrorFallbackProps extends ErrorBoundaryFallbackProps {
  maxRetries: number
  showErrorDetails: boolean
  isolationLevel?: "component" | "page" | "app"
}

function DefaultErrorFallback({
  error,
  errorInfo,
  retry,
  canRetry,
  retryCount,
  maxRetries,
  showErrorDetails,
  isolationLevel = "component",
}: DefaultErrorFallbackProps) {
  const getErrorTitle = () => {
    switch (isolationLevel) {
      case "app":
        return "应用遇到了问题"
      case "page":
        return "页面加载失败"
      case "component":
      default:
        return "内容加载失败"
    }
  }

  const getErrorMessage = () => {
    if (isolationLevel === "app") {
      return "我们正在修复这个问题。请刷新页面或联系技术支持。"
    }
    return "请稍后重试或刷新页面。如果问题持续存在，请联系我们。"
  }

  const getSeverityColor = () => {
    switch (isolationLevel) {
      case "app":
        return "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20"
      case "page":
        return "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20"
      case "component":
      default:
        return "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20"
    }
  }

  return (
    <Card className="mx-auto my-8 max-w-2xl">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <div className={`rounded-full p-2 ${getSeverityColor()}`}>
            <AlertTriangle className="h-5 w-5" />
          </div>
          <CardTitle className="text-lg">{getErrorTitle()}</CardTitle>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-muted-foreground">{getErrorMessage()}</p>

        {/* 重试信息 */}
        {retryCount > 0 && (
          <div className="text-muted-foreground text-sm">
            已尝试 {retryCount} / {maxRetries} 次
          </div>
        )}

        {/* 错误详情 (仅开发环境) */}
        {showErrorDetails && process.env.NODE_ENV === "development" && error && (
          <details className="mt-4">
            <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-sm font-medium">
              技术详情 (仅开发环境可见)
            </summary>
            <div className="bg-muted mt-2 max-h-40 overflow-auto rounded-md p-3 font-mono text-xs">
              <div className="mb-2">
                <strong>错误信息:</strong> {error.message}
              </div>
              {error.stack && (
                <div>
                  <strong>堆栈信息:</strong>
                  <pre className="mt-1 whitespace-pre-wrap text-xs">{error.stack}</pre>
                </div>
              )}
              {errorInfo && (
                <div className="mt-2">
                  <strong>组件堆栈:</strong>
                  <pre className="mt-1 whitespace-pre-wrap text-xs">{errorInfo.componentStack}</pre>
                </div>
              )}
            </div>
          </details>
        )}

        {/* 操作按钮 */}
        <div className="flex flex-col gap-2 pt-2 sm:flex-row">
          {canRetry && (
            <Button onClick={retry} className="flex-1">
              <RefreshCw className="mr-2 h-4 w-4" />
              重试 ({maxRetries - retryCount} 次剩余)
            </Button>
          )}

          <Button variant="outline" onClick={() => window.location.reload()} className="flex-1">
            <RefreshCw className="mr-2 h-4 w-4" />
            刷新页面
          </Button>

          {isolationLevel !== "app" && (
            <Button
              variant="outline"
              onClick={() => (window.location.href = "/")}
              className="flex-1"
            >
              <Home className="mr-2 h-4 w-4" />
              返回首页
            </Button>
          )}

          {process.env.NODE_ENV === "development" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                logger.debug("错误边界调试信息", {
                  error,
                  errorInfo,
                  state: { retryCount, maxRetries, canRetry },
                })
              }}
            >
              <Bug className="mr-1 h-4 w-4" />
              调试
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * 高阶组件 - 为组件添加错误边界
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, "children">
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  )

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`

  return WrappedComponent
}

/**
 * Hook - 在函数组件中使用错误边界
 */
export function useErrorHandler() {
  return {
    captureError: (error: Error, context?: { component?: string; action?: string }) => {
      const appError = ErrorFactory.fromError(error, context)
      errorHandler.handle(appError)
    },
  }
}

export default ErrorBoundary
export type { ErrorBoundaryProps, ErrorBoundaryFallbackProps }
