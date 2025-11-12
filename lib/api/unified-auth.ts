/**
 * 统一认证策略工具
 * 为 API 路由提供一致的认证和权限验证
 * 现已集成新的 session 模块和策略化类型系统
 */

import { NextRequest, NextResponse } from "next/server"
import {
  fetchAuthenticatedUser,
  assertPolicy,
  createAuthContext,
  generateRequestId,
  type AuthPolicy,
  type PolicyUserMap,
  type AuthContext,
  type AuthenticatedUser,
} from "@/lib/auth/session"
import { createAuthAuditEvent, type AuthAuditEvent } from "@/lib/error-handling/auth-error"
import { createErrorResponse, ErrorCode } from "@/lib/api/unified-response"
import { authLogger } from "@/lib/utils/logger"

// 兼容性导出
export type { AuthPolicy, AuthenticatedUser, AuthContext }
export type RouteUser = AuthenticatedUser

/**
 * 获取当前用户（兼容旧API）
 * @deprecated 使用 fetchAuthenticatedUser 替代
 */
export const getCurrentUser = fetchAuthenticatedUser

/**
 * API 路由认证中间件（函数重载实现类型收敛）
 */
export async function withApiAuth<T = NextResponse>(
  request: NextRequest,
  policy: "public",
  handler: (ctx: AuthContext<"public">) => Promise<T>
): Promise<T>

export async function withApiAuth<T = NextResponse>(
  request: NextRequest,
  policy: "any",
  handler: (ctx: AuthContext<"any">) => Promise<T>
): Promise<T>

export async function withApiAuth<T = NextResponse>(
  request: NextRequest,
  policy: "user-active",
  handler: (ctx: AuthContext<"user-active">) => Promise<T>
): Promise<T | NextResponse>

export async function withApiAuth<T = NextResponse>(
  request: NextRequest,
  policy: "admin",
  handler: (ctx: AuthContext<"admin">) => Promise<T>
): Promise<T | NextResponse>

// 实现函数
export async function withApiAuth<T = NextResponse, P extends AuthPolicy = AuthPolicy>(
  request: NextRequest,
  policy: P,
  handler: (ctx: AuthContext<P>) => Promise<T>
): Promise<T | NextResponse> {
  const requestId = generateRequestId()
  const path = request.nextUrl.pathname
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null
  const ua = request.headers.get("user-agent") || null

  // 使用新的 assertPolicy 函数，传递 requestId
  const [user, error] = await assertPolicy(policy, {
    path,
    ip: ip || undefined,
    ua: ua || undefined,
    requestId,
  })

  // 如果有错误，返回错误响应
  if (error) {
    authLogger.warn(`认证失败 - ${policy} 策略`, {
      requestId,
      path,
      ip,
      code: error.code,
      message: error.message,
    })

    return createErrorResponse(
      error.code === "UNAUTHORIZED" ? ErrorCode.UNAUTHORIZED : ErrorCode.FORBIDDEN,
      error.message,
      { requestId }
    ) as any
  }

  // 创建认证上下文
  const context = createAuthContext(user as PolicyUserMap[P], request, requestId)

  // 记录成功的认证
  if (policy !== "public") {
    authLogger.info(`认证成功 - ${policy} 策略`, {
      requestId,
      userId: context.user?.id,
      path,
      ip,
    })
  }

  // 通过认证，执行处理函数
  return handler(context)
}

/**
 * 旧版 API 兼容层（弃用 - 保持向后兼容）
 * @deprecated 使用新的 withApiAuth 重载版本替代
 *
 * 迁移指南：
 * - 新代码应直接使用 withApiAuth(request, policy, (ctx) => handler(ctx))
 * - 旧代码可继续使用此函数，但建议迁移到新版本
 * - 此函数将在未来版本中移除
 *
 * @param request NextRequest 对象
 * @param policy 认证策略
 * @param handler 处理函数，接收用户对象而非完整上下文
 * @returns 处理结果或错误响应
 */
export async function withApiAuthLegacy<T = NextResponse>(
  request: NextRequest,
  policy: AuthPolicy,
  handler: (user: RouteUser | null) => Promise<T>
): Promise<T | NextResponse> {
  // 使用新的 withApiAuth，但提供兼容的处理函数
  return withApiAuth(request, policy as any, async (ctx: AuthContext<any>) => {
    return handler(ctx.user)
  })
}

/**
 * Server Action 认证装饰器
 * 用于保护 Server Actions
 */
export function requireAuth(policy: AuthPolicy = "user-active") {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const [user, error] = await assertPolicy(policy, {
        path: `ServerAction:${propertyName}`,
      })

      // 检查认证错误
      if (error) {
        throw error
      }

      // 在方法的 this 上下文中注入用户信息
      const context = { ...this, user }

      // 执行原始方法
      return originalMethod.apply(context, args)
    }

    return descriptor
  }
}

/**
 * 快捷认证检查函数
 */
export async function checkAuth(
  policy: AuthPolicy = "user-active"
): Promise<AuthenticatedUser | null> {
  const [user, error] = await assertPolicy(policy, { path: "checkAuth" })

  if (error) {
    return null
  }

  return user as AuthenticatedUser
}

/**
 * 创建审计日志
 */
export async function createAuditLog(
  user: AuthenticatedUser | null,
  action: string,
  resource: string,
  details?: any,
  context?: {
    requestId?: string
    path?: string
    ip?: string
  }
) {
  try {
    authLogger.info("审计日志", {
      requestId: context?.requestId || "unknown",
      path: context?.path || "unknown",
      ip: context?.ip || "unknown",
      userId: user?.id || "anonymous",
      action,
      resource,
      details,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    authLogger.error("创建审计日志失败", error)
  }
}
