/**
 * 测试工具函数
 */

import { NextRequest } from "next/server"

/**
 * 创建模拟的 NextRequest 对象
 */
export function createMockRequest(
  method: string,
  url: string,
  options: {
    searchParams?: Record<string, string>
    headers?: Record<string, string>
    body?: any
  } = {}
): NextRequest {
  // 构建 URL
  const baseUrl = "http://localhost:3000"
  const fullUrl = new URL(url, baseUrl)

  // 添加查询参数
  if (options.searchParams) {
    Object.entries(options.searchParams).forEach(([key, value]) => {
      fullUrl.searchParams.set(key, value)
    })
  }

  // 创建请求
  const init: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  }

  // 创建 NextRequest 实例
  const request = new NextRequest(fullUrl, init)

  // Mock json() 方法
  if (options.body) {
    ;(request as any).json = async () => options.body
  }

  return request
}

/**
 * 创建模拟的用户对象
 */
export function createMockUser(overrides: any = {}) {
  return {
    id: "test-user-id",
    email: "test@example.com",
    name: "Test User",
    role: "USER",
    ...overrides,
  }
}

/**
 * 创建模拟的评论对象
 */
export function createMockComment(overrides: any = {}) {
  return {
    id: "comment-id",
    content: "Test comment content",
    authorId: "test-user-id",
    targetType: "post",
    targetId: "post-id",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

/**
 * 创建模拟的响应对象
 */
export function createMockResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  })
}

/**
 * 等待指定时间
 */
export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 创建性能测试上下文
 */
export function createPerformanceContext() {
  const marks: Map<string, number> = new Map()

  return {
    mark(name: string) {
      marks.set(name, performance.now())
    },

    measure(name: string, startMark: string, endMark?: string) {
      const start = marks.get(startMark)
      if (!start) {
        throw new Error(`Mark ${startMark} not found`)
      }

      const end = endMark ? marks.get(endMark) : performance.now()
      if (endMark && !end) {
        throw new Error(`Mark ${endMark} not found`)
      }

      return (end as number) - start
    },

    clear() {
      marks.clear()
    },
  }
}
