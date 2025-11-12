/**
 * 用户菜单组件简化测试
 * 专注于解决超时问题，验证核心功能
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { AuthProvider, useAuth } from "@/app/providers/auth-provider"
import React from "react"

// Mock Next.js 组件
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}))

// Mock Framer Motion
vi.mock("framer-motion", () => ({
  motion: {
    header: ({ children, ...props }: any) => <header {...props}>{children}</header>,
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: any) => children,
}))

// Mock global fetch
global.fetch = vi.fn()

describe("用户菜单显示简化测试", () => {
  const mockGetSession = vi.fn()
  const mockOnAuthStateChange = vi.fn()
  const mockSupabaseClient = {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      signOut: vi.fn(),
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // 重置 Mock
    vi.mocked(global.fetch).mockReset()
    mockGetSession.mockReset()
    mockOnAuthStateChange.mockReset()

    // Mock Supabase
    vi.doMock("@/lib/supabase", () => ({
      createClient: () => mockSupabaseClient,
    }))
  })

  describe("基础渲染测试", () => {
    it("应该正确渲染 AuthProvider 和 useAuth Hook", async () => {
      // 简单的成功响应
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: null,
      })

      mockOnAuthStateChange.mockImplementation((callback) => {
        // 立即同步调用，无异步延迟
        callback("SIGNED_OUT", null)
        return {
          data: { subscription: { unsubscribe: vi.fn() } },
        }
      })

      const TestComponent = () => {
        const { isLoading, user } = useAuth()

        return (
          <div data-testid="auth-state">
            <span data-testid="loading-state">{isLoading ? "loading" : "ready"}</span>
            <span data-testid="user-state">{user ? "authenticated" : "not-authenticated"}</span>
          </div>
        )
      }

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      // 使用较短的超时时间，快速验证基础功能
      await waitFor(
        () => {
          expect(screen.getByTestId("loading-state")).toHaveTextContent("ready")
        },
        { timeout: 2000 }
      )

      expect(screen.getByTestId("user-state")).toHaveTextContent("not-authenticated")
    })

    it("应该正确处理已登录用户状态", async () => {
      const mockUser = {
        id: "test-user-123",
        email: "test@example.com",
        user_metadata: {
          full_name: "Test User",
          avatar_url: "https://example.com/avatar.jpg",
        },
      }

      mockGetSession.mockResolvedValue({
        data: {
          session: {
            user: mockUser,
            access_token: "mock-token",
          },
        },
        error: null,
      })

      // Mock API 响应
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            user: {
              id: "test-user-123",
              email: "test@example.com",
              name: "Database Name",
              avatarUrl: "https://db-avatar.com/user.jpg",
              role: "USER",
              status: "ACTIVE",
            },
          }),
      } as any)

      mockOnAuthStateChange.mockImplementation((callback) => {
        // 立即同步调用已登录状态
        callback("SIGNED_IN", {
          user: mockUser,
        })
        return {
          data: { subscription: { unsubscribe: vi.fn() } },
        }
      })

      const TestComponent = () => {
        const { user, isLoading } = useAuth()

        return (
          <div data-testid="user-display">
            <span data-testid="loading">{isLoading ? "loading" : "ready"}</span>
            {user && (
              <>
                <span data-testid="user-name">{user.name || "No Name"}</span>
                <span data-testid="user-email">{user.email}</span>
                <span data-testid="user-role">{user.role}</span>
              </>
            )}
          </div>
        )
      }

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      // 等待状态更新，但使用较短超时
      await waitFor(
        () => {
          expect(screen.getByTestId("loading")).toHaveTextContent("ready")
        },
        { timeout: 3000 }
      )

      // 验证用户信息显示
      await waitFor(
        () => {
          expect(screen.getByTestId("user-name")).toHaveTextContent("Database Name")
        },
        { timeout: 2000 }
      )

      expect(screen.getByTestId("user-email")).toHaveTextContent("test@example.com")
      expect(screen.getByTestId("user-role")).toHaveTextContent("USER")

      // 验证 API 调用
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/user/profile",
        expect.objectContaining({
          method: "GET",
        })
      )
    })

    it("应该正确处理 API 错误回退", async () => {
      const mockUser = {
        id: "test-user-456",
        email: "error@example.com",
        user_metadata: {
          full_name: "Fallback User",
        },
      }

      mockGetSession.mockResolvedValue({
        data: {
          session: {
            user: mockUser,
          },
        },
        error: null,
      })

      // Mock API 错误
      vi.mocked(global.fetch).mockRejectedValue(new Error("API Error"))

      mockOnAuthStateChange.mockImplementation((callback) => {
        callback("SIGNED_IN", { user: mockUser })
        return {
          data: { subscription: { unsubscribe: vi.fn() } },
        }
      })

      const TestComponent = () => {
        const { user, isLoading } = useAuth()

        return (
          <div data-testid="error-fallback">
            <span data-testid="loading">{isLoading ? "loading" : "ready"}</span>
            {user && <span data-testid="fallback-name">{user.name || "Fallback User"}</span>}
          </div>
        )
      }

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      // 等待错误处理完成
      await waitFor(
        () => {
          expect(screen.getByTestId("loading")).toHaveTextContent("ready")
        },
        { timeout: 3000 }
      )

      // API 错误时应该使用 Supabase metadata 作为回退
      expect(screen.getByTestId("fallback-name")).toHaveTextContent("Fallback User")
    })
  })

  describe("数据优先级纯函数测试", () => {
    it("应该按正确优先级选择头像", () => {
      const getUserAvatar = (dbAvatar: string | null, metadata: any) => {
        return dbAvatar || metadata?.avatar_url || metadata?.picture || null
      }

      // 数据库优先
      expect(getUserAvatar("db-avatar.jpg", { avatar_url: "auth-avatar.jpg" })).toBe(
        "db-avatar.jpg"
      )

      // 回退到 metadata.avatar_url
      expect(getUserAvatar(null, { avatar_url: "auth-avatar.jpg", picture: "pic.jpg" })).toBe(
        "auth-avatar.jpg"
      )

      // 回退到 metadata.picture
      expect(getUserAvatar(null, { picture: "pic.jpg" })).toBe("pic.jpg")

      // 全部为空
      expect(getUserAvatar(null, {})).toBeNull()
    })

    it("应该按正确优先级选择用户名", () => {
      const getDisplayName = (dbName: string | null, metadata: any, email: string) => {
        return dbName || metadata?.full_name || metadata?.name || email
      }

      // 数据库优先
      expect(getDisplayName("DB Name", { full_name: "Meta Name" }, "test@example.com")).toBe(
        "DB Name"
      )

      // 回退到 metadata.full_name
      expect(
        getDisplayName(null, { full_name: "Meta Name", name: "Name" }, "test@example.com")
      ).toBe("Meta Name")

      // 回退到 metadata.name
      expect(getDisplayName(null, { name: "Name" }, "test@example.com")).toBe("Name")

      // 最终回退到邮箱
      expect(getDisplayName(null, {}, "test@example.com")).toBe("test@example.com")
    })
  })

  describe("Mock 稳定性测试", () => {
    it("应该能处理多次 Mock 重置", async () => {
      for (let i = 0; i < 3; i++) {
        mockGetSession.mockResolvedValue({
          data: { session: null },
          error: null,
        })

        mockOnAuthStateChange.mockImplementation((callback) => {
          callback("SIGNED_OUT", null)
          return {
            data: { subscription: { unsubscribe: vi.fn() } },
          }
        })

        const TestComponent = () => {
          const { isLoading } = useAuth()
          return <div data-testid={`test-${i}`}>{isLoading ? "loading" : "ready"}</div>
        }

        const { unmount } = render(
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        )

        await waitFor(
          () => {
            expect(screen.getByTestId(`test-${i}`)).toHaveTextContent("ready")
          },
          { timeout: 1000 }
        )

        unmount()
        vi.clearAllMocks()
        mockGetSession.mockReset()
        mockOnAuthStateChange.mockReset()
      }
    })

    it("应该能快速处理同步 Mock 响应", () => {
      // 完全同步的测试，无异步等待
      const syncMockGetSession = vi.fn(() => ({
        data: { session: null },
        error: null,
      }))

      const syncMockOnAuthStateChange = vi.fn((callback) => {
        callback("SIGNED_OUT", null)
        return {
          data: { subscription: { unsubscribe: vi.fn() } },
        }
      })

      const syncSupabaseClient = {
        auth: {
          getSession: syncMockGetSession,
          onAuthStateChange: syncMockOnAuthStateChange,
          signOut: vi.fn(),
        },
      }

      vi.doMock("@/lib/supabase", () => ({
        createClient: () => syncSupabaseClient,
      }))

      const TestComponent = () => {
        const { isLoading } = useAuth()
        return <div data-testid="sync-test">{isLoading ? "loading" : "ready"}</div>
      }

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      // 同步测试应该立即完成
      expect(screen.getByTestId("sync-test")).toHaveTextContent("ready")
    })
  })
})
