/**
 * API 权限守卫工具
 * 为 API 路由和 Server Actions 提供统一的权限验证
 */

import { NextRequest, NextResponse } from "next/server"
import { validateApiPermissions, createPermissionError } from "@/lib/permissions"
import type { User } from "@/lib/generated/prisma"
import { logger } from "@/lib/utils/logger"
import { getClientIp } from "@/lib/api/get-client-ip"

/**
 * API 响应类型
 */
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    message: string
    code: string
    statusCode: number
    timestamp: string
  }
  meta?: {
    requestId?: string
    timestamp: string
    user?: Partial<User>
  }
}

/**
 * 权限级别枚举
 */
export type PermissionLevel = "public" | "auth" | "admin"

/**
 * 创建成功响应
 */
export function createSuccessResponse<T>(
  data: T,
  user?: User,
  requestId?: string
): NextResponse<ApiResponse<T>> {
  const response: ApiResponse<T> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...(requestId && { requestId }),
      ...(user && {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          status: user.status,
        },
      }),
    },
  }

  return NextResponse.json(response, { status: 200 })
}

/**
 * 创建错误响应
 */
export function createErrorResponse(
  message: string,
  code: string,
  statusCode: number = 500,
  requestId?: string
): NextResponse<ApiResponse> {
  const response: ApiResponse = {
    success: false,
    error: {
      message,
      code,
      statusCode,
      timestamp: new Date().toISOString(),
    },
    meta: {
      timestamp: new Date().toISOString(),
      ...(requestId && { requestId }),
    },
  }

  return NextResponse.json(response, { status: statusCode })
}

/**
 * API 权限守卫装饰器
 * 用于包装 API 路由处理函数
 */
export function withApiAuth(
  handler: (request: NextRequest, user: User, context?: any) => Promise<NextResponse>,
  permissionLevel: PermissionLevel = "auth"
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    const requestId = crypto.randomUUID()

    try {
      // 公开 API 无需权限验证
      if (permissionLevel === "public") {
        return handler(request, null as any, context)
      }

      // 验证权限
      const permissionResult = await validateApiPermissions(request, permissionLevel)

      if (!permissionResult.success) {
        const error = permissionResult.error
        return NextResponse.json(
          {
            success: false,
            error,
            meta: {
              requestId,
              timestamp: new Date().toISOString(),
            },
          },
          { status: error.statusCode }
        )
      }

      // 权限验证通过，执行处理函数
      return handler(request, permissionResult.user!, context)
    } catch (error) {
      logger.error("API 错误", { requestId }, error)

      return createErrorResponse("服务器内部错误", "INTERNAL_SERVER_ERROR", 500, requestId)
    }
  }
}

/**
 * Server Action 权限守卫
 * 用于包装 Server Actions
 */
export function withServerActionAuth<TArgs extends any[], TReturn>(
  action: (user: User, ...args: TArgs) => Promise<TReturn>,
  permissionLevel: PermissionLevel = "auth"
) {
  return async (...args: TArgs): Promise<TReturn> => {
    try {
      // 公开 Action 无需权限验证
      if (permissionLevel === "public") {
        return action(null as any, ...args)
      }

      // 模拟请求对象进行权限验证
      const mockRequest = {
        headers: new Headers(),
        cookies: {},
        nextUrl: { pathname: "/api/action" },
        method: "POST",
      } as unknown as NextRequest

      const permissionResult = await validateApiPermissions(mockRequest, permissionLevel)

      if (!permissionResult.success) {
        const error = permissionResult.error
        throw new Error(error.error)
      }

      // 权限验证通过，执行 Action
      return action(permissionResult.user!, ...args)
    } catch (error) {
      logger.error("Server Action 错误", {}, error)
      throw error
    }
  }
}

/**
 * 批量权限检查结果
 */
export interface BatchPermissionResult {
  userId: string
  permissions: Record<string, boolean>
  user: User
}

/**
 * 批量权限检查（用于复杂权限验证场景）
 */
export async function batchPermissionCheck(
  request: NextRequest,
  permissions: string[]
): Promise<{ success: boolean; result?: BatchPermissionResult; error?: any }> {
  try {
    // 先进行基础认证检查
    const authResult = await validateApiPermissions(request, "auth")

    if (!authResult.success) {
      return { success: false, error: authResult.error }
    }

    const user = authResult.user!
    const permissionResults: Record<string, boolean> = {}

    // 检查每个权限
    for (const permission of permissions) {
      if (permission === "admin") {
        permissionResults[permission] = user.role === "ADMIN" && user.status === "ACTIVE"
      } else if (permission === "active") {
        permissionResults[permission] = user.status === "ACTIVE"
      } else if (permission.includes(":")) {
        // 操作:资源 格式的权限检查
        const [action, resource] = permission.split(":")
        permissionResults[permission] = await checkResourcePermission(user, action, resource)
      } else {
        // 其他自定义权限检查
        permissionResults[permission] = await checkCustomPermission(user, permission)
      }
    }

    return {
      success: true,
      result: {
        userId: user.id,
        permissions: permissionResults,
        user,
      },
    }
  } catch (error) {
    logger.error("批量权限检查错误", {}, error)
    return {
      success: false,
      error: {
        error: "权限检查失败",
        code: "BATCH_PERMISSION_CHECK_FAILED",
        statusCode: 500,
        timestamp: new Date().toISOString(),
      },
    }
  }
}

/**
 * 检查资源权限
 */
async function checkResourcePermission(
  user: User,
  action: string,
  resource: string
): Promise<boolean> {
  const isAdmin = user.role === "ADMIN" && user.status === "ACTIVE"
  const isActive = user.status === "ACTIVE"

  switch (action) {
    case "create":
    case "edit":
    case "delete":
      if (resource === "post") return isAdmin
      if (resource === "comment") return isActive
      break

    case "manage":
      if (resource === "user") return isAdmin
      break

    case "view":
      if (resource === "admin") return isAdmin
      if (resource === "profile") return isActive
      break

    default:
      return false
  }

  return false
}

/**
 * 检查自定义权限
 */
async function checkCustomPermission(user: User, permission: string): Promise<boolean> {
  const isAdmin = user.role === "ADMIN" && user.status === "ACTIVE"
  const isActive = user.status === "ACTIVE"

  switch (permission) {
    case "can_create_post":
    case "can_manage_posts":
    case "can_manage_users":
    case "can_access_admin":
      return isAdmin

    case "can_comment":
    case "can_like":
    case "can_follow":
      return isActive

    default:
      return false
  }
}

/**
 * API 限流装饰器
 * 与权限检查结合的限流控制
 */
export function withRateLimit(
  handler: (request: NextRequest, user?: User, context?: any) => Promise<NextResponse>,
  options: {
    requests: number
    window: number // 毫秒
    skipAuth?: boolean
    permissionLevel?: PermissionLevel
  } = { requests: 100, window: 15 * 60 * 1000 }
) {
  const requests = new Map<string, { count: number; resetTime: number }>()

  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    const requestId = crypto.randomUUID()

    try {
      // 获取客户端标识符
      const clientId = getClientIp(request)

      // 检查限流
      const now = Date.now()
      const record = requests.get(clientId)

      if (record && now <= record.resetTime) {
        if (record.count >= options.requests) {
          return createErrorResponse("请求过于频繁，请稍后重试", "RATE_LIMITED", 429, requestId)
        }
        record.count++
      } else {
        requests.set(clientId, {
          count: 1,
          resetTime: now + options.window,
        })
      }

      // 如果需要权限验证
      if (!options.skipAuth && options.permissionLevel !== "public") {
        const permissionLevel = options.permissionLevel || "auth"
        const permissionResult = await validateApiPermissions(request, permissionLevel)

        if (!permissionResult.success) {
          return NextResponse.json(
            {
              success: false,
              error: permissionResult.error,
              meta: { requestId, timestamp: new Date().toISOString() },
            },
            { status: permissionResult.error.statusCode }
          )
        }

        return handler(request, permissionResult.user, context)
      }

      // 无需权限验证或跳过认证
      return handler(request, undefined, context)
    } catch (error) {
      logger.error("API 限流错误", { requestId }, error)
      return createErrorResponse("服务器内部错误", "INTERNAL_SERVER_ERROR", 500, requestId)
    }
  }
}

/**
 * CORS 处理装饰器
 */
export function withCORS(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>,
  options: {
    origins?: string[]
    methods?: string[]
    headers?: string[]
    credentials?: boolean
  } = {}
) {
  const defaultOptions = {
    origins: [process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    headers: ["Content-Type", "Authorization", "X-CSRF-Token"],
    credentials: true,
    ...options,
  }

  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    // 处理预检请求
    if (request.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": defaultOptions.origins.join(", "),
          "Access-Control-Allow-Methods": defaultOptions.methods.join(", "),
          "Access-Control-Allow-Headers": defaultOptions.headers.join(", "),
          "Access-Control-Allow-Credentials": defaultOptions.credentials.toString(),
          "Access-Control-Max-Age": "86400", // 24小时
        },
      })
    }

    // 执行实际处理
    const response = await handler(request, context)

    // 添加 CORS 头部
    response.headers.set("Access-Control-Allow-Origin", defaultOptions.origins.join(", "))
    response.headers.set("Access-Control-Allow-Credentials", defaultOptions.credentials.toString())

    return response
  }
}

/**
 * API 组合装饰器
 * 将多个装饰器组合在一起
 */
export function withApiMiddleware(
  handler: (request: NextRequest, user?: User, context?: any) => Promise<NextResponse>,
  options: {
    permissionLevel?: PermissionLevel
    rateLimit?: { requests: number; window: number }
    cors?: { origins?: string[]; methods?: string[]; headers?: string[]; credentials?: boolean }
  } = {}
) {
  let wrappedHandler = handler

  // 应用权限守卫
  if (options.permissionLevel) {
    wrappedHandler = withApiAuth(wrappedHandler as any, options.permissionLevel)
  }

  // 应用限流
  if (options.rateLimit) {
    wrappedHandler = withRateLimit(wrappedHandler, {
      ...options.rateLimit,
      skipAuth: true, // 已经在权限守卫中处理了认证
      permissionLevel: options.permissionLevel,
    })
  }

  // 应用 CORS
  if (options.cors) {
    wrappedHandler = withCORS(wrappedHandler as any, options.cors)
  }

  return wrappedHandler
}
