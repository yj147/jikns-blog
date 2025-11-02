/**
 * Next.js 15 中间件 - Phase 4 安全增强版
 * 实现企业级安全防护：权限控制、CSRF保护、XSS防护、JWT会话管理
 */

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
// 注意：中间件运行在 Edge Runtime，不能直接使用 Prisma
// import { prisma } from '@/lib/prisma'
import {
  setSecurityHeaders,
  validateRequestOrigin,
  RateLimiter,
  CSRFProtection,
  SessionSecurity,
} from "@/lib/security"
import {
  SecurityMiddleware,
  createSecurityContext,
  validateSecurityHeaders,
} from "@/lib/security/middleware"

// 权限缓存配置
interface UserPermissionCache {
  user: any
  timestamp: number
}

const permissionCache = new Map<string, UserPermissionCache>()
const CACHE_DURATION = 5 * 60 * 1000 // 5分钟缓存

/**
 * 路径权限配置
 */
const PATH_PERMISSIONS = {
  // 管理员专用路径
  admin: [
    "/admin",
    "/admin/dashboard",
    "/admin/users",
    "/admin/posts",
    "/admin/settings",
    "/api/admin",
  ],

  // 需要认证的路径
  authenticated: ["/profile", "/settings", "/api/user"],

  // 公开路径（无需认证）
  public: ["/", "/blog", "/search", "/login", "/register", "/auth", "/unauthorized"],
} as const

/**
 * 检查路径是否匹配指定的路径规则
 */
function matchesPath(pathname: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => {
    if (pattern.endsWith("/*")) {
      // 通配符匹配
      const basePattern = pattern.slice(0, -2)
      return pathname.startsWith(basePattern)
    }
    return pathname === pattern || pathname.startsWith(pattern + "/")
  })
}

/**
 * 获取用户权限信息（简化版本）
 * 注意：中间件中无法使用 Prisma，基于邮箱识别管理员
 */
async function getUserPermissions(userId: string, supabaseUser: any = null): Promise<any> {
  const now = Date.now()
  const cached = permissionCache.get(userId)

  // 检查缓存是否有效
  if (cached && now - cached.timestamp < CACHE_DURATION) {
    return cached.user
  }

  // 基于邮箱识别管理员（临时方案）
  const adminEmails = ["admin@example.com", "1483864379@qq.com"] // 可以通过环境变量配置
  const userEmail = supabaseUser?.email || ""
  const isAdmin = adminEmails.includes(userEmail)
  const userRole = isAdmin ? "ADMIN" : supabaseUser?.user_metadata?.role || "USER"

  if (isAdmin) {
    console.log("中间件: 检测到管理员邮箱，设置角色为 ADMIN:", userEmail)
  } else {
    console.log("中间件: 普通用户，使用 Supabase metadata 权限检查, role:", userRole)
  }

  const basicUser = {
    id: userId,
    role: userRole,
    status: "ACTIVE", // 默认状态
    lastLoginAt: new Date(),
  }

  // 更新缓存
  permissionCache.set(userId, {
    user: basicUser,
    timestamp: now,
  })

  return basicUser
}

/**
 * 清除用户权限缓存
 */
function clearUserPermissionCache(userId: string) {
  permissionCache.delete(userId)
}

/**
 * 创建重定向响应
 */
function createRedirectResponse(url: string, request: NextRequest): NextResponse {
  const redirectUrl = new URL(url, request.url)
  const response = NextResponse.redirect(redirectUrl)

  // 清除可能存在的认证 Cookie（如果需要）
  if (url === "/login") {
    response.headers.set("X-Middleware-Cache", "no-cache")
  }

  return response
}

/**
 * 创建未授权响应
 */
function createUnauthorizedResponse(
  request: NextRequest,
  reason: "AUTHENTICATION_REQUIRED" | "INSUFFICIENT_PERMISSIONS" | "ACCOUNT_BANNED"
): NextResponse {
  const isApiRequest = request.nextUrl.pathname.startsWith("/api/")

  if (isApiRequest) {
    // API 请求返回 JSON 错误响应
    return NextResponse.json(
      {
        error: getErrorMessage(reason),
        code: reason,
        timestamp: new Date().toISOString(),
      },
      { status: getStatusCode(reason) }
    )
  }

  // 页面请求重定向到未授权页面
  const unauthorizedUrl = new URL("/unauthorized", request.url)
  unauthorizedUrl.searchParams.set("reason", reason.toLowerCase())
  unauthorizedUrl.searchParams.set("redirect", request.nextUrl.pathname)

  return NextResponse.redirect(unauthorizedUrl)
}

/**
 * 获取错误消息
 */
function getErrorMessage(reason: string): string {
  switch (reason) {
    case "AUTHENTICATION_REQUIRED":
      return "用户未认证"
    case "INSUFFICIENT_PERMISSIONS":
      return "权限不足，需要管理员权限"
    case "ACCOUNT_BANNED":
      return "账户已被封禁"
    default:
      return "访问被拒绝"
  }
}

/**
 * 获取状态码
 */
function getStatusCode(reason: string): number {
  switch (reason) {
    case "AUTHENTICATION_REQUIRED":
      return 401
    case "INSUFFICIENT_PERMISSIONS":
    case "ACCOUNT_BANNED":
      return 403
    default:
      return 403
  }
}

/**
 * 主中间件函数 - Phase 4 安全增强版
 */
export async function middleware(request: NextRequest) {
  const startTime = performance.now()
  const pathname = request.nextUrl.pathname

  try {
    // Phase 4 安全增强：创建安全上下文
    const securityContext = createSecurityContext(request)

    // 1. 验证安全头部
    const headerValidation = validateSecurityHeaders(request)
    if (!headerValidation.isValid) {
      console.warn("安全头部验证失败:", headerValidation.errorMessage)
      // 在生产环境中可能需要更严格的处理
    }

    // 2. 执行核心安全检查
    const securityCheckResult = await SecurityMiddleware.processSecurityChecks(
      request,
      securityContext
    )

    if (securityCheckResult) {
      // 安全检查失败，返回相应的错误响应
      return securityCheckResult
    }

    // 安全检查已在 SecurityMiddleware.processSecurityChecks() 中完成
    // 移除重复的速率限制检查以避免双重消耗配额

    // 检查是否为公开路径
    if (matchesPath(pathname, PATH_PERMISSIONS.public)) {
      const response = NextResponse.next()
      return setSecurityHeaders(response)
    }

    // 创建 Supabase 客户端
    const response = NextResponse.next()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            response.cookies.set(name, value, options)
          },
          remove(name: string, options: any) {
            response.cookies.delete(name)
          },
        },
      }
    )

    // 获取经过验证的用户信息
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError) {
      console.error("中间件用户验证错误:", userError)
      return createUnauthorizedResponse(request, "AUTHENTICATION_REQUIRED")
    }

    // 检查是否需要认证
    const requiresAuth = matchesPath(pathname, PATH_PERMISSIONS.authenticated)
    const requiresAdmin = matchesPath(pathname, PATH_PERMISSIONS.admin)

    if (!user && (requiresAuth || requiresAdmin)) {
      // 未认证用户访问需认证路径
      const isApiRequest = pathname.startsWith("/api/")

      if (isApiRequest) {
        // API 请求返回错误状态码
        return createUnauthorizedResponse(request, "AUTHENTICATION_REQUIRED")
      } else {
        // 页面请求重定向到登录页
        const loginUrl = new URL("/login", request.url)
        loginUrl.searchParams.set("redirect", pathname)
        return createRedirectResponse(loginUrl.toString(), request)
      }
    }

    // 如果有用户，验证用户权限
    if (user) {
      // 清除权限缓存以获取最新权限（临时解决方案）
      clearUserPermissionCache(user.id)

      const userWithPermissions = await getUserPermissions(user.id, user)

      if (!userWithPermissions) {
        // 数据库中找不到用户记录
        return createUnauthorizedResponse(request, "AUTHENTICATION_REQUIRED")
      }

      // 检查用户状态
      if (userWithPermissions.status === "BANNED") {
        clearUserPermissionCache(userWithPermissions.id)
        return createUnauthorizedResponse(request, "ACCOUNT_BANNED")
      }

      // 检查管理员权限
      if (requiresAdmin && userWithPermissions.role !== "ADMIN") {
        return createUnauthorizedResponse(request, "INSUFFICIENT_PERMISSIONS")
      }

      // 注意：中间件中跳过数据库更新操作
      // TODO: 在 Server Actions 或 API 路由中实现用户登录时间更新
    }

    // 性能日志（仅在开发环境）
    if (process.env.NODE_ENV === "development") {
      const endTime = performance.now()
      const duration = endTime - startTime
      if (duration > 50) {
        console.warn(`中间件处理耗时过长: ${pathname} - ${duration.toFixed(2)}ms`)
      }
    }

    // 应用安全头部
    return setSecurityHeaders(response)
  } catch (error) {
    console.error("中间件处理错误:", error)

    // 性能监控
    const endTime = performance.now()
    const duration = endTime - startTime
    console.error(`中间件错误处理耗时: ${duration.toFixed(2)}ms`)

    // 对于错误情况，返回服务不可用响应
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error: "服务暂时不可用",
          code: "SERVICE_UNAVAILABLE",
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      )
    }

    // 页面请求重定向到错误页
    return createRedirectResponse("/unauthorized?reason=service_unavailable", request)
  }
}

/**
 * 中间件配置 - 指定哪些路径需要中间件处理
 */
export const config = {
  matcher: [
    /*
     * 匹配所有请求路径，除了：
     * - _next/static (静态文件)
     * - _next/image (图像优化文件)
     * - favicon.ico (网站图标)
     * - 以 . 开头的文件 (隐藏文件)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.).*)",
  ],
}
