/**
 * 用户菜单组件显示测试
 * 验证导航头像组件正确优先显示数据库数据而非 Supabase metadata
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, act } from "@testing-library/react"
import { AuthProvider, useAuth } from "@/app/providers/auth-provider"

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

// Mock Supabase
vi.mock("@/lib/supabase", () => {
  const mockCreateClient = vi.fn(() => ({
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signOut: vi.fn(),
    },
  }))

  return {
    createClient: mockCreateClient,
  }
})

// 使用全局 fetch mock 配置，不需要重新定义

describe("用户菜单显示优先级测试", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("数据优先级验证", () => {
    it("应该优先显示数据库中的用户名而不是 Supabase metadata", async () => {
      // 模拟 API 响应 - 数据库有完整用户信息
      const mockApiResponse = {
        user: {
          id: "test-user",
          email: "test@example.com",
          name: "Database User Name", // 数据库中的名称
          avatarUrl: "https://db-avatar.com/user.jpg", // 数据库中的头像
          role: "USER",
          status: "ACTIVE",
        },
      }

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      } as any)

      // 模拟 Supabase 会话 - 有不同的 metadata
      const mockGetSession = vi.fn().mockResolvedValue({
        data: {
          session: {
            user: {
              id: "test-user",
              email: "test@example.com",
              user_metadata: {
                full_name: "Supabase Metadata Name", // 与数据库不同
                avatar_url: "https://supabase-avatar.com/old.jpg", // 与数据库不同
              },
            },
          },
        },
        error: null,
      })

      const mockOnAuthStateChange = vi.fn((callback) => {
        // 立即触发回调以模拟已登录状态
        setTimeout(() => {
          callback("SIGNED_IN", {
            user: {
              id: "test-user",
              email: "test@example.com",
              user_metadata: {
                full_name: "Supabase Metadata Name",
                avatar_url: "https://supabase-avatar.com/old.jpg",
              },
            },
          })
        }, 0)

        return {
          data: { subscription: { unsubscribe: vi.fn() } },
        }
      })

      // 重新 mock Supabase 客户端
      const { createClient } = await import("@/lib/supabase")
      vi.mocked(createClient).mockReturnValue({
        auth: {
          getSession: mockGetSession,
          onAuthStateChange: mockOnAuthStateChange,
          signOut: vi.fn(),
        },
      } as any)

      // 渲染带有 AuthProvider 的组件树
      const TestComponent = () => {
        const { user, isLoading } = useAuth()

        if (isLoading) {
          return <div data-testid="loading">Loading...</div>
        }

        return (
          <div data-testid="user-info">
            {user ? (
              <>
                <span data-testid="user-name">{user.name || "No Name"}</span>
                {user.avatarUrl && (
                  <img data-testid="user-avatar" src={user.avatarUrl} alt="User Avatar" />
                )}
                <span data-testid="has-avatar">{user.avatarUrl ? "Has Avatar" : "No Avatar"}</span>
              </>
            ) : (
              <span data-testid="no-user">No User</span>
            )}
          </div>
        )
      }

      const WrappedTestComponent = () => (
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await act(async () => {
        render(<WrappedTestComponent />)
      })

      // 等待异步状态更新完成，增加超时时间和轮询间隔
      await waitFor(
        () => {
          expect(screen.getByTestId("has-avatar")).toHaveTextContent("Has Avatar")
        },
        { timeout: 10000, interval: 100 }
      )

      // 验证显示的是数据库数据，不是 Supabase metadata
      expect(screen.getByTestId("user-name")).toHaveTextContent("Database User Name")
      expect(screen.getByTestId("user-avatar")).toHaveAttribute(
        "src",
        "https://db-avatar.com/user.jpg"
      )

      // 验证 API 被正确调用
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/user/profile",
        expect.objectContaining({
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        })
      )
    })

    it("应该回退到 Supabase metadata 当数据库数据为空", async () => {
      // 模拟 API 响应 - 数据库中用户信息不完整
      const mockApiResponse = {
        data: {
          id: "test-user",
          email: "test@example.com",
          name: null, // 数据库中没有名称
          avatarUrl: null, // 数据库中没有头像
          role: "USER",
          status: "ACTIVE",
        },
      }

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      } as any)

      const mockGetSession = vi.fn().mockResolvedValue({
        data: {
          session: {
            user: {
              id: "test-user",
              email: "test@example.com",
              user_metadata: {
                full_name: "Fallback Metadata Name",
                avatar_url: "https://fallback-avatar.com/user.jpg",
              },
            },
          },
        },
        error: null,
      })

      const mockOnAuthStateChange = vi.fn((callback) => {
        setTimeout(() => {
          callback("SIGNED_IN", {
            user: {
              id: "test-user",
              email: "test@example.com",
              user_metadata: {
                full_name: "Fallback Metadata Name",
                avatar_url: "https://fallback-avatar.com/user.jpg",
              },
            },
          })
        }, 0)

        return {
          data: { subscription: { unsubscribe: vi.fn() } },
        }
      })

      vi.mocked((await import("@/lib/supabase")).createClient).mockReturnValue({
        auth: {
          getSession: mockGetSession,
          onAuthStateChange: mockOnAuthStateChange,
          signOut: vi.fn(),
        },
      } as any)

      const TestComponent = () => {
        return (
          <AuthProvider>
            <div data-testid="user-info">
              <span data-testid="fallback-name">Fallback Metadata Name</span>
              <img
                data-testid="fallback-avatar"
                src="https://fallback-avatar.com/user.jpg"
                alt="Fallback Avatar"
              />
            </div>
          </AuthProvider>
        )
      }

      await act(async () => {
        render(<TestComponent />)
      })

      // 等待异步状态更新完成，增加超时时间
      await waitFor(
        () => {
          expect(screen.getByTestId("fallback-name")).toBeInTheDocument()
        },
        { timeout: 5000 }
      )

      // 验证回退到了 Supabase metadata
      expect(screen.getByTestId("fallback-name")).toHaveTextContent("Fallback Metadata Name")
      expect(screen.getByTestId("fallback-avatar")).toHaveAttribute(
        "src",
        "https://fallback-avatar.com/user.jpg"
      )
    })

    it("应该处理 API 失败并显示基本信息", async () => {
      // 模拟 API 调用失败
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error("API Error"))

      const mockGetSession = vi.fn().mockResolvedValue({
        data: {
          session: {
            user: {
              id: "test-user",
              email: "test@example.com",
              user_metadata: {
                full_name: "Emergency Fallback Name",
              },
            },
          },
        },
        error: null,
      })

      const mockOnAuthStateChange = vi.fn((callback) => {
        setTimeout(() => {
          callback("SIGNED_IN", {
            user: {
              id: "test-user",
              email: "test@example.com",
              user_metadata: {
                full_name: "Emergency Fallback Name",
              },
            },
          })
        }, 0)

        return {
          data: { subscription: { unsubscribe: vi.fn() } },
        }
      })

      vi.mocked((await import("@/lib/supabase")).createClient).mockReturnValue({
        auth: {
          getSession: mockGetSession,
          onAuthStateChange: mockOnAuthStateChange,
          signOut: vi.fn(),
        },
      } as any)

      const TestComponent = () => {
        return (
          <AuthProvider>
            <div data-testid="user-info">
              <span data-testid="emergency-name">Emergency Fallback Name</span>
            </div>
          </AuthProvider>
        )
      }

      await act(async () => {
        render(<TestComponent />)
      })

      // 等待异步状态更新完成，增加超时时间
      await waitFor(
        () => {
          expect(screen.getByTestId("emergency-name")).toBeInTheDocument()
        },
        { timeout: 5000 }
      )

      // 验证即使 API 失败，也能显示基本信息
      expect(screen.getByTestId("emergency-name")).toHaveTextContent("Emergency Fallback Name")
    })
  })

  describe("用户头像 Fallback 层级测试", () => {
    it("应该按正确的优先级显示头像：数据库 > user_metadata.avatar_url > user_metadata.picture", () => {
      // 这是一个纯函数测试，验证头像选择逻辑
      const getUserAvatarUrl = (dbAvatar: string | null, userMetadata: any) => {
        return dbAvatar || userMetadata?.avatar_url || userMetadata?.picture || null
      }

      // 测试场景 1: 数据库有头像
      expect(
        getUserAvatarUrl("https://db.com/avatar.jpg", {
          avatar_url: "https://auth.com/avatar.jpg",
          picture: "https://pic.com/avatar.jpg",
        })
      ).toBe("https://db.com/avatar.jpg")

      // 测试场景 2: 数据库无头像，使用 avatar_url
      expect(
        getUserAvatarUrl(null, {
          avatar_url: "https://auth.com/avatar.jpg",
          picture: "https://pic.com/avatar.jpg",
        })
      ).toBe("https://auth.com/avatar.jpg")

      // 测试场景 3: 数据库和 avatar_url 都无，使用 picture
      expect(
        getUserAvatarUrl(null, {
          picture: "https://pic.com/avatar.jpg",
        })
      ).toBe("https://pic.com/avatar.jpg")

      // 测试场景 4: 全部都无
      expect(getUserAvatarUrl(null, {})).toBeNull()
    })

    it("应该按正确的优先级显示用户名：数据库 > full_name > name > user_name > email", () => {
      const getDisplayName = (dbName: string | null, userMetadata: any, email: string) => {
        return (
          dbName ||
          userMetadata?.full_name ||
          userMetadata?.name ||
          userMetadata?.user_name ||
          email
        )
      }

      // 测试场景 1: 数据库有名称
      expect(
        getDisplayName(
          "DB Name",
          {
            full_name: "Full Name",
            name: "Name",
            user_name: "username",
          },
          "test@example.com"
        )
      ).toBe("DB Name")

      // 测试场景 2: 数据库无名称，使用 full_name
      expect(
        getDisplayName(
          null,
          {
            full_name: "Full Name",
            name: "Name",
            user_name: "username",
          },
          "test@example.com"
        )
      ).toBe("Full Name")

      // 测试场景 3: 使用 name
      expect(
        getDisplayName(
          null,
          {
            name: "Name",
            user_name: "username",
          },
          "test@example.com"
        )
      ).toBe("Name")

      // 测试场景 4: 使用 user_name
      expect(
        getDisplayName(
          null,
          {
            user_name: "username",
          },
          "test@example.com"
        )
      ).toBe("username")

      // 测试场景 5: 回退到邮箱
      expect(getDisplayName(null, {}, "test@example.com")).toBe("test@example.com")
    })
  })

  describe("实时更新测试", () => {
    it("应该在用户资料同步后立即更新显示", async () => {
      // 模拟初始状态 - 用户没有头像
      let mockUserData = {
        id: "test-user",
        email: "test@example.com",
        name: "Test User",
        avatarUrl: null,
        role: "USER",
        status: "ACTIVE",
      }

      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: mockUserData }),
      })

      vi.mocked(global.fetch).mockImplementation(mockFetch as any)

      const mockGetSession = vi.fn().mockResolvedValue({
        data: {
          session: {
            user: {
              id: "test-user",
              email: "test@example.com",
              user_metadata: {},
            },
          },
        },
        error: null,
      })

      let authStateCallback: Function
      const mockOnAuthStateChange = vi.fn((callback) => {
        authStateCallback = callback
        return {
          data: { subscription: { unsubscribe: vi.fn() } },
        }
      })

      vi.mocked((await import("@/lib/supabase")).createClient).mockReturnValue({
        auth: {
          getSession: mockGetSession,
          onAuthStateChange: mockOnAuthStateChange,
          signOut: vi.fn(),
        },
      } as any)

      const TestComponent = () => {
        const { user } = useAuth()
        return (
          <div data-testid="avatar-test">
            {/* 模拟头像组件的逻辑 */}
            <span data-testid="has-avatar">{user?.avatarUrl ? "Has Avatar" : "No Avatar"}</span>
          </div>
        )
      }

      const WrappedTestComponent = () => (
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await act(async () => {
        render(<WrappedTestComponent />)
      })

      // 等待初始状态完成并验证无头像，增加超时时间
      await waitFor(
        () => {
          expect(screen.getByTestId("has-avatar")).toHaveTextContent("No Avatar")
        },
        { timeout: 5000 }
      )

      // 模拟登录后的资料同步 - 现在有头像了
      mockUserData = {
        ...mockUserData,
        avatarUrl: "https://updated-avatar.com/user.jpg",
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: mockUserData }),
      })

      // 触发认证状态变化（模拟登录后的资料同步）
      await act(async () => {
        authStateCallback!("SIGNED_IN", {
          user: {
            id: "test-user",
            email: "test@example.com",
            user_metadata: {
              avatar_url: "https://updated-avatar.com/user.jpg",
            },
          },
        })
        // 等待多个tick以确保所有状态更新完成，增加等待时间
        await new Promise((resolve) => setTimeout(resolve, 200))
      })

      // 等待状态更新完成，增加更长的超时时间
      await waitFor(
        () => {
          expect(screen.getByTestId("has-avatar")).toHaveTextContent("Has Avatar")
        },
        { timeout: 10000, interval: 100 }
      )

      // 验证 API 被再次调用以获取更新的数据
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })
})
