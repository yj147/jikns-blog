/**
 * 测试环境全局配置
 * 为权限系统测试提供必要的 mock 和工具函数
 */

import "@testing-library/jest-dom"
import { beforeAll, beforeEach, afterEach, afterAll, vi } from "vitest"
import { cleanup } from "@testing-library/react"
import { setupTestEnv, cleanupTestEnv } from "./helpers/test-env"

// 清理 React 测试环境
afterEach(() => {
  cleanup()
})

// 全局模拟 Next.js 相关模块
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  })),
  usePathname: vi.fn(() => "/"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  notFound: vi.fn(),
}))

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    has: vi.fn(),
  })),
  headers: vi.fn(() => new Map()),
}))

// Mock Next.js 缓存功能
vi.mock("next/cache", () => ({
  unstable_cache: vi.fn((fn) => fn), // 直接返回函数，跳过缓存
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}))

// 模拟 Prisma 客户端
vi.mock("@/lib/prisma", async () => {
  const { prisma } = await import("./__mocks__/prisma-compatible")
  return {
    prisma,
  }
})

// 模拟 Supabase 客户端 - 完整的模块导出
vi.mock("@/lib/supabase", async () => {
  const supabaseMock = await import("./__mocks__/supabase")
  return {
    createClient: supabaseMock.createClient,
    createServerSupabaseClient: supabaseMock.createServerSupabaseClient,
    createRouteHandlerClient: supabaseMock.createRouteHandlerClient,
    createClientSupabaseClient: supabaseMock.createClient, // 别名
    ...supabaseMock.default,
  }
})

// 设置标准化测试环境变量
beforeAll(() => {
  setupTestEnv()
})

afterAll(() => {
  cleanupTestEnv()
})

// 全局 fetch mock 配置 - 解决 AuthProvider 测试失败
// 使用 vi.stubGlobal 而不是直接赋值，以便测试可以覆盖
const mockFetch = vi.fn((url: string | URL | Request, init?: RequestInit) => {
  const urlString =
    typeof url === "string" ? url : url instanceof URL ? url.toString() : (url as Request).url

  // 默认成功响应
  const defaultResponse = {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: new Headers({ "Content-Type": "application/json" }),
    json: async () => ({ data: null, error: null }),
    text: async () => "",
    blob: async () => new Blob(),
    arrayBuffer: async () => new ArrayBuffer(0),
    formData: async () => new FormData(),
    clone: () => defaultResponse,
    body: null,
    bodyUsed: false,
    redirected: false,
    type: "basic" as ResponseType,
    url: urlString,
  }

  // 特定API的Mock响应
  if (urlString.includes("/api/user/profile")) {
    return Promise.resolve({
      ...defaultResponse,
      json: async () => ({
        data: {
          id: "test-user",
          email: "test@example.com",
          name: "Test User",
          avatarUrl: null,
          role: "USER",
          status: "ACTIVE",
        },
      }),
    })
  }

  if (urlString.includes("/api/logs/errors")) {
    return Promise.resolve({
      ...defaultResponse,
      json: async () => ({ success: true }),
    })
  }

  // 默认响应
  return Promise.resolve(defaultResponse)
})

// 设置全局 fetch mock，但允许测试覆盖
vi.stubGlobal("fetch", mockFetch)

// 全局错误处理和内存泄漏修复
beforeAll(() => {
  // 增加 EventEmitter 监听器限制
  process.setMaxListeners(20)
})

beforeEach(() => {
  // 清理之前的监听器
  process.removeAllListeners("unhandledRejection")
  process.removeAllListeners("uncaughtException")

  // 添加新的错误处理
  const unhandledRejectionHandler = (reason: any) => {
    console.error("未处理的 Promise 拒绝:", reason)
  }

  const uncaughtExceptionHandler = (error: Error) => {
    console.error("未捕获的异常:", error)
  }

  process.on("unhandledRejection", unhandledRejectionHandler)
  process.on("uncaughtException", uncaughtExceptionHandler)
})

afterEach(() => {
  // 清理事件监听器防止内存泄漏
  process.removeAllListeners("unhandledRejection")
  process.removeAllListeners("uncaughtException")
})

// 测试工具类型定义
declare global {
  namespace Vi {
    interface TestContext {
      // 用于测试的用户数据
      testUsers: {
        admin: TestUser
        user: TestUser
        bannedUser: TestUser
      }
    }
  }
}

export interface TestUser {
  id: string
  email: string
  name: string
  role: "ADMIN" | "USER"
  status: "ACTIVE" | "BANNED"
  avatarUrl?: string
  lastLoginAt: Date
  createdAt: Date
  updatedAt: Date
}
