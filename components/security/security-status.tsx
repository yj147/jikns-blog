/**
 * 安全状态显示组件 - 实时安全状态指示器
 * Phase 5: 前端错误处理与用户体验优化
 */

"use client"

import React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Wifi,
  WifiOff,
  Clock,
  User,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from "lucide-react"
import { useSecurity } from "./security-provider"
import { cn } from "@/lib/utils"

interface SecurityStatusProps {
  variant?: "compact" | "detailed" | "minimal"
  showNetworkStatus?: boolean
  showSessionInfo?: boolean
  showPermissions?: boolean
  className?: string
}

export function SecurityStatus({
  variant = "compact",
  showNetworkStatus = true,
  showSessionInfo = true,
  showPermissions = false,
  className,
}: SecurityStatusProps) {
  const {
    securityState,
    networkState,
    securityEvents,
    refreshSecurityState,
    validateSession,
    isOnline,
  } = useSecurity()

  const getSecurityLevel = () => {
    if (!securityState.authenticated) return "none"
    if (securityState.accountStatus === "BANNED") return "blocked"
    if (!securityState.sessionValid || securityState.requiresReauth) return "warning"
    if (securityState.csrfTokenValid && securityState.sessionValid) return "secure"
    return "warning"
  }

  const getSecurityIcon = () => {
    const level = getSecurityLevel()
    switch (level) {
      case "secure":
        return <ShieldCheck className="h-4 w-4 text-green-600" />
      case "warning":
        return <ShieldAlert className="h-4 w-4 text-yellow-600" />
      case "blocked":
        return <ShieldX className="h-4 w-4 text-red-600" />
      case "none":
      default:
        return <Shield className="h-4 w-4 text-gray-400" />
    }
  }

  const getSecurityBadgeVariant = () => {
    const level = getSecurityLevel()
    switch (level) {
      case "secure":
        return "default"
      case "warning":
        return "secondary"
      case "blocked":
        return "destructive"
      case "none":
      default:
        return "outline"
    }
  }

  const getSecurityStatusText = () => {
    const level = getSecurityLevel()
    switch (level) {
      case "secure":
        return "安全"
      case "warning":
        return "警告"
      case "blocked":
        return "被禁"
      case "none":
      default:
        return "未认证"
    }
  }

  const getLastActivityText = () => {
    const diff = Date.now() - securityState.lastActivity
    const minutes = Math.floor(diff / (1000 * 60))
    if (minutes < 1) return "刚刚"
    if (minutes < 60) return `${minutes} 分钟前`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} 小时前`
    const days = Math.floor(hours / 24)
    return `${days} 天前`
  }

  const getRecentSecurityEvents = () => {
    return securityEvents.slice(0, 3)
  }

  if (variant === "minimal") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn("flex items-center space-x-1", className)}>
              {getSecurityIcon()}
              {showNetworkStatus && (
                <div className="ml-1">
                  {isOnline ? (
                    <Wifi className="h-3 w-3 text-green-600" />
                  ) : (
                    <WifiOff className="h-3 w-3 text-red-600" />
                  )}
                </div>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-sm">
              <div>安全状态: {getSecurityStatusText()}</div>
              {showNetworkStatus && <div>网络: {isOnline ? "在线" : "离线"}</div>}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  if (variant === "compact") {
    return (
      <div className={cn("flex items-center space-x-2", className)}>
        <Badge variant={getSecurityBadgeVariant()} className="flex items-center space-x-1">
          {getSecurityIcon()}
          <span>{getSecurityStatusText()}</span>
        </Badge>

        {showNetworkStatus && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center">
                  {isOnline ? (
                    <Wifi className="h-4 w-4 text-green-600" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-red-600" />
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-sm">
                  {isOnline ? "网络正常" : "网络断开"}
                  {networkState.lastConnected && (
                    <div className="text-muted-foreground mt-1 text-xs">
                      上次连接: {new Date(networkState.lastConnected).toLocaleString()}
                    </div>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    )
  }

  // detailed variant
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("flex h-8 items-center space-x-2", className)}
        >
          {getSecurityIcon()}
          <span className="text-xs">{getSecurityStatusText()}</span>
          {showNetworkStatus && (
            <div className="ml-1">
              {isOnline ? (
                <Wifi className="h-3 w-3 text-green-600" />
              ) : (
                <WifiOff className="h-3 w-3 text-red-600" />
              )}
            </div>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80" align="end">
        <Card className="border-0 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-2">
                {getSecurityIcon()}
                <span>安全状态</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={refreshSecurityState}
                className="h-6 w-6 p-0"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4 pt-0">
            {/* 基本信息 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">认证状态</span>
                <div className="flex items-center space-x-1">
                  {securityState.authenticated ? (
                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                  ) : (
                    <XCircle className="h-3 w-3 text-red-600" />
                  )}
                  <span>{securityState.authenticated ? "已认证" : "未认证"}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">会话有效</span>
                <div className="flex items-center space-x-1">
                  {securityState.sessionValid ? (
                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                  ) : (
                    <XCircle className="h-3 w-3 text-red-600" />
                  )}
                  <span>{securityState.sessionValid ? "有效" : "无效"}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">账户状态</span>
                <Badge
                  variant={securityState.accountStatus === "ACTIVE" ? "default" : "destructive"}
                  className="h-5 text-xs"
                >
                  {securityState.accountStatus === "ACTIVE"
                    ? "正常"
                    : securityState.accountStatus === "BANNED"
                      ? "被禁"
                      : "待定"}
                </Badge>
              </div>
            </div>

            {showSessionInfo && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">用户角色</span>
                    <Badge variant="outline" className="h-5 text-xs">
                      <User className="mr-1 h-3 w-3" />
                      {securityState.role === "ADMIN" ? "管理员" : "用户"}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">最后活动</span>
                    <div className="flex items-center space-x-1 text-xs">
                      <Clock className="h-3 w-3" />
                      <span>{getLastActivityText()}</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {showPermissions && securityState.permissions.length > 0 && (
              <>
                <Separator />
                <div>
                  <div className="text-muted-foreground mb-2 text-sm">权限</div>
                  <div className="flex flex-wrap gap-1">
                    {securityState.permissions.map((permission) => (
                      <Badge key={permission} variant="outline" className="h-5 text-xs">
                        {permission}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}

            {showNetworkStatus && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">网络状态</span>
                    <div className="flex items-center space-x-1">
                      {isOnline ? (
                        <Wifi className="h-3 w-3 text-green-600" />
                      ) : (
                        <WifiOff className="h-3 w-3 text-red-600" />
                      )}
                      <span className="text-xs">{isOnline ? "在线" : "离线"}</span>
                    </div>
                  </div>

                  {networkState.effectiveType && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">连接类型</span>
                      <span className="text-xs">{networkState.effectiveType}</span>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* 最近安全事件 */}
            {getRecentSecurityEvents().length > 0 && (
              <>
                <Separator />
                <div>
                  <div className="text-muted-foreground mb-2 flex items-center space-x-1 text-sm">
                    <AlertTriangle className="h-3 w-3" />
                    <span>最近事件</span>
                  </div>
                  <div className="space-y-1">
                    {getRecentSecurityEvents().map((event) => (
                      <div key={event.id} className="bg-muted rounded p-2 text-xs">
                        <div className="mb-1 flex items-center justify-between">
                          <Badge
                            variant={
                              event.severity === "critical"
                                ? "destructive"
                                : event.severity === "high"
                                  ? "destructive"
                                  : event.severity === "medium"
                                    ? "secondary"
                                    : "outline"
                            }
                            className="h-4 text-xs"
                          >
                            {event.severity}
                          </Badge>
                          <span className="text-muted-foreground">
                            {new Date(event.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div>{event.message}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* 操作按钮 */}
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={validateSession}
                className="h-7 flex-1 text-xs"
              >
                验证会话
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={refreshSecurityState}
                className="h-7 flex-1 text-xs"
              >
                刷新状态
              </Button>
            </div>
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  )
}

export default SecurityStatus
