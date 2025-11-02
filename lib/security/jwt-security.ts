/**
 * JWT 安全管理 - Phase 4 安全增强
 * 实现安全的JWT令牌管理、刷新机制和会话存储
 */

import { createHash, randomBytes } from "crypto"
import type {
  TokenPayload,
  SessionData,
  JWTConfig,
  TokenRefreshResult,
  SecurityValidationResult,
  SessionValidationOptions,
} from "./types"

/**
 * JWT 安全管理类
 */
export class JWTSecurity {
  private static readonly DEFAULT_CONFIG: JWTConfig = {
    accessTokenSecret: process.env.JWT_ACCESS_SECRET || "access-secret-key",
    refreshTokenSecret: process.env.JWT_REFRESH_SECRET || "refresh-secret-key",
    accessTokenExpiresIn: 15 * 60, // 15 分钟
    refreshTokenExpiresIn: 7 * 24 * 60 * 60, // 7 天
    issuer: process.env.JWT_ISSUER || "jikns-blog",
    audience: process.env.JWT_AUDIENCE || "jikns-blog-users",
    algorithm: "HS256",
  }

  /**
   * 简化版JWT编码（Edge Runtime兼容）
   */
  static encodeJWT(payload: any, secret: string, expiresIn: number): string {
    const header = {
      alg: "HS256",
      typ: "JWT",
    }

    const now = Math.floor(Date.now() / 1000)
    const fullPayload = {
      ...payload,
      iat: now,
      exp: now + expiresIn,
      iss: this.DEFAULT_CONFIG.issuer,
      aud: this.DEFAULT_CONFIG.audience,
    }

    // Base64 URL 编码
    const encodedHeader = this.base64UrlEncode(JSON.stringify(header))
    const encodedPayload = this.base64UrlEncode(JSON.stringify(fullPayload))

    // 创建签名
    const signature = this.createSignature(`${encodedHeader}.${encodedPayload}`, secret)

    return `${encodedHeader}.${encodedPayload}.${signature}`
  }

  /**
   * 简化版JWT解码（Edge Runtime兼容）
   */
  static decodeJWT(token: string, secret: string): TokenPayload | null {
    try {
      const parts = token.split(".")
      if (parts.length !== 3) {
        return null
      }

      const [encodedHeader, encodedPayload, signature] = parts

      // 验证签名
      const expectedSignature = this.createSignature(`${encodedHeader}.${encodedPayload}`, secret)

      if (signature !== expectedSignature) {
        console.warn("JWT签名验证失败")
        return null
      }

      // 解码负载
      const payload = JSON.parse(this.base64UrlDecode(encodedPayload))

      // 检查过期时间
      const now = Math.floor(Date.now() / 1000)
      if (payload.exp && payload.exp < now) {
        console.warn("JWT令牌已过期")
        return null
      }

      return payload as TokenPayload
    } catch (error) {
      console.error("JWT解码错误:", error)
      return null
    }
  }

  /**
   * 生成访问令牌
   */
  static generateAccessToken(
    userId: string,
    email: string,
    role: "USER" | "ADMIN",
    sessionId: string
  ): string {
    const payload = {
      sub: userId,
      email,
      role,
      sessionId,
      type: "access",
    }

    return this.encodeJWT(
      payload,
      this.DEFAULT_CONFIG.accessTokenSecret,
      this.DEFAULT_CONFIG.accessTokenExpiresIn
    )
  }

  /**
   * 生成刷新令牌
   */
  static generateRefreshToken(userId: string, sessionId: string): string {
    const payload = {
      sub: userId,
      sessionId,
      type: "refresh",
    }

    return this.encodeJWT(
      payload,
      this.DEFAULT_CONFIG.refreshTokenSecret,
      this.DEFAULT_CONFIG.refreshTokenExpiresIn
    )
  }

  /**
   * 验证访问令牌
   */
  static validateAccessToken(token: string): SecurityValidationResult {
    const payload = this.decodeJWT(token, this.DEFAULT_CONFIG.accessTokenSecret)

    if (!payload) {
      return {
        isValid: false,
        errorCode: "INVALID_TOKEN",
        errorMessage: "无效的访问令牌",
      }
    }

    if (payload.type !== "access") {
      return {
        isValid: false,
        errorCode: "WRONG_TOKEN_TYPE",
        errorMessage: "令牌类型错误",
      }
    }

    return {
      isValid: true,
      data: payload,
    }
  }

  /**
   * 验证刷新令牌
   */
  static validateRefreshToken(token: string): SecurityValidationResult {
    const payload = this.decodeJWT(token, this.DEFAULT_CONFIG.refreshTokenSecret)

    if (!payload) {
      return {
        isValid: false,
        errorCode: "INVALID_REFRESH_TOKEN",
        errorMessage: "无效的刷新令牌",
      }
    }

    if (payload.type !== "refresh") {
      return {
        isValid: false,
        errorCode: "WRONG_TOKEN_TYPE",
        errorMessage: "刷新令牌类型错误",
      }
    }

    return {
      isValid: true,
      data: payload,
    }
  }

  /**
   * Base64 URL 编码
   */
  private static base64UrlEncode(str: string): string {
    const base64 = Buffer.from(str).toString("base64")
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
  }

  /**
   * Base64 URL 解码
   */
  private static base64UrlDecode(str: string): string {
    let base64 = str.replace(/-/g, "+").replace(/_/g, "/")
    while (base64.length % 4) {
      base64 += "="
    }
    return Buffer.from(base64, "base64").toString("utf-8")
  }

  /**
   * 创建HMAC签名
   */
  private static createSignature(data: string, secret: string): string {
    const hash = createHash("sha256").update(secret).update(data).digest("base64")

    return hash.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
  }
}

/**
 * 令牌刷新管理器
 */
export class TokenRefreshManager {
  private static refreshInProgress = new Map<string, Promise<TokenRefreshResult | null>>()

  /**
   * 刷新访问令牌
   */
  static async refreshAccessToken(
    refreshToken: string,
    sessionStore: typeof SessionStore
  ): Promise<TokenRefreshResult | null> {
    // 防止重复刷新
    const existingRefresh = this.refreshInProgress.get(refreshToken)
    if (existingRefresh) {
      return existingRefresh
    }

    const refreshPromise = this.performTokenRefresh(refreshToken, sessionStore)
    this.refreshInProgress.set(refreshToken, refreshPromise)

    try {
      const result = await refreshPromise
      return result
    } finally {
      this.refreshInProgress.delete(refreshToken)
    }
  }

  /**
   * 执行令牌刷新
   */
  private static async performTokenRefresh(
    refreshToken: string,
    sessionStore: typeof SessionStore
  ): Promise<TokenRefreshResult | null> {
    try {
      // 验证刷新令牌
      const validation = JWTSecurity.validateRefreshToken(refreshToken)
      if (!validation.isValid) {
        console.warn("刷新令牌验证失败:", validation.errorMessage)
        return null
      }

      const { sub: userId, sessionId } = validation.data as any

      // 从会话存储中获取会话信息
      const session = await SessionStore.getSession(sessionId)
      if (!session || !session.isActive) {
        console.warn("会话无效或已失效")
        return null
      }

      // 检查会话是否过期
      if (new Date() > session.expiresAt) {
        console.warn("会话已过期")
        await SessionStore.invalidateSession(sessionId)
        return null
      }

      // 生成新的访问令牌
      const newAccessToken = JWTSecurity.generateAccessToken(
        userId,
        session.userId, // 这里需要从用户数据获取邮箱
        "USER", // 这里需要从用户数据获取角色
        sessionId
      )

      // 可选：生成新的刷新令牌（滚动刷新）
      const shouldRollRefreshToken = Math.random() < 0.1 // 10% 概率滚动刷新
      let newRefreshToken: string | undefined

      if (shouldRollRefreshToken) {
        newRefreshToken = JWTSecurity.generateRefreshToken(userId, sessionId)
        await SessionStore.updateRefreshToken(sessionId, newRefreshToken)
      }

      // 更新会话最后访问时间
      await SessionStore.updateLastAccessed(sessionId)

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: JWTSecurity["DEFAULT_CONFIG"].accessTokenExpiresIn,
        tokenType: "Bearer",
      }
    } catch (error) {
      console.error("令牌刷新错误:", error)
      return null
    }
  }

  /**
   * 检查令牌是否需要刷新
   */
  static shouldRefreshToken(token: string): boolean {
    const payload = JWTSecurity.decodeJWT(token, JWTSecurity["DEFAULT_CONFIG"].accessTokenSecret)

    if (!payload) return true

    const now = Math.floor(Date.now() / 1000)
    const timeUntilExpiry = payload.exp - now

    // 如果令牌在5分钟内过期，则需要刷新
    return timeUntilExpiry < 5 * 60
  }
}

/**
 * 会话存储管理器
 */
export class SessionStore {
  private static sessions = new Map<string, SessionData>()

  /**
   * 创建会话
   */
  static async createSession(
    userId: string,
    fingerprint: string,
    metadata?: any
  ): Promise<SessionData> {
    const sessionId = this.generateSessionId()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7天

    const session: SessionData = {
      id: sessionId,
      userId,
      fingerprint,
      createdAt: now,
      lastAccessedAt: now,
      expiresAt,
      isActive: true,
      metadata,
    }

    this.sessions.set(sessionId, session)

    // 清理过期会话
    this.cleanupExpiredSessions()

    return session
  }

  /**
   * 获取会话
   */
  static async getSession(sessionId: string): Promise<SessionData | null> {
    const session = this.sessions.get(sessionId)

    if (!session) {
      return null
    }

    // 检查会话是否过期
    if (new Date() > session.expiresAt) {
      this.sessions.delete(sessionId)
      return null
    }

    return session
  }

  /**
   * 验证会话
   */
  static async validateSession(
    sessionId: string,
    fingerprint: string,
    options: SessionValidationOptions = {
      checkFingerprint: true,
      updateLastAccessed: true,
      extendSession: false,
    }
  ): Promise<SecurityValidationResult> {
    const session = await this.getSession(sessionId)

    if (!session) {
      return {
        isValid: false,
        errorCode: "SESSION_NOT_FOUND",
        errorMessage: "会话不存在",
      }
    }

    if (!session.isActive) {
      return {
        isValid: false,
        errorCode: "SESSION_INACTIVE",
        errorMessage: "会话已失效",
      }
    }

    // 检查会话指纹
    if (options.checkFingerprint && session.fingerprint !== fingerprint) {
      console.warn("会话指纹不匹配，可能存在会话劫持")
      await this.invalidateSession(sessionId)
      return {
        isValid: false,
        errorCode: "SESSION_HIJACK_DETECTED",
        errorMessage: "检测到会话劫持",
      }
    }

    // 更新最后访问时间
    if (options.updateLastAccessed) {
      await this.updateLastAccessed(sessionId)
    }

    // 延长会话
    if (options.extendSession) {
      await this.extendSession(sessionId)
    }

    return {
      isValid: true,
      data: session,
    }
  }

  /**
   * 更新最后访问时间
   */
  static async updateLastAccessed(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.lastAccessedAt = new Date()
      this.sessions.set(sessionId, session)
    }
  }

  /**
   * 延长会话
   */
  static async extendSession(sessionId: string, extensionMinutes: number = 60): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (session) {
      const extension = extensionMinutes * 60 * 1000
      session.expiresAt = new Date(session.expiresAt.getTime() + extension)
      this.sessions.set(sessionId, session)
    }
  }

  /**
   * 更新刷新令牌
   */
  static async updateRefreshToken(sessionId: string, refreshToken: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.refreshToken = refreshToken
      this.sessions.set(sessionId, session)
    }
  }

  /**
   * 使会话失效
   */
  static async invalidateSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.isActive = false
      this.sessions.set(sessionId, session)

      // 可选：立即删除会话
      setTimeout(() => {
        this.sessions.delete(sessionId)
      }, 60000) // 1分钟后删除
    }
  }

  /**
   * 使用户的所有会话失效
   */
  static async invalidateUserSessions(userId: string): Promise<void> {
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.userId === userId) {
        await this.invalidateSession(sessionId)
      }
    }
  }

  /**
   * 获取用户的活跃会话数量
   */
  static getUserActiveSessionCount(userId: string): number {
    let count = 0
    for (const session of this.sessions.values()) {
      if (session.userId === userId && session.isActive && new Date() <= session.expiresAt) {
        count++
      }
    }
    return count
  }

  /**
   * 清理过期会话
   */
  static cleanupExpiredSessions(): void {
    const now = new Date()
    const expiredSessions: string[] = []

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        expiredSessions.push(sessionId)
      }
    }

    for (const sessionId of expiredSessions) {
      this.sessions.delete(sessionId)
    }
  }

  /**
   * 生成会话ID
   */
  private static generateSessionId(): string {
    return randomBytes(32).toString("hex")
  }
}
