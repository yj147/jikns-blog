/**
 * 用户体验优化功能
 * 包括登录状态持久化、跨标签页同步、网络错误处理等
 */

import { createClientSupabaseClient } from "./supabase"
import { performanceMonitor } from "./performance-monitor"
import { auditLogger } from "./audit-log"
import { logger } from "./utils/logger"

/**
 * 用户会话管理器
 */
export class SessionManager {
  private static instance: SessionManager
  private broadcastChannel: BroadcastChannel | null = null
  private sessionCheckInterval: NodeJS.Timeout | null = null
  private networkStatusHandler: ((online: boolean) => void) | null = null

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager()
    }
    return SessionManager.instance
  }

  /**
   * 初始化会话管理
   */
  async initialize(): Promise<void> {
    try {
      // 初始化跨标签页通信
      this.initializeBroadcastChannel()

      // 初始化网络状态监控
      this.initializeNetworkMonitoring()

      // 初始化会话检查
      this.initializeSessionCheck()

      // 初始化页面可见性检查
      this.initializeVisibilityCheck()
    } catch (error) {
      logger.error("会话管理器初始化失败", { module: "SessionManager" }, error)
    }
  }

  /**
   * 初始化跨标签页通信
   */
  private initializeBroadcastChannel(): void {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) {
      return
    }

    this.broadcastChannel = new BroadcastChannel("auth-channel")

    this.broadcastChannel.addEventListener("message", (event) => {
      const { type, data } = event.data

      switch (type) {
        case "USER_LOGGED_IN":
          this.handleUserLoggedIn(data)
          break

        case "USER_LOGGED_OUT":
          this.handleUserLoggedOut(data)
          break

        case "SESSION_EXPIRED":
          this.handleSessionExpired()
          break

        case "PERMISSION_CHANGED":
          this.handlePermissionChanged(data)
          break
      }
    })
  }

  /**
   * 广播用户登录事件
   */
  broadcastUserLogin(userData: { id: string; email: string; name?: string }): void {
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: "USER_LOGGED_IN",
        data: userData,
        timestamp: Date.now(),
      })
    }
  }

  /**
   * 广播用户登出事件
   */
  broadcastUserLogout(): void {
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: "USER_LOGGED_OUT",
        data: {},
        timestamp: Date.now(),
      })
    }
  }

  /**
   * 广播会话过期事件
   */
  broadcastSessionExpired(): void {
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: "SESSION_EXPIRED",
        data: {},
        timestamp: Date.now(),
      })
    }
  }

  /**
   * 广播权限变更事件
   */
  broadcastPermissionChange(permissions: Record<string, boolean>): void {
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: "PERMISSION_CHANGED",
        data: permissions,
        timestamp: Date.now(),
      })
    }
  }

  /**
   * 处理其他标签页的用户登录
   */
  private handleUserLoggedIn(userData: any): void {
    // 触发用户状态更新事件
    window.dispatchEvent(
      new CustomEvent("auth-state-change", {
        detail: { type: "login", user: userData },
      })
    )
  }

  /**
   * 处理其他标签页的用户登出
   */
  private handleUserLoggedOut(data: any): void {
    // 触发用户状态更新事件
    window.dispatchEvent(
      new CustomEvent("auth-state-change", {
        detail: { type: "logout" },
      })
    )
  }

  /**
   * 处理会话过期
   */
  private handleSessionExpired(): void {
    // 清除本地存储
    this.clearUserSession()

    // 触发会话过期事件
    window.dispatchEvent(
      new CustomEvent("auth-state-change", {
        detail: { type: "session-expired" },
      })
    )

    // 重定向到登录页面
    if (window.location.pathname !== "/login") {
      window.location.href = "/login?reason=session-expired"
    }
  }

  /**
   * 处理权限变更
   */
  private handlePermissionChanged(permissions: Record<string, boolean>): void {
    // 触发权限变更事件
    window.dispatchEvent(
      new CustomEvent("permission-change", {
        detail: permissions,
      })
    )
  }

  /**
   * 初始化网络状态监控
   */
  private initializeNetworkMonitoring(): void {
    if (typeof window === "undefined" || !("navigator" in window)) {
      return
    }

    // 网络状态变化监听
    const handleOnline = () => {
      window.dispatchEvent(
        new CustomEvent("network-status-change", {
          detail: { online: true },
        })
      )

      // 网络恢复时重新检查会话
      this.checkSessionStatus()
    }

    const handleOffline = () => {
      window.dispatchEvent(
        new CustomEvent("network-status-change", {
          detail: { online: false },
        })
      )
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    // 监控连接质量
    this.monitorConnectionQuality()
  }

  /**
   * 监控连接质量
   */
  private async monitorConnectionQuality(): Promise<void> {
    if (typeof window === "undefined" || !("navigator" in window) || !("connection" in navigator)) {
      return
    }

    const connection = (navigator as any).connection

    if (connection) {
      const checkConnectionQuality = () => {
        const { effectiveType, downlink, rtt } = connection

        // 判断网络质量
        let quality: "fast" | "slow" | "very-slow" = "fast"

        if (effectiveType === "slow-2g" || effectiveType === "2g" || downlink < 0.5 || rtt > 2000) {
          quality = "very-slow"
        } else if (effectiveType === "3g" || downlink < 1.5 || rtt > 1000) {
          quality = "slow"
        }

        window.dispatchEvent(
          new CustomEvent("connection-quality-change", {
            detail: { quality, effectiveType, downlink, rtt },
          })
        )
      }

      // 初始检查
      checkConnectionQuality()

      // 监听连接变化
      connection.addEventListener("change", checkConnectionQuality)
    }
  }

  /**
   * 初始化会话检查
   */
  private initializeSessionCheck(): void {
    // 每5分钟检查一次会话状态
    this.sessionCheckInterval = setInterval(
      () => {
        this.checkSessionStatus()
      },
      5 * 60 * 1000
    )

    // 页面获得焦点时检查会话
    window.addEventListener("focus", () => {
      this.checkSessionStatus()
    })
  }

  /**
   * 检查会话状态
   */
  private async checkSessionStatus(): Promise<void> {
    try {
      const supabase = createClientSupabaseClient()
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession()

      if (error) {
        logger.error("会话检查失败", { module: "SessionManager" }, error)
        return
      }

      if (!session) {
        // 会话已过期
        this.handleSessionExpired()
        return
      }

      // 检查会话是否即将过期（剩余时间少于10分钟）
      const expiresAt = new Date(session.expires_at! * 1000)
      const now = new Date()
      const timeUntilExpiry = expiresAt.getTime() - now.getTime()

      if (timeUntilExpiry < 10 * 60 * 1000 && timeUntilExpiry > 0) {
        // 尝试刷新令牌
        await this.refreshSession()
      }
    } catch (error) {
      logger.error("会话状态检查异常", { module: "SessionManager" }, error)
    }
  }

  /**
   * 刷新会话
   */
  private async refreshSession(): Promise<void> {
    try {
      const supabase = createClientSupabaseClient()
      const { data, error } = await supabase.auth.refreshSession()

      if (error) {
        logger.error("会话刷新失败", { module: "SessionManager" }, error)
        this.handleSessionExpired()
        return
      }
      // 记录会话刷新事件
      await auditLogger.logEvent({
        action: "SESSION_REFRESHED",
        details: { refreshedAt: new Date().toISOString() },
      })
    } catch (error) {
      logger.error("会话刷新异常", { module: "SessionManager" }, error)
    }
  }

  /**
   * 初始化页面可见性检查
   */
  private initializeVisibilityCheck(): void {
    if (typeof document === "undefined") {
      return
    }

    let lastVisibilityChange = Date.now()

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        const timeAway = Date.now() - lastVisibilityChange

        // 如果离开时间超过30分钟，检查会话状态
        if (timeAway > 30 * 60 * 1000) {
          this.checkSessionStatus()
        }

        // 检查网络状态
        if (navigator.onLine) {
          this.checkSessionStatus()
        }
      } else {
        lastVisibilityChange = Date.now()
      }
    })
  }

  /**
   * 设置"记住我"功能
   */
  setRememberMe(remember: boolean): void {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("remember-me", remember.toString())
    }
  }

  /**
   * 获取"记住我"设置
   */
  getRememberMe(): boolean {
    if (typeof localStorage === "undefined") {
      return false
    }

    return localStorage.getItem("remember-me") === "true"
  }

  /**
   * 清除用户会话数据
   */
  private clearUserSession(): void {
    if (typeof localStorage !== "undefined") {
      // 保留"记住我"设置
      const rememberMe = this.getRememberMe()
      localStorage.clear()
      if (rememberMe) {
        this.setRememberMe(true)
      }
    }

    if (typeof sessionStorage !== "undefined") {
      sessionStorage.clear()
    }
  }

  /**
   * 销毁会话管理器
   */
  destroy(): void {
    if (this.broadcastChannel) {
      this.broadcastChannel.close()
      this.broadcastChannel = null
    }

    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval)
      this.sessionCheckInterval = null
    }
  }
}

/**
 * 网络重试管理器
 */
export class RetryManager {
  private static instance: RetryManager
  private retryQueue: Array<{
    id: string
    operation: () => Promise<any>
    config: RetryConfig
    attempts: number
    lastError?: Error
  }> = []

  static getInstance(): RetryManager {
    if (!RetryManager.instance) {
      RetryManager.instance = new RetryManager()
    }
    return RetryManager.instance
  }

  /**
   * 添加需要重试的操作
   */
  async addOperation<T>(operation: () => Promise<T>, config?: Partial<RetryConfig>): Promise<T> {
    const finalConfig: RetryConfig = {
      maxAttempts: 3,
      delay: 1000,
      backoff: "exponential",
      retryOnNetworkError: true,
      retryOnServerError: false,
      ...config,
    }

    return this.executeWithRetry(operation, finalConfig)
  }

  /**
   * 执行带重试机制的操作
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: RetryConfig,
    attempts: number = 0
  ): Promise<T> {
    try {
      return await operation()
    } catch (error) {
      const shouldRetry = this.shouldRetry(error, attempts, config)

      if (!shouldRetry) {
        throw error
      }

      // 计算延迟时间
      let delay = config.delay
      if (config.backoff === "exponential") {
        delay = config.delay * Math.pow(2, attempts)
      } else if (config.backoff === "linear") {
        delay = config.delay * (attempts + 1)
      }

      // 记录重试尝试
      await auditLogger.logEvent({
        action: "OPERATION_RETRY",
        details: {
          attempt: attempts + 1,
          maxAttempts: config.maxAttempts,
          delay,
          error: error instanceof Error ? error.message : String(error),
        },
      })

      // 等待后重试
      await new Promise((resolve) => setTimeout(resolve, delay))

      return this.executeWithRetry(operation, config, attempts + 1)
    }
  }

  /**
   * 判断是否应该重试
   */
  private shouldRetry(error: any, attempts: number, config: RetryConfig): boolean {
    // 检查最大尝试次数
    if (attempts >= config.maxAttempts - 1) {
      return false
    }

    // 检查错误类型
    if (error instanceof TypeError && error.message.includes("fetch")) {
      // 网络错误
      return config.retryOnNetworkError
    }

    if (error.status && error.status >= 500) {
      // 服务器错误
      return config.retryOnServerError
    }

    return false
  }
}

/**
 * 重试配置接口
 */
interface RetryConfig {
  maxAttempts: number
  delay: number
  backoff: "linear" | "exponential" | "fixed"
  retryOnNetworkError: boolean
  retryOnServerError: boolean
}

/**
 * 本地存储管理器
 */
export class StorageManager {
  /**
   * 安全地设置本地存储
   */
  static setItem(key: string, value: any, encrypt: boolean = false): void {
    try {
      if (typeof localStorage === "undefined") {
        return
      }

      let valueToStore = value

      if (typeof value === "object") {
        valueToStore = JSON.stringify(value)
      }

      if (encrypt) {
        // 简单的加密（在实际应用中应该使用更强的加密）
        valueToStore = btoa(valueToStore)
      }

      localStorage.setItem(key, valueToStore)
    } catch (error) {
      logger.error("存储失败", { module: "ClientStorage", key }, error)
    }
  }

  /**
   * 安全地获取本地存储
   */
  static getItem<T>(key: string, defaultValue?: T, decrypt: boolean = false): T | undefined {
    try {
      if (typeof localStorage === "undefined") {
        return defaultValue
      }

      let value = localStorage.getItem(key)

      if (value === null) {
        return defaultValue
      }

      if (decrypt) {
        try {
          value = atob(value)
        } catch (error) {
          logger.error("解密失败", { module: "ClientStorage", key }, error)
          return defaultValue
        }
      }

      // 尝试解析 JSON
      try {
        return JSON.parse(value) as T
      } catch {
        return value as T
      }
    } catch (error) {
      logger.error("读取存储失败", { module: "ClientStorage", key }, error)
      return defaultValue
    }
  }

  /**
   * 移除存储项
   */
  static removeItem(key: string): void {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(key)
      }
    } catch (error) {
      logger.error("移除存储失败", { module: "ClientStorage", key }, error)
    }
  }

  /**
   * 清除所有存储（保留重要设置）
   */
  static clearStorage(preserveKeys: string[] = ["remember-me", "theme"]): void {
    try {
      if (typeof localStorage === "undefined") {
        return
      }

      // 保存需要保留的数据
      const preserved: Record<string, any> = {}
      preserveKeys.forEach((key) => {
        const value = localStorage.getItem(key)
        if (value !== null) {
          preserved[key] = value
        }
      })

      // 清空存储
      localStorage.clear()

      // 恢复保留的数据
      Object.entries(preserved).forEach(([key, value]) => {
        localStorage.setItem(key, value)
      })
    } catch (error) {
      logger.error("清除存储失败", { module: "ClientStorage", preserveKeys }, error)
    }
  }
}

// 导出单例实例
export const sessionManager = SessionManager.getInstance()
export const retryManager = RetryManager.getInstance()
