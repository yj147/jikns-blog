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
import { getClientIp } from "@/lib/api/get-client-ip"

const isTestEnv = process.env.NODE_ENV === "test"
const isDevEnv = process.env.NODE_ENV === "development"

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
 * GitHub OAuth 会提供额外字段：bio, location, html_url 等
 *
 * 注意：user_metadata 在某些情况下可能不完整（如邮箱登录后再用 OAuth 登录），
 * 此时需要从 identities[].identity_data 中获取完整信息。
 */
interface OAuthIdentityData {
  avatar_url?: string
  full_name?: string
  name?: string
  user_name?: string
  preferred_username?: string
  picture?: string
  bio?: string
  location?: string
  html_url?: string
}

interface SupabaseUser {
  id: string
  email?: string | null
  user_metadata?: OAuthIdentityData | null
  // identities 数组包含每个 OAuth provider 的完整数据
  identities?: Array<{
    provider?: string
    identity_data?: OAuthIdentityData
  }> | null
}

const adminEmailList = (process.env.ADMIN_EMAIL || "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean)

export function isConfiguredAdminEmail(email?: string | null): boolean {
  if (!email) return false
  return adminEmailList.includes(email.toLowerCase())
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
  if (isTestEnv) return true

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

const getSupabaseUserImpl = async () => {
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
}

const getSupabaseUser = isTestEnv ? getSupabaseUserImpl : cache(getSupabaseUserImpl)

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
  // 在测试和开发环境下直接查询数据库，跳过 unstable_cache
  // 因为 dev 模式下 revalidateTag 的行为不稳定，导致用户资料更新后刷新页面看不到变化
  if (isTestEnv || isDevEnv) {
    return fetchUserFromDatabase(userId)
  }
  const cachedFn = unstable_cache(
    async () => fetchUserFromDatabase(userId),
    [`user-profile-${userId}`],
    {
      tags: ["user:self", `user:${userId}`],
      revalidate: 60, // 1分钟缓存
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
const fetchAuthenticatedUserImpl = async (): Promise<AuthenticatedUser | null> => {
  const timerId = isTestEnv
    ? null
    : `auth-session-${Date.now()}-${Math.random().toString(16).slice(2)}`
  if (timerId) {
    performanceMonitor.startTimer(timerId)
  }

  let supabaseUserId: string | undefined
  let timerEnded = false
  const endTimer = (context: Record<string, any>) => {
    if (!timerId) return
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
        identities: supabaseUser.identities,
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
    if (!timerEnded && timerId) {
      endTimer({ success: false, userPresent: false, source: "unexpected" })
    }
  }
}

export const fetchAuthenticatedUser = isTestEnv
  ? fetchAuthenticatedUserImpl
  : cache(fetchAuthenticatedUserImpl)

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
  const rawIp = request ? getClientIp(request) : undefined
  const ip = rawIp === "unknown" ? undefined : rawIp
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
  const ip = getClientIp(request)

  return {
    user,
    requestId: requestId || generateRequestId(),
    ip: ip === "unknown" ? null : ip,
    ua: request.headers.get("user-agent") || null,
    path: request.nextUrl.pathname,
    timestamp: new Date(),
  }
}

/**
 * 用户资料同步（从 Supabase 到数据库）
 *
 * 同步策略：
 * - 首次登录（create）：从 OAuth 填充所有可用字段
 * - 后续登录（update）：仅填充数据库中为空的字段，保留用户自定义资料
 *
 * 支持的 OAuth 字段映射：
 * - name: full_name / name / user_name
 * - avatarUrl: avatar_url / picture
 * - bio: bio
 * - location: location
 * - socialLinks: html_url (GitHub profile)
 *
 * Linus 原则：消除特殊情况，使用数据库的原子操作
 */
export async function syncUserFromAuth(authUser: SupabaseUser): Promise<User> {
  if (!authUser.email) {
    throw new AuthError("用户邮箱不能为空", "INVALID_TOKEN")
  }

  const currentTime = new Date()
  const normalizedEmail = authUser.email.toLowerCase()
  const grantAdmin = isConfiguredAdminEmail(normalizedEmail)
  const metadata = authUser.user_metadata

  // 调试日志：查看 GitHub OAuth 返回的原始 metadata
  authLogger.info("syncUserFromAuth: OAuth metadata 详情", {
    userId: authUser.id,
    email: normalizedEmail,
    metadataKeys: metadata ? Object.keys(metadata) : [],
    metadata: metadata,
    identitiesCount: authUser.identities?.length ?? 0,
    identities: authUser.identities?.map((i) => ({
      provider: i.provider,
      dataKeys: i.identity_data ? Object.keys(i.identity_data) : [],
    })),
  })

  // 优先从 identities 中获取 GitHub provider 的完整数据
  // 因为 user_metadata 在某些情况下可能不完整
  const githubIdentity = authUser.identities?.find((i) => i.provider === "github")
  const identityData = githubIdentity?.identity_data

  // 合并数据源：优先 identities，其次 user_metadata
  const mergedData = {
    full_name: identityData?.full_name || metadata?.full_name,
    name: identityData?.name || metadata?.name,
    user_name: identityData?.user_name || identityData?.preferred_username || metadata?.user_name,
    avatar_url: identityData?.avatar_url || metadata?.avatar_url || metadata?.picture,
    bio: identityData?.bio || metadata?.bio,
    location: identityData?.location || metadata?.location,
    html_url: identityData?.html_url || metadata?.html_url,
  }

  // 从合并后的数据提取用户信息
  const extractedName =
    mergedData.full_name || mergedData.name || mergedData.user_name || authUser.email.split("@")[0]

  const extractedAvatarUrl = mergedData.avatar_url || null

  authLogger.info("syncUserFromAuth: 提取的字段", {
    extractedName,
    extractedAvatarUrl,
    bio: mergedData.bio,
    location: mergedData.location,
    source: identityData ? "identities" : "user_metadata",
  })
  const extractedBio = mergedData.bio || null
  const extractedLocation = mergedData.location || null
  const extractedGitHubUrl = mergedData.html_url || null

  try {
    // 先查询现有用户，判断哪些字段需要更新
    const existingUser = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: { name: true, avatarUrl: true, bio: true, location: true, socialLinks: true },
    })

    if (!existingUser) {
      // 首次登录：创建用户，填充所有可用字段
      const socialLinks = extractedGitHubUrl ? { github: extractedGitHubUrl } : undefined

      const user = await prisma.user.create({
        data: {
          id: authUser.id,
          email: normalizedEmail,
          name: extractedName,
          avatarUrl: extractedAvatarUrl,
          bio: extractedBio,
          location: extractedLocation,
          socialLinks: socialLinks,
          role: grantAdmin ? "ADMIN" : "USER",
          status: "ACTIVE",
          createdAt: currentTime,
          updatedAt: currentTime,
          lastLoginAt: currentTime,
        },
      })

      await clearUserCache(user.id)

      const context = buildSessionLogContext(user.id)
      authLogger.info("新用户创建成功", {
        ...context,
        email: user.email,
        filledFields: ["name", "avatarUrl", "bio", "location", "socialLinks"].filter(
          (f) => user[f as keyof typeof user] !== null
        ),
        adminWhitelisted: grantAdmin,
      })

      return user
    }

    // 后续登录：仅更新空字段 + 登录时间
    // 所有字段（包括 avatarUrl）都采用相同策略：仅当数据库为空时填充
    // 这样用户手动上传的自定义头像不会被 OAuth 头像覆盖
    const updateData: Record<string, any> = {
      lastLoginAt: currentTime,
      updatedAt: currentTime,
      ...(grantAdmin ? { role: "ADMIN" as Role } : {}),
    }

    // avatarUrl 仅当数据库为空时填充（与其他字段保持一致策略）
    // 用户上传的自定义头像优先级高于 OAuth 头像
    if (!existingUser.avatarUrl && extractedAvatarUrl) {
      updateData.avatarUrl = extractedAvatarUrl
    }
    // 其他字段仅当数据库为空时填充
    if (!existingUser.name && extractedName) {
      updateData.name = extractedName
    }
    if (!existingUser.bio && extractedBio) {
      updateData.bio = extractedBio
    }
    if (!existingUser.location && extractedLocation) {
      updateData.location = extractedLocation
    }
    if (!existingUser.socialLinks && extractedGitHubUrl) {
      updateData.socialLinks = { github: extractedGitHubUrl }
    }

    const user = await prisma.user.update({
      where: { id: authUser.id },
      data: updateData,
    })

    await clearUserCache(user.id)

    const filledFields = Object.keys(updateData).filter(
      (k) => k !== "lastLoginAt" && k !== "updatedAt"
    )
    const context = buildSessionLogContext(user.id)
    authLogger.info("用户资料同步成功", {
      ...context,
      email: user.email,
      updatedFields: filledFields.length > 0 ? filledFields : ["loginTime"],
      adminWhitelisted: grantAdmin,
      roleAfterSync: user.role,
    })

    return user
  } catch (error) {
    const context = buildSessionLogContext(authUser.id)
    authLogger.error("用户资料同步失败", {
      ...context,
      error,
    })
    const reason = error instanceof Error ? error.message : "未知错误"
    throw new AuthError(`用户资料同步失败: ${reason}`, "INVALID_TOKEN", 500)
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
