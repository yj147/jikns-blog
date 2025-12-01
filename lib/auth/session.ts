/**
 * 统一认证会话管理
 * 单一事实来源：所有认证相关逻辑的核心模块
 */

import { createServerSupabaseClient } from "@/lib/supabase"
import { prisma } from "@/lib/prisma"
import { cache } from "react"
import { unstable_cache, revalidateTag } from "next/cache"
import { NextRequest } from "next/server"
import type { User, Role, UserStatus } from "@/lib/generated/prisma"
import { authLogger } from "@/lib/utils/logger"
import { performanceMonitor, MetricType } from "@/lib/performance-monitor"
import { buildSessionLogContext } from "@/lib/utils/auth-logging"
import { generateRequestId } from "@/lib/utils/request-id"

/**
 * 策略化守卫类型映射
 * 通过策略确保类型安全
 */
export type PolicyUserMap = {
  public: null
  any: AuthenticatedUser | null
  "user-active": AuthenticatedUser & { status: "ACTIVE" }
  admin: AuthenticatedUser & { role: "ADMIN"; status: "ACTIVE" }
}

export type AuthPolicy = keyof PolicyUserMap

/**
 * 认证用户类型
 * 统一的用户数据结构
 *
 * ✅ Linus "Simplicity" 原则：类型一致性
 * 使用 Prisma 枚举而非字符串字面量，确保类型严谨
 */
export interface AuthenticatedUser {
  id: string
  email: string | null
  role: Role
  status: UserStatus
  name: string | null
  avatarUrl: string | null
}

/**
 * 认证上下文
 * 携带请求元数据供审计和日志使用
 */
export interface AuthContext<P extends AuthPolicy = AuthPolicy> {
  user: PolicyUserMap[P]
  requestId: string
  ip: string | null
  ua: string | null
  path: string
  timestamp: Date
}

/**
 * 认证错误类
 * 统一的错误处理
 */
// 认证错误处理从统一模块导入
import {
  AuthError,
  AuthErrors,
  createAuthAuditEvent,
  type AuthAuditEvent,
  type AuthErrorCode,
} from "@/lib/error-handling/auth-error"

/**
 * Supabase Auth User 类型定义
 */
interface SupabaseUser {
  id: string
  email?: string | null
  user_metadata?: {
    full_name?: string
    avatar_url?: string
    name?: string
    user_name?: string
    picture?: string
  } | null
}

/**
 * 获取 Supabase 认证用户（底层函数）
 * 使用 React cache 优化，在同一请求中避免重复查询
 */

function isSupabaseSessionCookie(name?: string): boolean {
  if (!name || !name.startsWith("sb-")) return false
  return name.includes("-auth-token") || name.includes("-refresh-token")
}

async function hasSupabaseSessionCookie(request?: NextRequest): Promise<boolean> {
  try {
    if (request) {
      return request.cookies.getAll().some((cookie) => {
        if (!isSupabaseSessionCookie(cookie.name)) return false
        return cookie.value.length > 0
      })
    }

    const { cookies } = await import("next/headers")
    const cookieStore = await cookies()

    return cookieStore.getAll().some((cookie) => {
      if (!isSupabaseSessionCookie(cookie.name)) return false
      return cookie.value.length > 0
    })
  } catch (error) {
    authLogger.debug("检测 Supabase 会话 Cookie 失败，回退为强制查询", {
      error,
    })
    return true
  }
}

const getSupabaseUser = cache(async () => {
  const hasSession = await hasSupabaseSessionCookie()
  if (!hasSession) {
    authLogger.debug("未检测到 Supabase 认证 Cookie，跳过 getUser 查询")
    return null
  }

  const supabase = await createServerSupabaseClient()

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error) {
      const context = buildSessionLogContext()
      authLogger.error("获取Supabase用户失败", {
        ...context,
        error: error.message,
      })
      return null
    }

    return user
  } catch (error) {
    const context = buildSessionLogContext()
    authLogger.error("Supabase认证查询异常", {
      ...context,
      error,
    })
    return null
  }
})

/**
 * 从数据库获取用户信息（核心函数）
 */
async function fetchUserFromDatabase(userId: string): Promise<User | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    return user
  } catch (error) {
    const context = buildSessionLogContext(userId)
    authLogger.error("数据库用户查询失败", {
      ...context,
      error,
    })
    return null
  }
}

/**
 * 带缓存的用户查询（统一缓存策略）
 * 使用动态标签支持逐用户缓存失效
 *
 * ✅ Linus "Simplicity" 原则：类型应如其意
 * 返回完整的 User 对象，映射在 fetchAuthenticatedUser() 中完成
 */
async function getCachedUser(userId: string): Promise<User | null> {
  const cachedFn = unstable_cache(
    async () => fetchUserFromDatabase(userId),
    [`user-profile-${userId}`],
    {
      tags: ["user:self", `user:${userId}`],
      revalidate: 60, // 1分钟缓存（优化后：从 300 秒缩短到 60 秒）
    }
  )
  return cachedFn()
}

/**
 * 兼容旧版 API 的完整用户查询
 * 统一走缓存管线，避免重复命中数据库
 */
export async function fetchSessionUserProfile(): Promise<User | null> {
  const supabaseUser = await getSupabaseUser()

  if (!supabaseUser?.id) {
    return null
  }

  return getCachedUser(supabaseUser.id)
}

/**
 * 获取认证用户（统一入口）
 * Server Components 和 Server Actions 专用
 */
export const fetchAuthenticatedUser = cache(async (): Promise<AuthenticatedUser | null> => {
  const timerId = `auth-session-${Date.now()}-${Math.random().toString(16).slice(2)}`
  performanceMonitor.startTimer(timerId)

  let supabaseUserId: string | undefined
  let timerEnded = false
  const endTimer = (context: Record<string, any>) => {
    timerEnded = true
    performanceMonitor.endTimer(timerId, MetricType.AUTH_SESSION_CHECK_TIME, {
      userId: supabaseUserId ?? context.userId,
      ...context,
    })
  }

  try {
    const supabaseUser = await getSupabaseUser()

    if (!supabaseUser?.id) {
      endTimer({ success: true, userPresent: false })
      return null
    }

    supabaseUserId = supabaseUser.id

    const toAuthenticatedUser = (user: User): AuthenticatedUser => ({
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      name: user.name,
      avatarUrl: user.avatarUrl,
    })

    // 从数据库获取完整用户信息
    const dbUser = await getCachedUser(supabaseUser.id)

    if (dbUser) {
      const result = toAuthenticatedUser(dbUser)
      endTimer({
        success: true,
        userPresent: true,
        source: "database",
        userId: supabaseUserId,
      })
      return result
    }

    const context = buildSessionLogContext(supabaseUser.id)
    authLogger.warn("认证用户在数据库中不存在，尝试自愈同步", context)

    try {
      const syncedUser = await syncUserFromAuth({
        id: supabaseUser.id,
        email: supabaseUser.email,
        user_metadata: supabaseUser.user_metadata,
      })
      const result = toAuthenticatedUser(syncedUser)
      endTimer({
        success: true,
        userPresent: true,
        source: "sync",
        userId: supabaseUserId,
      })
      return result
    } catch (error) {
      endTimer({
        success: false,
        userPresent: true,
        source: "sync",
        userId: supabaseUserId,
        error: error instanceof Error ? error.message : "未知错误",
      })
      authLogger.error("自愈同步失败", {
        ...context,
        error,
      })
      return null
    }
  } finally {
    if (!timerEnded) {
      endTimer({ success: false, userPresent: false, source: "unexpected" })
    }
  }
})

export async function getOptionalViewer(options?: {
  request?: NextRequest
}): Promise<AuthenticatedUser | null> {
  const hasSession = await hasSupabaseSessionCookie(options?.request)
  if (!hasSession) {
    return null
  }

  return fetchAuthenticatedUser()
}

/**
 * 策略上下文接口
 * 包含策略验证所需的所有信息
 */
interface PolicyContext {
  path: string
  ip?: string | null
  ua?: string | null
  requestId: string
  timestamp: Date
  user: AuthenticatedUser | null
}

/**
 * 策略处理器接口
 * 每个策略实现统一的处理逻辑
 * 支持异步处理器以实现按需查询
 */
type PolicyHandler<P extends AuthPolicy> = (
  ctx: PolicyContext
) => [PolicyUserMap[P], AuthError | null] | Promise<[PolicyUserMap[P], AuthError | null]>

/**
 * 统一的审计日志记录
 */
function logPolicyResult(
  policy: AuthPolicy,
  ctx: PolicyContext,
  result: AuthenticatedUser | null,
  error: AuthError | null,
  metadata?: Record<string, any>
): void {
  const auditContext = {
    requestId: ctx.requestId,
    timestamp: ctx.timestamp,
    path: ctx.path,
    ip: ctx.ip || undefined,
    userAgent: ctx.ua || undefined,
    policy,
    userId: ctx.user?.id,
    userEmail: ctx.user?.email,
    userRole: ctx.user?.role,
  }

  if (error) {
    createAuthAuditEvent({
      ...auditContext,
      event: error.code === "UNAUTHORIZED" ? "auth_failure" : "permission_denied",
      errorCode: error.code,
      errorMessage: error.message,
      requiredPermission: policy === "admin" ? "ADMIN" : undefined,
      metadata,
    })

    authLogger.warn(`策略验证失败: ${policy}`, {
      requestId: ctx.requestId,
      path: ctx.path,
      ip: ctx.ip,
      policy,
      errorCode: error.code,
      timestamp: ctx.timestamp.toISOString(),
    })
  } else {
    createAuthAuditEvent({
      ...auditContext,
      event: "auth_success",
      metadata: { policyType: policy, ...metadata },
    })
  }
}

/**
 * public策略处理器：不需要认证
 */
const handlePublicPolicy: PolicyHandler<"public"> = (ctx) => {
  logPolicyResult("public", ctx, null, null, { authRequired: false })
  return [null, null]
}

/**
 * any策略处理器：允许任何用户（包括未登录）
 */
const handleAnyPolicy: PolicyHandler<"any"> = async (ctx) => {
  const user = await fetchAuthenticatedUser()
  const updatedCtx = { ...ctx, user }
  logPolicyResult("any", updatedCtx, user, null, { userPresent: !!user })
  return [user, null]
}

/**
 * admin策略处理器：需要管理员权限和活跃状态
 */
const handleAdminPolicy: PolicyHandler<"admin"> = async (ctx) => {
  const { requestId, path } = ctx
  const user = await fetchAuthenticatedUser()
  const updatedCtx = { ...ctx, user }

  if (!user) {
    const error = AuthErrors.unauthorized({ requestId, path })
    logPolicyResult("admin", updatedCtx, null, error, { reason: "no_user_session" })
    return [null as unknown as PolicyUserMap["admin"], error]
  }

  if (user.role !== "ADMIN") {
    const error = AuthErrors.forbidden("需要管理员权限", { requestId, userId: user.id, path })
    logPolicyResult("admin", updatedCtx, null, error, {
      userRole: user.role,
      reason: "insufficient_role",
    })
    return [null as unknown as PolicyUserMap["admin"], error]
  }

  if (user.status !== "ACTIVE") {
    const error = AuthErrors.accountBanned({ requestId, userId: user.id })
    logPolicyResult("admin", updatedCtx, null, error, {
      userStatus: user.status,
      reason: "inactive_account",
    })
    return [null as unknown as PolicyUserMap["admin"], error]
  }

  logPolicyResult("admin", updatedCtx, user, null, { adminAccess: true })
  return [user as PolicyUserMap["admin"], null]
}

/**
 * user-active策略处理器：需要活跃状态的用户
 */
const handleActivePolicy: PolicyHandler<"user-active"> = async (ctx) => {
  const { requestId, path } = ctx
  const user = await fetchAuthenticatedUser()
  const updatedCtx = { ...ctx, user }

  if (!user) {
    const error = AuthErrors.unauthorized({ requestId, path })
    logPolicyResult("user-active", updatedCtx, null, error, { reason: "no_user_session" })
    return [null as unknown as PolicyUserMap["user-active"], error]
  }

  if (user.status !== "ACTIVE") {
    const error = AuthErrors.accountBanned({ requestId, userId: user.id })
    logPolicyResult("user-active", updatedCtx, null, error, {
      userStatus: user.status,
      reason: "inactive_user_account",
    })
    return [null as unknown as PolicyUserMap["user-active"], error]
  }

  logPolicyResult("user-active", updatedCtx, user, null, { userActive: true })
  return [user as PolicyUserMap["user-active"], null]
}

/**
 * 策略处理器映射表
 * Linus原则：使用Map消除if-else链，O(1)查找
 */
const POLICY_HANDLERS = new Map<AuthPolicy, PolicyHandler<any>>([
  ["public", handlePublicPolicy],
  ["any", handleAnyPolicy],
  ["admin", handleAdminPolicy],
  ["user-active", handleActivePolicy],
])

/**
 * 断言策略权限（重构版）
 * 使用策略Map替代if-else链，从171行简化到30行
 *
 * Linus原则：
 * - 消除特殊情况：用策略Map统一处理
 * - 短小函数：主函数<30行
 * - 好品味：O(1)查找替代O(n)判断
 * - 性能优化：按需查询用户信息，public/any 策略不执行数据库查询
 */
export async function assertPolicy<P extends AuthPolicy>(
  policy: P,
  context: { path: string; ip?: string; ua?: string; requestId?: string }
): Promise<[PolicyUserMap[P], AuthError | null]> {
  const { path, ip = null, ua = null, requestId = generateRequestId() } = context

  const policyContext: PolicyContext = {
    path,
    ip,
    ua,
    requestId,
    timestamp: new Date(),
    user: null, // 策略处理器内部按需查询
  }

  const handler = POLICY_HANDLERS.get(policy)

  if (!handler) {
    const error = AuthErrors.forbidden("无效的权限策略", { requestId, path })
    logPolicyResult(policy, policyContext, null, error, {
      unknownPolicy: policy,
      reason: "invalid_policy",
    })
    return [null as PolicyUserMap[P], error]
  }

  return handler(policyContext)
}

export async function requireAdmin(request?: NextRequest): Promise<PolicyUserMap["admin"]> {
  const path = request?.nextUrl.pathname ?? "auth:session:requireAdmin"
  const ip =
    request?.headers.get("x-forwarded-for") ?? request?.headers.get("x-real-ip") ?? undefined
  const ua = request?.headers.get("user-agent") ?? undefined
  const requestId = request?.headers.get("x-request-id") ?? undefined

  const [user, error] = await assertPolicy("admin", { path, ip, ua, requestId })

  if (!user || error) {
    throw error ?? AuthErrors.forbidden("需要管理员权限", { path, requestId })
  }

  return user
}

// Re-export generateRequestId from unified module
export { generateRequestId } from "@/lib/utils/request-id"

/**
 * 创建认证上下文
 */
export function createAuthContext<P extends AuthPolicy>(
  user: PolicyUserMap[P],
  request: NextRequest,
  requestId?: string
): AuthContext<P> {
  return {
    user,
    requestId: requestId || generateRequestId(),
    ip: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null,
    ua: request.headers.get("user-agent") || null,
    path: request.nextUrl.pathname,
    timestamp: new Date(),
  }
}

/**
 * 用户资料同步（从 Supabase 到数据库）
 * 使用 upsert 简化数据同步，消除竞态条件
 *
 * Linus 原则：消除特殊情况，使用数据库的原子操作
 * 删除了 Database Trigger，只使用业务代码的 upsert
 */
export async function syncUserFromAuth(authUser: SupabaseUser): Promise<User> {
  if (!authUser.email) {
    throw new AuthError("用户邮箱不能为空", "INVALID_TOKEN")
  }

  const currentTime = new Date()

  // 从 metadata 提取用户信息
  const extractedName =
    authUser.user_metadata?.full_name ||
    authUser.user_metadata?.name ||
    authUser.user_metadata?.user_name ||
    authUser.email.split("@")[0]

  const extractedAvatarUrl =
    authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || null

  try {
    const normalizedEmail = authUser.email.toLowerCase()

    // 使用 upsert 原子操作：一次调用处理创建和更新两种情况
    // 无需先查询再判断，避免竞态条件
    const user = await prisma.user.upsert({
      where: { id: authUser.id },
      create: {
        id: authUser.id,
        email: normalizedEmail,
        name: extractedName,
        avatarUrl: extractedAvatarUrl,
        role: "USER",
        status: "ACTIVE",
        createdAt: currentTime,
        updatedAt: currentTime,
        lastLoginAt: currentTime,
      },
      update: {
        lastLoginAt: currentTime,
        updatedAt: currentTime,
        // ✅ Linus "Never break userspace" 原则：
        // 只更新 lastLoginAt，不覆盖用户可编辑字段（name, avatarUrl, bio, socialLinks）
        // 用户自定义的昵称和头像必须保留
      },
    })

    // 清除缓存，确保下次查询获取最新数据
    // 这是关键步骤：登录后用户资料可能已更新（如 GitHub 昵称变更）
    // 必须清除缓存，否则用户会看到旧数据（最长 5 分钟）
    await clearUserCache(user.id)

    const context = buildSessionLogContext(user.id)
    authLogger.info("用户资料同步成功", {
      ...context,
      email: user.email,
    })
    return user
  } catch (error) {
    const context = buildSessionLogContext(authUser.id)
    authLogger.error("用户资料同步失败", {
      ...context,
      error,
    })
    throw new AuthError("用户资料同步失败", "INVALID_TOKEN", 500)
  }
}

/**
 * 清除用户缓存
 *
 * ✅ Linus "Never break userspace" + "Pragmatism" 原则：
 * 缓存失效失败不应阻断核心业务流程（登录/注册/更新）
 * 缓存是优化手段，不是核心功能，失败时仅记录错误
 */
export async function clearUserCache(userId?: string) {
  const context = buildSessionLogContext(userId)
  try {
    if (userId) {
      revalidateTag(`user:${userId}`)
    }
    revalidateTag("user:self")
    authLogger.info("清除用户缓存", context)
  } catch (error) {
    // ✅ 仅记录错误，不向上抛出
    // 缓存失效失败不应影响业务流程（登录/注册/更新）
    authLogger.error("清除用户缓存失败（不影响业务流程）", {
      ...context,
      error,
    })
    // ❌ 不再 throw error
  }
}
