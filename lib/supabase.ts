/**
 * Supabase 客户端配置
 * 支持 Server Components、Client Components 和 Route Handlers
 */

import { createBrowserClient, createServerClient } from "@supabase/ssr"
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { logger } from "./utils/logger"

type NextCookiesStore = Awaited<ReturnType<(typeof import("next/headers"))["cookies"]>>

type SupabaseCookieMethods = {
  get: (name: string) => string | undefined
  set?: (name: string, value: string, options: any) => void
  remove?: (name: string, options: any) => void
}

// 环境变量验证
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "缺少 Supabase 环境变量。请检查 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY"
  )
}

/**
 * 创建浏览器端 Supabase 客户端
 * 用于 Client Components 中的认证操作
 */
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl!, supabaseAnonKey!)
}

// 导出别名以保持向后兼容
export const createClientSupabaseClient = createClient

/**
 * 创建服务端 Supabase 客户端
 * 用于 Server Components 和 Server Actions 中的认证操作
 */
export async function createServerSupabaseClient() {
  const { cookies } = await import("next/headers")
  const cookieStore = await cookies()
  const allowCookieWrite = isCookieStoreWritable(cookieStore)

  if (!allowCookieWrite) {
    logger.debug("Supabase server client running in read-only cookie mode")
  }

  return createServerClient<Database>(supabaseUrl!, supabaseAnonKey!, {
    cookies: buildCookieMethods(cookieStore, allowCookieWrite),
  })
}

/**
 * 创建 Route Handler 专用的 Supabase 客户端
 * 用于 API 路由中的认证操作
 */
export async function createRouteHandlerClient() {
  const { cookies } = await import("next/headers")
  const cookieStore = await cookies()
  const allowCookieWrite = isCookieStoreWritable(cookieStore)

  return createServerClient<Database>(supabaseUrl!, supabaseAnonKey!, {
    cookies: buildCookieMethods(cookieStore, allowCookieWrite),
  })
}

/**
 * 创建 Service Role Supabase 客户端
 * 仅在服务端使用，用于执行管理类操作（如 admin create user）
 */
export function createServiceRoleClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("缺少 Supabase Service Role Key。请在环境变量中设置 SUPABASE_SERVICE_ROLE_KEY")
  }

  return createSupabaseJsClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function isCookieStoreWritable(cookieStore: NextCookiesStore): boolean {
  const setFn = (cookieStore as any)?.set
  if (typeof setFn !== "function") {
    return false
  }

  const fnName = setFn.name || ""
  if (fnName === "callable") {
    return false
  }

  const fnSource = Function.prototype.toString.call(setFn)
  if (fnSource.includes("ReadonlyRequestCookiesError")) {
    return false
  }

  return true
}

function buildCookieMethods(
  cookieStore: NextCookiesStore,
  allowCookieWrite: boolean
): SupabaseCookieMethods {
  const cookieMethods: SupabaseCookieMethods = {
    get(name: string) {
      return cookieStore.get(name)?.value
    },
  }

  if (allowCookieWrite) {
    cookieMethods.set = (name, value, options) => {
      cookieStore.set(name, value, options)
    }
    cookieMethods.remove = (name, _options) => {
      cookieStore.delete(name)
    }
  }

  return cookieMethods
}
