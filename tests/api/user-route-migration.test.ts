/**
 * API 错误处理迁移测试
 * 验证 app/api/user/route.ts 的错误处理迁移
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

describe("用户API错误处理迁移测试", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321"
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key"
    process.env.METRICS_SAMPLE_RATE = "0"
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function mockSupabaseWith(data: { user: any; error: any }) {
    vi.doMock("@/lib/supabase", () => ({
      createRouteHandlerClient: vi.fn().mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data,
            error: data.error,
          }),
        },
      }),
    }))
  }

  function mockApiDependencies() {
    vi.doMock("@/lib/performance-monitor", () => ({
      performanceMonitor: { recordApiResponse: vi.fn() },
    }))

    vi.doMock("@/lib/storage/signed-url", () => ({
      createSignedUrls: vi.fn(async (inputs: string[]) => inputs),
    }))

    vi.doMock("@/lib/auth", () => ({
      syncUserFromAuth: vi.fn().mockResolvedValue(undefined),
      isConfiguredAdminEmail: vi.fn().mockReturnValue(false),
    }))
  }

  function mockPrisma(findUniqueImpl: any, createImpl?: any) {
    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        user: {
          findUnique: vi.fn(findUniqueImpl),
          create: vi.fn(createImpl ?? (() => Promise.resolve(null))),
        },
      },
    }))
  }

  function mockLogger() {
    vi.doMock("@/lib/utils/logger", () => ({
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      authLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    }))
  }

  function buildRequest(options?: { withSessionCookie?: boolean }) {
    const headers = new Headers()
    if (options?.withSessionCookie) {
      headers.set("cookie", "sb-test-auth-token=fake")
    }
    return new Request("http://localhost:3000/api/user", { headers })
  }

  it("应该正确处理未认证用户 - 返回标准化错误格式", async () => {
    mockApiDependencies()
    mockLogger()
    mockPrisma(() => Promise.resolve(null))
    mockSupabaseWith({ user: null, error: { message: "Not authenticated" } })

    const { GET } = await import("@/app/api/user/route")
    const response = await GET(buildRequest())
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toEqual({ code: "UNAUTHORIZED", message: "未授权访问" })
  })

  it("应该正确处理认证用户 - 返回用户信息", async () => {
    mockApiDependencies()
    mockLogger()

    const mockUser = {
      id: "user-123",
      email: "test@example.com",
      user_metadata: {
        name: "Test User",
        avatar_url: "https://example.com/avatar.jpg",
      },
    }

    mockPrisma(() =>
      Promise.resolve({
        id: "user-123",
        email: "test@example.com",
        name: "Test User",
        avatarUrl: "https://example.com/avatar.jpg",
        bio: "Test bio",
        socialLinks: null,
        role: "USER",
        status: "ACTIVE",
        createdAt: new Date(),
        lastLoginAt: new Date(),
      })
    )

    mockSupabaseWith({ user: mockUser, error: null })

    const { GET } = await import("@/app/api/user/route")
    const response = await GET(buildRequest({ withSessionCookie: true }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.user.id).toBe("user-123")
    expect(data.user.email).toBe("test@example.com")
  })

  it("应该正确处理数据库错误 - 使用回退数据", async () => {
    mockApiDependencies()
    mockLogger()

    const mockUser = {
      id: "user-456",
      email: "fallback@example.com",
      user_metadata: {
        name: "Fallback User",
      },
    }

    mockPrisma(() => Promise.reject(new Error("Database connection failed")))
    mockSupabaseWith({ user: mockUser, error: null })

    const { GET } = await import("@/app/api/user/route")
    const response = await GET(buildRequest({ withSessionCookie: true }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.user.id).toBe("user-456")
    expect(data.user.email).toBe("fallback@example.com")
    expect(data.user.role).toBe("USER")
  })

  it("应该正确处理服务器错误 - 返回标准化错误格式", async () => {
    mockApiDependencies()
    mockLogger()
    mockPrisma(() => Promise.resolve(null))

    vi.doMock("@/lib/supabase", () => ({
      createRouteHandlerClient: vi.fn().mockRejectedValue(new Error("Internal server error")),
    }))

    const { GET } = await import("@/app/api/user/route")
    const response = await GET(buildRequest({ withSessionCookie: true }))
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error.code).toBe("UNKNOWN_ERROR")
  })

  it("应该正确处理新用户创建", async () => {
    mockApiDependencies()
    mockLogger()

    const mockUser = {
      id: "new-user-789",
      email: "newuser@example.com",
      user_metadata: {
        name: "New User",
        avatar_url: "https://example.com/new-avatar.jpg",
      },
    }

    mockPrisma(
      () => Promise.resolve(null),
      () =>
        Promise.resolve({
          id: "new-user-789",
          email: "newuser@example.com",
          name: "New User",
          avatarUrl: "https://example.com/new-avatar.jpg",
          bio: null,
          socialLinks: null,
          role: "USER",
          status: "ACTIVE",
          createdAt: new Date(),
          lastLoginAt: new Date(),
        })
    )

    mockSupabaseWith({ user: mockUser, error: null })

    const { GET } = await import("@/app/api/user/route")
    const response = await GET(buildRequest({ withSessionCookie: true }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.user.id).toBe("new-user-789")
  })
})
