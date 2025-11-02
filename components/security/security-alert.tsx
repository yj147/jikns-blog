/**
 * 安全警告组件 - 统一安全警告和提示显示
 * Phase 5: 前端错误处理与用户体验优化
 */

"use client"

import React, { useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  AlertTriangle,
  Shield,
  ShieldAlert,
  ShieldX,
  Info,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  RefreshCw,
  X,
} from "lucide-react"
import { SecurityEvent, SecurityErrorType } from "@/types/error"
import { cn } from "@/lib/utils"

interface SecurityAlertProps {
  event: SecurityEvent
  variant?: "default" | "compact" | "detailed"
  showActions?: boolean
  showTimestamp?: boolean
  onResolve?: (eventId: string) => void
  onDismiss?: (eventId: string) => void
  onRetry?: (eventId: string) => void
  className?: string
}

export function SecurityAlert({
  event,
  variant = "default",
  showActions = true,
  showTimestamp = true,
  onResolve,
  onDismiss,
  onRetry,
  className,
}: SecurityAlertProps) {
  const [isDismissed, setIsDismissed] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  if (isDismissed) {
    return null
  }

  const getSeverityIcon = () => {
    switch (event.severity) {
      case "critical":
        return <ShieldX className="h-4 w-4" />
      case "high":
        return <ShieldAlert className="h-4 w-4" />
      case "medium":
        return <AlertTriangle className="h-4 w-4" />
      case "low":
      default:
        return <Info className="h-4 w-4" />
    }
  }

  const getSeverityColor = () => {
    switch (event.severity) {
      case "critical":
        return "destructive"
      case "high":
        return "destructive"
      case "medium":
        return "default"
      case "low":
      default:
        return "default"
    }
  }

  const getSeverityBadgeVariant = () => {
    switch (event.severity) {
      case "critical":
        return "destructive"
      case "high":
        return "destructive"
      case "medium":
        return "secondary"
      case "low":
      default:
        return "outline"
    }
  }

  const getTypeDisplayName = () => {
    switch (event.type) {
      case "CSRF_FAILED":
        return "CSRF 验证失败"
      case "SESSION_EXPIRED":
        return "会话已过期"
      case "INSUFFICIENT_PERMISSIONS":
        return "权限不足"
      case "ACCOUNT_BANNED":
        return "账户被禁"
      case "TOKEN_INVALID":
        return "令牌无效"
      case "AUTH_REQUIRED":
        return "需要认证"
      default:
        return "安全事件"
    }
  }

  const getRecommendedActions = (): Array<{
    label: string
    action: () => void
    variant?: "default" | "outline" | "secondary"
    icon?: React.ReactNode
  }> => {
    const actions = []

    switch (event.type) {
      case "SESSION_EXPIRED":
      case "TOKEN_INVALID":
      case "AUTH_REQUIRED":
        actions.push({
          label: "重新登录",
          action: () => {
            window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`
          },
          icon: <ExternalLink className="h-3 w-3" />,
        })
        break

      case "CSRF_FAILED":
        actions.push({
          label: "刷新页面",
          action: () => {
            window.location.reload()
          },
          icon: <RefreshCw className="h-3 w-3" />,
        })
        break

      case "INSUFFICIENT_PERMISSIONS":
        actions.push({
          label: "联系管理员",
          action: () => {
            // TODO: 打开联系方式或反馈表单
          },
          variant: "outline" as const,
          icon: <ExternalLink className="h-3 w-3" />,
        })
        break

      case "ACCOUNT_BANNED":
        actions.push({
          label: "了解详情",
          action: () => {
            // TODO: 打开账户状态页面
            window.location.href = "/account-status"
          },
          variant: "outline" as const,
          icon: <ExternalLink className="h-3 w-3" />,
        })
        break
    }

    return actions
  }

  const handleResolve = async () => {
    if (!onResolve) return

    setIsProcessing(true)
    try {
      await onResolve(event.id)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDismiss = () => {
    if (onDismiss) {
      onDismiss(event.id)
    }
    setIsDismissed(true)
  }

  const handleRetry = async () => {
    if (!onRetry) return

    setIsProcessing(true)
    try {
      await onRetry(event.id)
    } finally {
      setIsProcessing(false)
    }
  }

  const formatTimestamp = () => {
    const now = Date.now()
    const diff = now - event.timestamp
    const minutes = Math.floor(diff / (1000 * 60))

    if (minutes < 1) return "刚刚"
    if (minutes < 60) return `${minutes} 分钟前`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} 小时前`
    const days = Math.floor(hours / 24)
    return `${days} 天前`
  }

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "bg-muted/50 flex items-center space-x-2 rounded-md p-2",
          event.severity === "critical" && "bg-red-50 dark:bg-red-900/20",
          event.severity === "high" && "bg-red-50 dark:bg-red-900/20",
          event.severity === "medium" && "bg-yellow-50 dark:bg-yellow-900/20",
          className
        )}
      >
        <div
          className={cn(
            "text-muted-foreground",
            event.severity === "critical" && "text-red-600 dark:text-red-400",
            event.severity === "high" && "text-red-600 dark:text-red-400",
            event.severity === "medium" && "text-yellow-600 dark:text-yellow-400"
          )}
        >
          {getSeverityIcon()}
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{event.message}</div>
          {showTimestamp && (
            <div className="text-muted-foreground text-xs">{formatTimestamp()}</div>
          )}
        </div>

        <Badge variant={getSeverityBadgeVariant()} className="text-xs">
          {getTypeDisplayName()}
        </Badge>

        {showActions && (
          <Button variant="ghost" size="sm" onClick={handleDismiss} className="h-6 w-6 p-0">
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    )
  }

  if (variant === "detailed") {
    return (
      <Card className={cn("w-full", className)}>
        <CardContent className="p-4">
          <div className="space-y-3">
            {/* 标题区域 */}
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <div
                  className={cn(
                    "mt-0.5",
                    event.severity === "critical" && "text-red-600 dark:text-red-400",
                    event.severity === "high" && "text-red-600 dark:text-red-400",
                    event.severity === "medium" && "text-yellow-600 dark:text-yellow-400",
                    event.severity === "low" && "text-blue-600 dark:text-blue-400"
                  )}
                >
                  {getSeverityIcon()}
                </div>
                <div>
                  <h4 className="text-sm font-semibold">{getTypeDisplayName()}</h4>
                  <p className="text-muted-foreground mt-1 text-sm">{event.message}</p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Badge variant={getSeverityBadgeVariant()}>{event.severity.toUpperCase()}</Badge>
                {showActions && (
                  <Button variant="ghost" size="sm" onClick={handleDismiss} className="h-6 w-6 p-0">
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>

            {/* 详细信息 */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              {showTimestamp && (
                <div>
                  <span className="text-muted-foreground">时间:</span>
                  <div className="mt-1 flex items-center space-x-1">
                    <Clock className="h-3 w-3" />
                    <span>{formatTimestamp()}</span>
                  </div>
                </div>
              )}

              <div>
                <span className="text-muted-foreground">状态:</span>
                <div className="mt-1 flex items-center space-x-1">
                  {event.resolved ? (
                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                  ) : (
                    <XCircle className="h-3 w-3 text-red-600" />
                  )}
                  <span>{event.resolved ? "已解决" : "未解决"}</span>
                </div>
              </div>

              {event.userId && (
                <div>
                  <span className="text-muted-foreground">用户 ID:</span>
                  <div className="mt-1 font-mono">{event.userId}</div>
                </div>
              )}

              {event.sessionId && (
                <div>
                  <span className="text-muted-foreground">会话 ID:</span>
                  <div className="mt-1 font-mono">{event.sessionId.substring(0, 8)}...</div>
                </div>
              )}
            </div>

            {/* 元数据 */}
            {event.metadata && Object.keys(event.metadata).length > 0 && (
              <details className="text-xs">
                <summary className="text-muted-foreground hover:text-foreground cursor-pointer">
                  技术详情
                </summary>
                <pre className="bg-muted mt-2 overflow-auto rounded p-2 text-xs">
                  {JSON.stringify(event.metadata, null, 2)}
                </pre>
              </details>
            )}

            {/* 操作按钮 */}
            {showActions && (
              <div className="flex flex-wrap gap-2 pt-2">
                {getRecommendedActions().map((action, index) => (
                  <Button
                    key={index}
                    variant={action.variant || "default"}
                    size="sm"
                    onClick={action.action}
                    disabled={isProcessing}
                    className="h-7 text-xs"
                  >
                    {action.icon}
                    <span className={action.icon ? "ml-1" : ""}>{action.label}</span>
                  </Button>
                ))}

                {!event.resolved && onResolve && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResolve}
                    disabled={isProcessing}
                    className="h-7 text-xs"
                  >
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    标记为已解决
                  </Button>
                )}

                {onRetry && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRetry}
                    disabled={isProcessing}
                    className="h-7 text-xs"
                  >
                    <RefreshCw className={cn("mr-1 h-3 w-3", isProcessing && "animate-spin")} />
                    重试
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  // default variant
  return (
    <Alert variant={getSeverityColor() as any} className={className}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          {getSeverityIcon()}
          <div className="flex-1">
            <AlertTitle className="text-sm">{getTypeDisplayName()}</AlertTitle>
            <AlertDescription className="mt-1 text-sm">{event.message}</AlertDescription>

            {showTimestamp && (
              <div className="text-muted-foreground mt-2 flex items-center space-x-1 text-xs">
                <Clock className="h-3 w-3" />
                <span>{formatTimestamp()}</span>
              </div>
            )}
          </div>
        </div>

        {showActions && (
          <div className="flex items-center space-x-2">
            <Badge variant={getSeverityBadgeVariant()} className="text-xs">
              {event.severity.toUpperCase()}
            </Badge>
            <Button variant="ghost" size="sm" onClick={handleDismiss} className="h-6 w-6 p-0">
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {showActions && (
        <div className="mt-3 flex flex-wrap gap-2">
          {getRecommendedActions().map((action, index) => (
            <Button
              key={index}
              variant={action.variant || "default"}
              size="sm"
              onClick={action.action}
              disabled={isProcessing}
              className="h-7 text-xs"
            >
              {action.icon}
              <span className={action.icon ? "ml-1" : ""}>{action.label}</span>
            </Button>
          ))}
        </div>
      )}
    </Alert>
  )
}

export default SecurityAlert
