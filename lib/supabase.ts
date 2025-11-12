/**
 * Supabase 客户端配置
 * 支持 Server Components、Client Components 和 Route Handlers
 */

import { createBrowserClient, createServerClient } from "@supabase/ssr"
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { logger } from "./utils/logger"

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

  return createServerClient<Database>(supabaseUrl!, supabaseAnonKey!, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: any) {
        try {
          cookieStore.set(name, value, options)
        } catch (error) {
          // 处理在某些上下文中无法设置 cookie 的情况
          logger.error("无法设置 cookie", { name }, error)
        }
      },
      remove(name: string, options: any) {
        try {
          cookieStore.delete(name)
        } catch (error) {
          // 处理在某些上下文中无法删除 cookie 的情况
          logger.error("无法删除 cookie", { name }, error)
        }
      },
    },
  })
}

/**
 * 创建 Route Handler 专用的 Supabase 客户端
 * 用于 API 路由中的认证操作
 */
export async function createRouteHandlerClient() {
  const { cookies } = await import("next/headers")
  const cookieStore = await cookies()

  return createServerClient<Database>(supabaseUrl!, supabaseAnonKey!, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: any) {
        cookieStore.set(name, value, options)
      },
      remove(name: string, options: any) {
        cookieStore.delete(name)
      },
    },
  })
}

/**
 * 创建 Service Role Supabase 客户端
 * 仅在服务端使用，用于执行管理类操作（如 admin create user）
 */
export function createServiceRoleClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      "缺少 Supabase Service Role Key。请在环境变量中设置 SUPABASE_SERVICE_ROLE_KEY"
    )
  }

  return createSupabaseJsClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
