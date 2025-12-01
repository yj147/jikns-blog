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
import { generateRequestId } from "@/lib/utils/request-id"

// 中间件只负责认证，不做角色鉴权。角色检查交给 Server Component / API。

/**
 * 路径权限配置
 */
const PATH_PERMISSIONS = {
  // 需要认证的路径（仅校验是否登录，角色交由上层处理）
  // 注意：/profile 不在此列表中，因为 /profile/{userId} 需要支持匿名访问公开资料
  // /profile (当前用户) 在页面服务端组件中自行处理认证检查
  authenticated: [
    "/settings",
    "/api/user",
    "/admin",
    "/admin/dashboard",
    "/admin/users",
    "/admin/posts",
    "/admin/settings",
    "/admin/feeds",
    "/api/admin",
    "/api/admin/feeds",
  ],

  // 公开路径（无需认证）
  public: [
    "/",
    "/blog",
    "/search",
    "/archive",
    "/login",
    "/register",
    "/auth",
    "/unauthorized",
    "/api/archive",
    "/api/archive/*",
    "/api/csrf-token",
    "/api/auth",
  ],
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

const METRICS_EXCLUDED_PATHS = ["/api/admin/monitoring", "/api/admin/metrics"] as const

function isApiMetricsTarget(pathname: string): boolean {
  if (!(pathname === "/api" || pathname.startsWith("/api/"))) return false
  return !METRICS_EXCLUDED_PATHS.some(
    (excludedPath) =>
      pathname === excludedPath || pathname.startsWith(excludedPath + "/")
  )
}

function decideMetricsSample(existingValue: string | null): string {
  if (existingValue !== null) return existingValue

  const rateValue = Number(process.env.METRICS_SAMPLE_RATE ?? "1")
  const rate = Number.isFinite(rateValue) ? Math.min(Math.max(rateValue, 0), 1) : 1

  return Math.random() < rate ? "1" : "0"
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

function isSupabaseSessionMissingError(error: any): boolean {
  if (!error) return false
  const message = (error.message || "").toLowerCase()
  if (message.includes("auth session missing")) return true
  if (error.name === "AuthSessionMissingError") return true
  if (error.constructor && error.constructor.name === "AuthSessionMissingError") return true
  if (error.__isAuthError && error.status === 400) return true
  return false
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
  const isMetricsPath = isApiMetricsTarget(pathname)
  const requestId = request.headers.get("x-request-id") ?? generateRequestId()
  const traceStart = request.headers.get("x-trace-start") ?? Date.now().toString()
  const metricsSample = isMetricsPath ? decideMetricsSample(request.headers.get("x-metrics-sample")) : undefined
  const forwardedHeaders = new Headers(request.headers)
  forwardedHeaders.set("x-request-id", requestId)
  forwardedHeaders.set("x-trace-start", traceStart)
  if (metricsSample !== undefined) {
    forwardedHeaders.set("x-metrics-sample", metricsSample)
  }
  const attachTraceHeaders = (response: NextResponse) => {
    response.headers.set("x-request-id", requestId)
    response.headers.set("x-trace-start", traceStart)
    if (metricsSample !== undefined) {
      response.headers.set("x-metrics-sample", metricsSample)
    }
    return response
  }

  // Phase 1 任务 1.2：公开路径直接返回，避免不必要的 Supabase/Auth/审计逻辑
  if (matchesPath(pathname, PATH_PERMISSIONS.public)) {
    const response = NextResponse.next({ request: { headers: forwardedHeaders } })
    return attachTraceHeaders(setSecurityHeaders(response))
  }

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
      return attachTraceHeaders(securityCheckResult)
    }

    // 安全检查已在 SecurityMiddleware.processSecurityChecks() 中完成
    // 移除重复的速率限制检查以避免双重消耗配额

    // 创建 Supabase 客户端
    const response = NextResponse.next({ request: { headers: forwardedHeaders } })
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
    let user: any = null
    try {
      const {
        data: { user: fetchedUser },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) {
        if (!isSupabaseSessionMissingError(userError)) {
          console.error("中间件用户验证错误:", userError)
          return attachTraceHeaders(createUnauthorizedResponse(request, "AUTHENTICATION_REQUIRED"))
        }
      } else {
        user = fetchedUser
      }
    } catch (error) {
      if (!isSupabaseSessionMissingError(error)) {
        console.error("中间件用户验证异常:", error)
        return attachTraceHeaders(createUnauthorizedResponse(request, "AUTHENTICATION_REQUIRED"))
      }
    }

    // 检查是否需要认证（/admin 仅要求登录，角色校验由 Server Component / API 负责）
    const requiresAuth = matchesPath(pathname, PATH_PERMISSIONS.authenticated)

    if (!user && requiresAuth) {
      // 未认证用户访问需认证路径
      const isApiRequest = pathname.startsWith("/api/")

      if (isApiRequest) {
        // API 请求返回错误状态码
        return attachTraceHeaders(createUnauthorizedResponse(request, "AUTHENTICATION_REQUIRED"))
      } else {
        // 页面请求重定向到登录页
        const loginUrl = new URL("/login", request.url)
        loginUrl.searchParams.set("redirect", pathname)
        return attachTraceHeaders(createRedirectResponse(loginUrl.toString(), request))
      }
    }

    // 中间件保持最小职责：仅验证登录状态、附加安全头部
    // 角色权限检查由 Server Components 和 API 路由通过 lib/permissions.ts 处理

    // 性能日志（仅在开发环境）
    if (process.env.NODE_ENV === "development") {
      const endTime = performance.now()
      const duration = endTime - startTime
      if (duration > 50) {
        console.warn(`中间件处理耗时过长: ${pathname} - ${duration.toFixed(2)}ms`)
      }
    }

    // 应用安全头部
    return attachTraceHeaders(setSecurityHeaders(response))
  } catch (error) {
    console.error("中间件处理错误:", error)

    // 性能监控
    const endTime = performance.now()
    const duration = endTime - startTime
    console.error(`中间件错误处理耗时: ${duration.toFixed(2)}ms`)

    // 对于错误情况，返回服务不可用响应
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return attachTraceHeaders(
        NextResponse.json(
          {
            error: "服务暂时不可用",
            code: "SERVICE_UNAVAILABLE",
            timestamp: new Date().toISOString(),
          },
          { status: 500 }
        )
      )
    }

    // 页面请求重定向到错误页
    return attachTraceHeaders(
      createRedirectResponse("/unauthorized?reason=service_unavailable", request)
    )
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
