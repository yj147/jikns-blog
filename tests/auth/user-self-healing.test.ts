/**
 * fetchAuthenticatedUser 自愈机制测试
 * 覆盖：自愈路径、失败回退、既有用户直返
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

const mockAuthLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
}

const createSupabaseClient = vi.fn(async () => mockSupabaseClient)

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
}

const mockRevalidateTag = vi.fn()

vi.mock("@/lib/utils/logger", () => ({
  authLogger: mockAuthLogger,
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

vi.mock("@/lib/supabase", () => ({
  createServerSupabaseClient: createSupabaseClient,
}))

vi.mock("react", () => ({
  cache: (fn: any) => fn,
}))

vi.mock("next/cache", () => ({
  unstable_cache: (fn: any) => fn,
  revalidateTag: mockRevalidateTag,
}))

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    getAll: vi.fn(() => [{ name: "sb-auth-token", value: "token" }]),
  })),
}))

describe("fetchAuthenticatedUser 自愈机制", () => {
  const baseSupabaseUser = {
    id: "user-self-heal",
    email: "heal@example.com",
    user_metadata: {
      full_name: "Heal User",
      avatar_url: "https://img.test/avatar.png",
    },
  }

  const hydratedUser = {
    id: baseSupabaseUser.id,
    email: baseSupabaseUser.email,
    role: "USER" as const,
    status: "ACTIVE" as const,
    name: "Heal User",
    avatarUrl: "https://img.test/avatar.png",
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
    lastLoginAt: new Date("2024-01-01T00:00:00Z"),
  }

  const mockSupabaseUser = (user = baseSupabaseUser) => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user },
      error: null,
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("Auth 存在而数据库缺失时应触发自愈并返回同步结果", async () => {
    mockSupabaseUser()
    mockPrisma.user.findUnique.mockResolvedValue(null)

    const sessionModule = await import("@/lib/auth/session")
    mockPrisma.user.upsert.mockResolvedValue(hydratedUser as any)

    const result = await sessionModule.fetchAuthenticatedUser()

    expect(mockPrisma.user.upsert).toHaveBeenCalledOnce()
    expect(mockPrisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: baseSupabaseUser.id },
        create: expect.objectContaining({
          id: baseSupabaseUser.id,
          email: baseSupabaseUser.email,
          name: "Heal User",
          avatarUrl: "https://img.test/avatar.png",
        }),
      })
    )
    expect(result).toEqual({
      id: hydratedUser.id,
      email: hydratedUser.email,
      role: hydratedUser.role,
      status: hydratedUser.status,
      name: hydratedUser.name,
      avatarUrl: hydratedUser.avatarUrl,
    })
    expect(mockAuthLogger.warn).toHaveBeenCalledWith(
      "认证用户在数据库中不存在，尝试自愈同步",
      expect.objectContaining({ userId: baseSupabaseUser.id })
    )
  })

  it("自愈同步失败时应返回 null 并记录错误", async () => {
    mockSupabaseUser()
    mockPrisma.user.findUnique.mockResolvedValue(null)

    const sessionModule = await import("@/lib/auth/session")
    mockPrisma.user.upsert.mockRejectedValue(new Error("sync failed"))

    const result = await sessionModule.fetchAuthenticatedUser()

    expect(result).toBeNull()
    expect(mockPrisma.user.upsert).toHaveBeenCalledOnce()
    expect(mockAuthLogger.error).toHaveBeenCalledWith(
      "自愈同步失败",
      expect.objectContaining({
        userId: baseSupabaseUser.id,
        error: expect.objectContaining({ message: "用户资料同步失败" }),
      })
    )
  })

  it("数据库已有用户时不应触发自愈流程", async () => {
    mockSupabaseUser()
    mockPrisma.user.findUnique.mockResolvedValue(hydratedUser)

    const sessionModule = await import("@/lib/auth/session")
    mockPrisma.user.upsert.mockResolvedValue(hydratedUser as any)

    const result = await sessionModule.fetchAuthenticatedUser()

    expect(result).toEqual({
      id: hydratedUser.id,
      email: hydratedUser.email,
      role: hydratedUser.role,
      status: hydratedUser.status,
      name: hydratedUser.name,
      avatarUrl: hydratedUser.avatarUrl,
    })
    expect(mockPrisma.user.upsert).not.toHaveBeenCalled()
    expect(mockAuthLogger.warn).not.toHaveBeenCalled()
  })
})
