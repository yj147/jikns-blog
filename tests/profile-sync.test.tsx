/**
 * 用户资料页数据库同步集成测试
 * 测试首登和复登场景下的数据同步和 UI 更新
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createMockSupabaseClient } from "./supabase-mock-helper"
import { createMockPrismaClient } from "./prisma-mock-helper"
import ProfilePage from "@/app/profile/page"
import { AuthProvider } from "@/app/providers/auth-provider"
import type { User as SupabaseUser } from "@supabase/supabase-js"

// Mock Next.js
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/profile",
}))

// Mock lib modules
vi.mock("@/lib/supabase", () => ({
  createClient: () => createMockSupabaseClient(),
  createServerSupabaseClient: () => createMockSupabaseClient(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: createMockPrismaClient(),
}))

vi.mock("@/lib/actions/auth", () => ({
  getCurrentUser: vi.fn(),
  revalidateUserProfile: vi.fn(),
}))

describe("用户资料页数据库同步测试", () => {
  const mockSupabase = createMockSupabaseClient()
  const mockPrisma = createMockPrismaClient()

  // 测试用户数据
  const githubUser: Partial<SupabaseUser> = {
    id: "test-user-123",
    email: "test@example.com",
    user_metadata: {
      full_name: "Test User",
      avatar_url: "https://github.com/avatar.jpg",
    },
  }

  const databaseUser = {
    id: "test-user-123",
    email: "test@example.com",
    name: "Test User",
    avatarUrl: "https://github.com/avatar.jpg",
    bio: null,
    role: "USER" as const,
    status: "ACTIVE" as const,
    socialLinks: null,
    passwordHash: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    // 默认设置：已认证用户
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: githubUser } as any },
      error: null,
    })
    mockPrisma.user.findUnique.mockResolvedValue(databaseUser)

    // Mock server actions
    const { getCurrentUser } = await import("@/lib/actions/auth")
    vi.mocked(getCurrentUser).mockResolvedValue(databaseUser)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("首次登录：创建用户记录并立即在 profile 页面显示", async () => {
    // 模拟首次登录：数据库中不存在用户
    mockPrisma.user.findUnique.mockResolvedValueOnce(null)
    mockPrisma.user.create.mockResolvedValueOnce(databaseUser)

    // Mock server actions for this test
    const { getCurrentUser } = await import("@/lib/actions/auth")
    vi.mocked(getCurrentUser).mockResolvedValueOnce(databaseUser)

    // 渲染 profile 页面
    render(
      <AuthProvider>
        <ProfilePage />
      </AuthProvider>
    )

    // 等待异步数据加载
    await waitFor(() => {
      // 验证显示了数据库中的用户信息
      expect(screen.getByText("Test User")).toBeInTheDocument()
      expect(screen.getByText("test@example.com")).toBeInTheDocument()
    })

    // 验证头像正确显示
    const avatar = screen.getByRole("img", { name: "Test User" })
    expect(avatar).toHaveAttribute("src", "https://github.com/avatar.jpg")
  })

  it("复次登录：更新用户信息并刷新 UI（含头像变更）", async () => {
    // 模拟用户信息有变更
    const updatedGithubUser = {
      ...githubUser,
      user_metadata: {
        full_name: "Updated Test User",
        avatar_url: "https://github.com/new-avatar.jpg",
      },
    }

    const updatedDatabaseUser = {
      ...databaseUser,
      name: "Updated Test User",
      avatarUrl: "https://github.com/new-avatar.jpg",
      lastLoginAt: new Date(),
    }

    // 模拟数据库更新
    mockPrisma.user.update.mockResolvedValueOnce(updatedDatabaseUser)
    mockPrisma.user.findUnique.mockResolvedValueOnce(updatedDatabaseUser)

    // Mock server actions for this test
    const { getCurrentUser } = await import("@/lib/actions/auth")
    vi.mocked(getCurrentUser).mockResolvedValueOnce(updatedDatabaseUser)

    // 渲染 profile 页面
    render(
      <AuthProvider>
        <ProfilePage />
      </AuthProvider>
    )

    await waitFor(() => {
      // 验证显示了更新后的用户信息
      expect(screen.getByText("Updated Test User")).toBeInTheDocument()
      expect(screen.getByText("test@example.com")).toBeInTheDocument()
    })

    // 验证头像已更新
    const avatar = screen.getByRole("img", { name: "Updated Test User" })
    expect(avatar).toHaveAttribute("src", "https://github.com/new-avatar.jpg")
  })

  it("显示用户状态和角色信息", async () => {
    // 模拟管理员用户
    const adminUser = {
      ...databaseUser,
      role: "ADMIN" as const,
    }

    mockPrisma.user.findUnique.mockResolvedValueOnce(adminUser)

    // Mock server actions for this test
    const { getCurrentUser } = await import("@/lib/actions/auth")
    vi.mocked(getCurrentUser).mockResolvedValueOnce(adminUser)

    render(
      <AuthProvider>
        <ProfilePage />
      </AuthProvider>
    )

    await waitFor(() => {
      // 验证管理员徽章显示
      expect(screen.getByText("管理员")).toBeInTheDocument()
      // 验证用户状态显示
      expect(screen.getByText("正常")).toBeInTheDocument()
    })
  })

  it("显示最后登录时间和加入时间", async () => {
    const userWithLoginTime = {
      ...databaseUser,
      createdAt: new Date("2024-01-01T10:00:00Z"),
      lastLoginAt: new Date("2024-08-25T15:30:00Z"),
    }

    mockPrisma.user.findUnique.mockResolvedValueOnce(userWithLoginTime)

    // Mock server actions for this test
    const { getCurrentUser } = await import("@/lib/actions/auth")
    vi.mocked(getCurrentUser).mockResolvedValueOnce(userWithLoginTime)

    render(
      <AuthProvider>
        <ProfilePage />
      </AuthProvider>
    )

    await waitFor(() => {
      // 验证时间信息显示
      expect(screen.getByText(/加入于.*2024年1月/)).toBeInTheDocument()
      expect(screen.getByText(/最后登录:.*2024年8月25日/)).toBeInTheDocument()
    })
  })

  it("未登录用户重定向到登录页", async () => {
    // 模拟未登录状态
    mockSupabase.auth.getSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    })

    const redirectMock = vi.mocked(await import("next/navigation")).redirect

    render(
      <AuthProvider>
        <ProfilePage />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(redirectMock).toHaveBeenCalledWith("/login")
    })
  })

  it("数据库为唯一真相来源：不直接读取 Supabase metadata", async () => {
    // 确保 profile 页面只从数据库获取数据，而不是直接读取 Supabase user_metadata

    // 设置数据库数据与 Supabase metadata 不同
    const supabaseUserWithDifferentData = {
      ...githubUser,
      user_metadata: {
        full_name: "Old Name From Supabase",
        avatar_url: "https://old-avatar.jpg",
      },
    }

    const databaseUserWithNewerData = {
      ...databaseUser,
      name: "New Name From Database",
      avatarUrl: "https://new-avatar.jpg",
    }

    mockSupabase.auth.getSession.mockResolvedValueOnce({
      data: { session: { user: supabaseUserWithDifferentData } as any },
      error: null,
    })
    mockPrisma.user.findUnique.mockResolvedValueOnce(databaseUserWithNewerData)

    // Mock server actions for this test
    const { getCurrentUser } = await import("@/lib/actions/auth")
    vi.mocked(getCurrentUser).mockResolvedValueOnce(databaseUserWithNewerData)

    render(
      <AuthProvider>
        <ProfilePage />
      </AuthProvider>
    )

    await waitFor(() => {
      // 应该显示数据库中的数据，而不是 Supabase metadata
      expect(screen.getByText("New Name From Database")).toBeInTheDocument()
      expect(screen.queryByText("Old Name From Supabase")).not.toBeInTheDocument()
    })

    // 验证头像使用数据库的值
    const avatar = screen.getByRole("img", { name: "New Name From Database" })
    expect(avatar).toHaveAttribute("src", "https://new-avatar.jpg")
  })

  it("处理空或缺失的用户数据", async () => {
    const minimalUser = {
      ...databaseUser,
      name: null,
      avatarUrl: null,
      bio: null,
      lastLoginAt: null,
    }

    mockPrisma.user.findUnique.mockResolvedValueOnce(minimalUser)

    // Mock server actions for this test
    const { getCurrentUser } = await import("@/lib/actions/auth")
    vi.mocked(getCurrentUser).mockResolvedValueOnce(minimalUser)

    render(
      <AuthProvider>
        <ProfilePage />
      </AuthProvider>
    )

    await waitFor(() => {
      // 应该显示邮箱前缀作为用户名
      expect(screen.getByText("test")).toBeInTheDocument() // email prefix
      // 应该显示默认个人简介
      expect(screen.getByText("这个人很神秘，什么都没有留下...")).toBeInTheDocument()
      // 不应该显示最后登录时间
      expect(screen.queryByText(/最后登录/)).not.toBeInTheDocument()
    })
  })
})
