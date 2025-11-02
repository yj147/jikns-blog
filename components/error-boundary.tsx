"use client"

/**
 * 全局错误边界组件
 * 捕获React组件渲染过程中的错误，提供友好的错误提示
 */

import React from "react"
import { AlertTriangle, RefreshCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId: number | null = null

  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo)

    this.setState({
      error,
      errorInfo,
    })

    // 调用用户提供的错误处理函数
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // 在开发环境下输出详细错误信息
    if (process.env.NODE_ENV === "development") {
      console.group("🚨 Error Boundary Details")
      console.error("Error:", error)
      console.error("Component Stack:", errorInfo.componentStack)
      console.groupEnd()
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      window.clearTimeout(this.retryTimeoutId)
    }
  }

  retry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  }

  render() {
    if (this.state.hasError) {
      // 如果提供了自定义fallback组件，使用它
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback
        return <FallbackComponent error={this.state.error!} retry={this.retry} />
      }

      // 默认错误UI
      return <DefaultErrorFallback error={this.state.error!} retry={this.retry} />
    }

    return this.props.children
  }
}

/**
 * 默认错误回退组件
 */
function DefaultErrorFallback({ error, retry }: { error: Error; retry: () => void }) {
  const isDev = process.env.NODE_ENV === "development"

  return (
    <div className="flex min-h-[400px] items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <CardTitle className="text-red-800">出现了错误</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center text-gray-600">
            <p>抱歉，页面加载时出现了错误。</p>
            <p className="mt-1 text-sm">请尝试刷新页面或稍后再试。</p>
          </div>

          {isDev && (
            <details className="mt-4 rounded border bg-gray-50 p-3 text-xs">
              <summary className="mb-2 cursor-pointer font-medium text-gray-700">
                开发模式：查看错误详情
              </summary>
              <div className="whitespace-pre-wrap break-words font-mono text-red-600">
                {error.name}: {error.message}
                {error.stack && <div className="mt-2 text-gray-600">{error.stack}</div>}
              </div>
            </details>
          )}

          <div className="flex justify-center space-x-2">
            <Button onClick={retry} variant="outline" size="sm" className="gap-2">
              <RefreshCcw className="h-4 w-4" />
              重试
            </Button>
            <Button onClick={() => window.location.reload()} size="sm">
              刷新页面
            </Button>
          </div>

          <div className="text-center">
            <p className="text-xs text-gray-500">如果问题持续存在，请联系技术支持</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * 简化的错误边界Hook
 * 用于函数组件中的局部错误处理
 */
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null)

  const resetError = React.useCallback(() => {
    setError(null)
  }, [])

  const handleError = React.useCallback((error: Error) => {
    console.error("Handled error:", error)
    setError(error)
  }, [])

  // 重置错误当组件卸载时
  React.useEffect(() => {
    return () => setError(null)
  }, [])

  return {
    error,
    hasError: !!error,
    resetError,
    handleError,
  }
}

/**
 * 用于异步操作的错误处理Hook
 */
export function useAsyncError() {
  const { handleError } = useErrorHandler()

  return React.useCallback((error: Error) => {
    // 在下一个事件循环中抛出错误，让ErrorBoundary捕获
    setTimeout(() => {
      throw error
    }, 0)
  }, [])
}

export default ErrorBoundary
