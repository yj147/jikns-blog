/**
 * 安全上下文提供者 - 全局安全状态管理
 * Phase 5: 前端错误处理与用户体验优化
 */

"use client"

import React, { createContext, useContext, useEffect, useState, useCallback } from "react"
import { SecurityState, NetworkState, SecurityEvent, SecurityErrorType } from "@/types/error"
import { useAuth } from "@/app/providers/auth-provider"
import errorHandler from "@/lib/error-handling/error-handler"

interface SecurityContextType {
  // 安全状态
  securityState: SecurityState
  networkState: NetworkState

  // 安全事件
  securityEvents: SecurityEvent[]
  clearSecurityEvents: () => void

  // 安全操作
  refreshSecurityState: () => Promise<void>
  validateSession: () => Promise<boolean>
  checkPermission: (permission: string) => boolean

  // 网络状态
  isOnline: boolean
  lastConnected?: number
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined)

interface SecurityProviderProps {
  children: React.ReactNode
  autoRefreshInterval?: number // 自动刷新间隔（毫秒）
  sessionValidationInterval?: number // 会话验证间隔（毫秒）
}

export function SecurityProvider({
  children,
  autoRefreshInterval = 60000, // 1分钟
  sessionValidationInterval = 300000, // 5分钟
}: SecurityProviderProps) {
  const { user, isLoading } = useAuth()

  const [securityState, setSecurityState] = useState<SecurityState>({
    authenticated: false,
    sessionValid: false,
    csrfTokenValid: false,
    permissions: [],
    role: "USER",
    accountStatus: "PENDING",
    lastActivity: Date.now(),
    sessionExpiry: 0,
    requiresReauth: false,
  })

  const [networkState, setNetworkState] = useState<NetworkState>({
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
    lastConnected: Date.now(),
  })

  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([])

  /**
   * 清除安全事件
   */
  const clearSecurityEvents = useCallback(() => {
    setSecurityEvents([])
  }, [])

  /**
   * 添加安全事件
   */
  const addSecurityEvent = useCallback((event: SecurityEvent) => {
    setSecurityEvents((prev) => {
      const newEvents = [event, ...prev].slice(0, 50) // 保留最近 50 个事件
      return newEvents
    })
  }, [])

  /**
   * 验证会话有效性
   */
  const validateSession = useCallback(async (): Promise<boolean> => {
    if (!user) {
      setSecurityState((prev) => ({
        ...prev,
        authenticated: false,
        sessionValid: false,
        csrfTokenValid: false,
        requiresReauth: true,
      }))
      return false
    }

    try {
      const response = await fetch("/api/auth/validate", {
        method: "GET",
        credentials: "include",
      })

      const isValid = response.ok

      setSecurityState((prev) => ({
        ...prev,
        sessionValid: isValid,
        csrfTokenValid: isValid,
        lastActivity: isValid ? Date.now() : prev.lastActivity,
        requiresReauth: !isValid,
      }))

      if (!isValid) {
        addSecurityEvent({
          id: `session_invalid_${Date.now()}`,
          type: SecurityErrorType.SESSION_EXPIRED,
          severity: "medium",
          message: "会话已过期，需要重新登录",
          timestamp: Date.now(),
          userId: user.id,
          resolved: false,
        })
      }

      return isValid
    } catch (error) {
      console.error("会话验证失败:", error)

      setSecurityState((prev) => ({
        ...prev,
        sessionValid: false,
        csrfTokenValid: false,
        requiresReauth: true,
      }))

      addSecurityEvent({
        id: `session_validation_error_${Date.now()}`,
        type: SecurityErrorType.SESSION_EXPIRED,
        severity: "medium",
        message: "会话验证失败，请重新登录",
        timestamp: Date.now(),
        userId: user.id,
        resolved: false,
      })

      return false
    }
  }, [user, addSecurityEvent])

  /**
   * 刷新安全状态
   */
  const refreshSecurityState = useCallback(async () => {
    if (isLoading || !user) {
      setSecurityState((prev) => ({
        ...prev,
        authenticated: false,
        sessionValid: false,
        csrfTokenValid: false,
        permissions: [],
        role: "USER",
        accountStatus: "PENDING",
        requiresReauth: false,
      }))
      return
    }

    try {
      setSecurityState((prev) => ({
        ...prev,
        authenticated: true,
        sessionValid: false,
        csrfTokenValid: false,
        permissions: user.role === "ADMIN" ? ["admin", "read", "write"] : ["read"],
        role: user.role || "USER",
        accountStatus: user.status || "ACTIVE",
        lastActivity: Date.now(),
        sessionExpiry: Date.now() + 24 * 60 * 60 * 1000,
        requiresReauth: false,
      }))

      await validateSession()
    } catch (error) {
      console.error("安全状态刷新失败:", error)

      addSecurityEvent({
        id: `security_${Date.now()}`,
        type: SecurityErrorType.SESSION_EXPIRED,
        severity: "medium",
        message: "安全状态刷新失败",
        timestamp: Date.now(),
        userId: user?.id,
        resolved: false,
      })
    }
  }, [user, isLoading, addSecurityEvent, validateSession])

  /**
   * 检查权限
   */
  const checkPermission = useCallback(
    (permission: string): boolean => {
      return securityState.permissions.includes(permission)
    },
    [securityState.permissions]
  )

  /**
   * 初始化网络状态监听
   */
  useEffect(() => {
    if (typeof window === "undefined") return

    const updateNetworkState = () => {
      const online = navigator.onLine
      setNetworkState((prev) => ({
        ...prev,
        online,
        lastConnected: online ? Date.now() : prev.lastConnected,
        // 获取网络信息（如果支持）
        ...(navigator.connection
          ? {
              effectiveType: (navigator.connection as any).effectiveType,
              downlink: (navigator.connection as any).downlink,
              rtt: (navigator.connection as any).rtt,
            }
          : {}),
      }))

      // 记录网络状态变化事件
      addSecurityEvent({
        id: `network_${Date.now()}`,
        type: online ? SecurityErrorType.AUTH_REQUIRED : SecurityErrorType.SESSION_EXPIRED, // 使用现有类型
        severity: online ? "low" : "medium",
        message: online ? "网络连接恢复" : "网络连接断开",
        timestamp: Date.now(),
        resolved: online,
        metadata: { networkChange: true },
      })
    }

    // 初始状态
    updateNetworkState()

    // 监听网络状态变化
    window.addEventListener("online", updateNetworkState)
    window.addEventListener("offline", updateNetworkState)

    return () => {
      window.removeEventListener("online", updateNetworkState)
      window.removeEventListener("offline", updateNetworkState)
    }
  }, [addSecurityEvent])

  /**
   * 安全状态自动刷新
   */
  useEffect(() => {
    const interval = setInterval(refreshSecurityState, autoRefreshInterval)
    return () => clearInterval(interval)
  }, [refreshSecurityState, autoRefreshInterval])

  /**
   * 会话定期验证
   */
  useEffect(() => {
    if (!securityState.authenticated) return

    const interval = setInterval(validateSession, sessionValidationInterval)
    return () => clearInterval(interval)
  }, [validateSession, sessionValidationInterval, securityState.authenticated])

  /**
   * 用户变化时刷新安全状态
   */
  useEffect(() => {
    refreshSecurityState()
  }, [user, refreshSecurityState])

  /**
   * 监听错误事件并转换为安全事件
   */
  useEffect(() => {
    const unsubscribe = errorHandler.addEventListener((error) => {
      if (error.type === "SECURITY") {
        addSecurityEvent({
          id: error.id,
          type: error.subType as any,
          severity: error.severity,
          message: error.userMessage,
          timestamp: error.timestamp,
          userId: user?.id,
          resolved: false,
          metadata: error.details,
        })
      }
    })

    return unsubscribe
  }, [addSecurityEvent, user?.id])

  const contextValue: SecurityContextType = {
    securityState,
    networkState,
    securityEvents,
    clearSecurityEvents,
    refreshSecurityState,
    validateSession,
    checkPermission,
    isOnline: networkState.online,
    lastConnected: networkState.lastConnected,
  }

  return <SecurityContext.Provider value={contextValue}>{children}</SecurityContext.Provider>
}

/**
 * 使用安全上下文的 Hook
 */
export function useSecurity() {
  const context = useContext(SecurityContext)
  if (context === undefined) {
    throw new Error("useSecurity must be used within a SecurityProvider")
  }
  return context
}

/**
 * 使用网络状态的 Hook
 */
export function useNetworkState() {
  const { networkState, isOnline, lastConnected } = useSecurity()
  return { networkState, isOnline, lastConnected }
}

/**
 * 使用安全事件的 Hook
 */
export function useSecurityEvents() {
  const { securityEvents, clearSecurityEvents } = useSecurity()
  return { securityEvents, clearSecurityEvents }
}

export default SecurityProvider
