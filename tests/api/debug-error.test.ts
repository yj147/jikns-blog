/**
 * 调试测试 - 查看错误细节
 */

import { describe, it, expect, vi } from "vitest"

// 设置环境变量
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321"
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key"

describe("调试测试", () => {
  it("查看错误细节", async () => {
    // 清理所有mocks
    vi.resetModules()

    // Mock logger 并捕获错误
    const errorLogs: any[] = []
    vi.doMock("@/lib/utils/logger", () => ({
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn((msg: string, error: any) => {
          errorLogs.push({ msg, error })
          console.log("Error logged:", msg, error)
        }),
      },
    }))

    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        user: {
          findUnique: vi.fn(),
          create: vi.fn(),
        },
      },
    }))

    // Mock Supabase
    vi.doMock("@/lib/supabase", () => ({
      createRouteHandlerClient: vi.fn().mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: { message: "Not authenticated" },
          }),
        },
      }),
    }))

    // 导入并执行
    const { GET } = await import("@/app/api/user/route")

    try {
      const response = await GET()
      const data = await response.json()

      console.log("\n=== Response Details ===")
      console.log("Status:", response.status)
      console.log("Data:", JSON.stringify(data, null, 2))
      console.log("\n=== Error Logs ===")
      errorLogs.forEach((log) => {
        console.log("Message:", log.msg)
        console.log("Error:", log.error)
      })

      // 验证
      expect(response.status).toBe(401)
    } catch (error) {
      console.error("Test error:", error)
      throw error
    }
  })
})
