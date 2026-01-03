/**
 * Supabase Session 刷新中间件
 * 严格遵循 Supabase 官方 Next.js 集成最佳实践
 *
 * 官方文档：https://supabase.com/docs/guides/auth/server-side/nextjs
 *
 * 关键要求：
 * 1. 必须在 middleware 中调用 supabase.auth.getUser() 刷新 session
 * 2. 必须返回包含更新后 cookies 的 NextResponse
 * 3. 不要在 createServerClient 和 getUser() 之间运行其他代码
 */

import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { middlewareLogger } from "@/lib/utils/logger"

/**
 * 更新 Supabase session
 *
 * 这是 Supabase 官方要求的核心逻辑：
 * - 创建 Supabase 客户端，配置 cookie 处理
 * - 调用 auth.getUser() 刷新 session（自动更新 cookies）
 * - 返回包含更新后 cookies 的 NextResponse
 *
 * @param request - Next.js 请求对象
 * @returns 包含更新后 cookies 的 NextResponse
 *
 * @example
 * ```typescript
 * export async function middleware(request: NextRequest) {
 *   // 1. Supabase session 刷新（最高优先级）
 *   const supabaseResponse = await updateSession(request)
 *
 *   // 2. 其他安全检查...
 *
 *   return supabaseResponse
 * }
 * ```
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  // 创建初始响应对象
  let supabaseResponse = NextResponse.next({
    request,
  })

  try {
    const hostname = request.nextUrl.hostname.toLowerCase()
    const cookieDomain =
      hostname === "jikns666.xyz" || hostname.endsWith(".jikns666.xyz")
        ? ".jikns666.xyz"
        : undefined

    // 创建 Supabase 客户端，配置 cookie 处理
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            // 更新请求对象的 cookies（用于后续中间件）
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))

            // 创建新的响应对象，包含更新后的 cookies
            supabaseResponse = NextResponse.next({
              request,
            })

            // 设置响应对象的 cookies（返回给客户端）
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, {
                ...options,
                ...(cookieDomain ? { domain: cookieDomain } : {}),
              })
            )
          },
        },
        ...(cookieDomain ? { cookieOptions: { domain: cookieDomain } } : {}),
      }
    )

    // IMPORTANT: DO NOT REMOVE auth.getUser()
    // 这是 Supabase 官方要求的核心调用，用于刷新 session
    // 即使不使用返回值，也必须调用此方法
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // 可选：记录 session 刷新日志（仅在开发环境）
    if (process.env.NODE_ENV === "development" && user) {
      middlewareLogger.debug("Supabase session refreshed", {
        userId: user.id,
        path: request.nextUrl.pathname,
      })
    }
  } catch (error) {
    // Session 刷新失败不应阻塞请求
    // 用户可能未登录或 token 已过期，这是正常情况
    middlewareLogger.warn("Supabase session refresh failed", {
      error: error instanceof Error ? error.message : String(error),
      path: request.nextUrl.pathname,
    })
  }

  // IMPORTANT: 必须返回 supabaseResponse，包含更新后的 cookies
  return supabaseResponse
}
