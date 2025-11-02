/**
 * 安全状态 Hook - 安全状态管理和监听
 * Phase 5: 前端错误处理与用户体验优化
 */

"use client"

import { useCallback, useEffect, useState } from "react"
import { SecurityState, SecurityEvent, NetworkState, SecurityErrorType } from "@/types/error"
import { useSecurity } from "@/components/security/security-provider"
import { useAuth } from "@/app/providers/auth-provider"
import useErrorHandler from "./use-error-handler"

export interface UseSecurityStateOptions {
  enableAutoRefresh?: boolean
  refreshInterval?: number // 毫秒
  enableNetworkMonitoring?: boolean
  enableSecurityEventTracking?: boolean
}

export interface UseSecurityStateReturn {
  // 安全状态
  securityState: SecurityState
  networkState: NetworkState
  isSecure: boolean
  isOnline: boolean

  // 安全事件
  securityEvents: SecurityEvent[]
  unreadEventCount: number
  criticalEventCount: number

  // 安全操作
  refreshSecurityState: () => Promise<void>
  validateSession: () => Promise<boolean>
  checkPermission: (permission: string) => boolean
  clearSecurityEvents: () => void
  markEventAsRead: (eventId: string) => void

  // 状态检查
  requiresReauth: boolean
  sessionExpiringSoon: boolean // 30分钟内过期
  hasCriticalIssues: boolean

  // 网络监控
  connectionQuality: "good" | "fair" | "poor" | "unknown"
  estimatedSpeed: string | null
}

export function useSecurityState(options: UseSecurityStateOptions = {}): UseSecurityStateReturn {
  const {
    enableAutoRefresh = true,
    refreshInterval = 60000, // 1分钟
    enableNetworkMonitoring = true,
    enableSecurityEventTracking = true,
  } = options

  const {
    securityState,
    networkState,
    securityEvents,
    refreshSecurityState,
    validateSession,
    checkPermission,
    clearSecurityEvents,
    isOnline,
  } = useSecurity()

  const { user } = useAuth()
  const { handleSecurityError } = useErrorHandler()

  const [readEventIds, setReadEventIds] = useState<Set<string>>(new Set())
  const [connectionQuality, setConnectionQuality] = useState<"good" | "fair" | "poor" | "unknown">(
    "unknown"
  )

  /**
   * 检查是否安全
   */
  const isSecure = useCallback(() => {
    return (
      securityState.authenticated &&
      securityState.sessionValid &&
      securityState.accountStatus === "ACTIVE" &&
      !securityState.requiresReauth
    )
  }, [securityState])

  /**
   * 检查会话是否即将过期
   */
  const sessionExpiringSoon = useCallback(() => {
    if (!securityState.sessionExpiry) return false
    const thirtyMinutes = 30 * 60 * 1000
    return securityState.sessionExpiry - Date.now() <= thirtyMinutes
  }, [securityState.sessionExpiry])

  /**
   * 检查是否需要重新认证
   */
  const requiresReauth = useCallback(() => {
    return (
      securityState.requiresReauth ||
      !securityState.sessionValid ||
      securityState.sessionExpiry <= Date.now()
    )
  }, [securityState])

  /**
   * 检查是否有严重问题
   */
  const hasCriticalIssues = useCallback(() => {
    const criticalEvents = securityEvents.filter(
      (event) => event.severity === "critical" && !event.resolved
    )
    return (
      criticalEvents.length > 0 ||
      securityState.accountStatus === "BANNED" ||
      !securityState.authenticated
    )
  }, [securityEvents, securityState])

  /**
   * 获取未读事件数量
   */
  const unreadEventCount = useCallback(() => {
    return securityEvents.filter((event) => !readEventIds.has(event.id)).length
  }, [securityEvents, readEventIds])

  /**
   * 获取严重事件数量
   */
  const criticalEventCount = useCallback(() => {
    return securityEvents.filter((event) => event.severity === "critical" && !event.resolved).length
  }, [securityEvents])

  /**
   * 标记事件为已读
   */
  const markEventAsRead = useCallback((eventId: string) => {
    setReadEventIds((prev) => new Set([...prev, eventId]))
  }, [])

  /**
   * 评估网络连接质量
   */
  const evaluateConnectionQuality = useCallback(() => {
    if (!isOnline) {
      setConnectionQuality("poor")
      return "poor"
    }

    const connection = (navigator as any).connection
    if (!connection) {
      setConnectionQuality("unknown")
      return "unknown"
    }

    const { effectiveType, downlink, rtt } = connection

    let quality: "good" | "fair" | "poor" | "unknown" = "unknown"

    if (effectiveType === "4g" || (downlink >= 5 && rtt < 200)) {
      quality = "good"
    } else if (effectiveType === "3g" || (downlink >= 1.5 && rtt < 500)) {
      quality = "fair"
    } else {
      quality = "poor"
    }

    setConnectionQuality(quality)
    return quality
  }, [isOnline])

  /**
   * 获取估算网速
   */
  const estimatedSpeed = useCallback(() => {
    const connection = (navigator as any).connection
    if (!connection || !connection.downlink) return null

    const speed = connection.downlink
    if (speed >= 10) return `${speed.toFixed(1)} Mbps (高速)`
    if (speed >= 1) return `${speed.toFixed(1)} Mbps (中速)`
    return `${(speed * 1000).toFixed(0)} Kbps (低速)`
  }, [])

  /**
   * 处理安全状态变化
   */
  useEffect(() => {
    if (!enableSecurityEventTracking) return

    // 检查会话过期
    if (securityState.authenticated && sessionExpiringSoon()) {
      handleSecurityError(
        SecurityErrorType.SESSION_EXPIRED,
        "您的会话即将过期，请保存工作并重新登录",
        { component: "useSecurityState" }
      )
    }

    // 检查账户状态
    if (securityState.accountStatus === "BANNED") {
      handleSecurityError(SecurityErrorType.ACCOUNT_BANNED, "您的账户已被禁用，请联系管理员", {
        component: "useSecurityState",
      })
    }

    // 检查权限变化
    if (user && securityState.authenticated && securityState.role !== user.role) {
      handleSecurityError(
        SecurityErrorType.INSUFFICIENT_PERMISSIONS,
        "您的权限已发生变化，页面将重新加载",
        { component: "useSecurityState" }
      )
    }
  }, [securityState, user, enableSecurityEventTracking, sessionExpiringSoon, handleSecurityError])

  /**
   * 网络状态监控
   */
  useEffect(() => {
    if (!enableNetworkMonitoring) return

    const updateConnectionQuality = () => {
      evaluateConnectionQuality()
    }

    // 初始评估
    updateConnectionQuality()

    // 监听网络变化
    if ("connection" in navigator) {
      const connection = (navigator as any).connection
      connection.addEventListener("change", updateConnectionQuality)

      return () => {
        connection.removeEventListener("change", updateConnectionQuality)
      }
    }

    // 没有 connection API 时不需要清理
    return undefined
  }, [enableNetworkMonitoring, evaluateConnectionQuality])

  /**
   * 定期刷新安全状态
   */
  useEffect(() => {
    if (!enableAutoRefresh) return

    const interval = setInterval(() => {
      refreshSecurityState()
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [enableAutoRefresh, refreshInterval, refreshSecurityState])

  /**
   * 清理过期的已读标记
   */
  useEffect(() => {
    const activeEventIds = new Set(securityEvents.map((event) => event.id))
    setReadEventIds((prev) => {
      const filtered = new Set<string>()
      prev.forEach((id) => {
        if (activeEventIds.has(id)) {
          filtered.add(id)
        }
      })
      return filtered
    })
  }, [securityEvents])

  return {
    // 安全状态
    securityState,
    networkState,
    isSecure: isSecure(),
    isOnline,

    // 安全事件
    securityEvents,
    unreadEventCount: unreadEventCount(),
    criticalEventCount: criticalEventCount(),

    // 安全操作
    refreshSecurityState,
    validateSession,
    checkPermission,
    clearSecurityEvents,
    markEventAsRead,

    // 状态检查
    requiresReauth: requiresReauth(),
    sessionExpiringSoon: sessionExpiringSoon(),
    hasCriticalIssues: hasCriticalIssues(),

    // 网络监控
    connectionQuality,
    estimatedSpeed: estimatedSpeed(),
  }
}

export default useSecurityState
