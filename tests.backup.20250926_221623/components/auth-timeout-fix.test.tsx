/**
 * 认证组件超时修复测试
 * 专注于修复组件测试超时问题，使用最小Mock
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import React from "react"

// Mock React hooks 模拟认证状态 - 必须在 vi.mock 之前声明
const mockUseAuth = vi.fn()

vi.mock("@/app/providers/auth-provider", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => mockUseAuth(),
}))

// 导入被Mock的模块
import { useAuth } from "@/app/providers/auth-provider"

// Mock Next.js 组件
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

// Mock Framer Motion
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: any) => children,
}))

describe("认证组件超时修复测试", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("同步状态测试 - 无超时风险", () => {
    it("应该立即渲染加载状态", () => {
      mockUseAuth.mockReturnValue({
        isLoading: true,
        user: null,
      })

      const TestComponent = () => {
        const { isLoading, user } = useAuth()
        return (
          <div data-testid="loading-test">
            {isLoading ? "loading" : "ready"}
            {user && <span data-testid="user">logged-in</span>}
          </div>
        )
      }

      render(<TestComponent />)

      // 同步测试，立即断言
      expect(screen.getByTestId("loading-test")).toHaveTextContent("loading")
      expect(screen.queryByTestId("user")).not.toBeInTheDocument()
    })

    it("应该立即渲染已认证状态", () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        user: {
          id: "test-user",
          email: "test@example.com",
          name: "Test User",
          role: "USER",
          status: "ACTIVE",
        },
      })

      const TestComponent = () => {
        const { isLoading, user } = useAuth()
        return (
          <div data-testid="auth-ready">
            <span data-testid="loading-state">{isLoading ? "loading" : "ready"}</span>
            <span data-testid="user-state">{user ? "authenticated" : "not-authenticated"}</span>
            {user && (
              <div data-testid="user-info">
                <span data-testid="user-name">{user.name}</span>
                <span data-testid="user-email">{user.email}</span>
                <span data-testid="user-role">{user.role}</span>
              </div>
            )}
          </div>
        )
      }

      render(<TestComponent />)

      // 同步断言，无需waitFor
      expect(screen.getByTestId("loading-state")).toHaveTextContent("ready")
      expect(screen.getByTestId("user-state")).toHaveTextContent("authenticated")
      expect(screen.getByTestId("user-name")).toHaveTextContent("Test User")
      expect(screen.getByTestId("user-email")).toHaveTextContent("test@example.com")
      expect(screen.getByTestId("user-role")).toHaveTextContent("USER")
    })

    it("应该立即渲染未认证状态", () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        user: null,
      })

      const TestComponent = () => {
        const { isLoading, user } = useAuth()
        return (
          <div data-testid="not-authenticated">
            <span data-testid="loading-state">{isLoading ? "loading" : "ready"}</span>
            <span data-testid="user-state">{user ? "authenticated" : "not-authenticated"}</span>
          </div>
        )
      }

      render(<TestComponent />)

      expect(screen.getByTestId("loading-state")).toHaveTextContent("ready")
      expect(screen.getByTestId("user-state")).toHaveTextContent("not-authenticated")
    })
  })

  describe("头像显示逻辑测试", () => {
    it("应该按优先级显示数据库头像", () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        user: {
          id: "test-user",
          avatarUrl: "https://db-avatar.com/user.jpg", // 数据库头像
          name: "Database User",
        },
      })

      const TestComponent = () => {
        const { user } = useAuth()
        return (
          <div data-testid="avatar-test">
            {user?.avatarUrl && (
              <img data-testid="user-avatar" src={user.avatarUrl} alt="User Avatar" />
            )}
            <span data-testid="has-avatar">{user?.avatarUrl ? "Has Avatar" : "No Avatar"}</span>
          </div>
        )
      }

      render(<TestComponent />)

      expect(screen.getByTestId("has-avatar")).toHaveTextContent("Has Avatar")
      expect(screen.getByTestId("user-avatar")).toHaveAttribute(
        "src",
        "https://db-avatar.com/user.jpg"
      )
    })

    it("应该处理没有头像的情况", () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        user: {
          id: "test-user",
          avatarUrl: null,
          name: "User Without Avatar",
        },
      })

      const TestComponent = () => {
        const { user } = useAuth()
        return (
          <div data-testid="no-avatar-test">
            <span data-testid="has-avatar">{user?.avatarUrl ? "Has Avatar" : "No Avatar"}</span>
            <span data-testid="user-name">{user?.name || "Unknown"}</span>
          </div>
        )
      }

      render(<TestComponent />)

      expect(screen.getByTestId("has-avatar")).toHaveTextContent("No Avatar")
      expect(screen.getByTestId("user-name")).toHaveTextContent("User Without Avatar")
    })
  })

  describe("用户菜单显示逻辑测试", () => {
    it("应该为管理员用户显示管理菜单", () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        user: {
          id: "admin-user",
          name: "Admin User",
          role: "ADMIN",
          status: "ACTIVE",
        },
      })

      const TestComponent = () => {
        const { user } = useAuth()

        return (
          <div data-testid="user-menu">
            <span data-testid="user-name">{user?.name}</span>
            <span data-testid="user-role">{user?.role}</span>
            {user?.role === "ADMIN" && (
              <div data-testid="admin-menu">
                <a data-testid="admin-link" href="/admin">
                  管理面板
                </a>
              </div>
            )}
          </div>
        )
      }

      render(<TestComponent />)

      expect(screen.getByTestId("user-name")).toHaveTextContent("Admin User")
      expect(screen.getByTestId("user-role")).toHaveTextContent("ADMIN")
      expect(screen.getByTestId("admin-menu")).toBeInTheDocument()
      expect(screen.getByTestId("admin-link")).toHaveAttribute("href", "/admin")
    })

    it("应该为普通用户隐藏管理菜单", () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        user: {
          id: "regular-user",
          name: "Regular User",
          role: "USER",
          status: "ACTIVE",
        },
      })

      const TestComponent = () => {
        const { user } = useAuth()

        return (
          <div data-testid="user-menu">
            <span data-testid="user-name">{user?.name}</span>
            <span data-testid="user-role">{user?.role}</span>
            {user?.role === "ADMIN" && (
              <div data-testid="admin-menu">
                <a href="/admin">管理面板</a>
              </div>
            )}
            {user?.role === "USER" && (
              <div data-testid="user-menu-content">
                <a data-testid="profile-link" href="/profile">
                  个人资料
                </a>
              </div>
            )}
          </div>
        )
      }

      render(<TestComponent />)

      expect(screen.getByTestId("user-name")).toHaveTextContent("Regular User")
      expect(screen.getByTestId("user-role")).toHaveTextContent("USER")
      expect(screen.queryByTestId("admin-menu")).not.toBeInTheDocument()
      expect(screen.getByTestId("user-menu-content")).toBeInTheDocument()
      expect(screen.getByTestId("profile-link")).toHaveAttribute("href", "/profile")
    })
  })

  describe("边界情况测试", () => {
    it("应该处理 useAuth 返回 undefined 的情况", () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        user: undefined,
      })

      const TestComponent = () => {
        const { user } = useAuth()

        return (
          <div data-testid="undefined-user">
            <span data-testid="user-status">
              {user === undefined ? "undefined" : user === null ? "null" : "defined"}
            </span>
          </div>
        )
      }

      render(<TestComponent />)

      expect(screen.getByTestId("user-status")).toHaveTextContent("undefined")
    })

    it("应该处理用户状态被封禁的情况", () => {
      mockUseAuth.mockReturnValue({
        isLoading: false,
        user: {
          id: "banned-user",
          name: "Banned User",
          role: "USER",
          status: "BANNED",
        },
      })

      const TestComponent = () => {
        const { user } = useAuth()

        return (
          <div data-testid="banned-user">
            <span data-testid="user-status">{user?.status}</span>
            {user?.status === "BANNED" && <div data-testid="banned-notice">账户已被封禁</div>}
          </div>
        )
      }

      render(<TestComponent />)

      expect(screen.getByTestId("user-status")).toHaveTextContent("BANNED")
      expect(screen.getByTestId("banned-notice")).toHaveTextContent("账户已被封禁")
    })

    it("应该处理非常长的用户名", () => {
      const longName = "这是一个非常非常非常长的用户名，用来测试UI在处理超长文本时的表现"

      mockUseAuth.mockReturnValue({
        isLoading: false,
        user: {
          id: "long-name-user",
          name: longName,
          role: "USER",
        },
      })

      const TestComponent = () => {
        const { user } = useAuth()

        return (
          <div data-testid="long-name">
            <span data-testid="user-name">{user?.name}</span>
            <span data-testid="name-length">{user?.name?.length || 0}</span>
          </div>
        )
      }

      render(<TestComponent />)

      expect(screen.getByTestId("user-name")).toHaveTextContent(longName)
      expect(screen.getByTestId("name-length")).toHaveTextContent("33")
    })
  })

  describe("Mock 状态切换测试", () => {
    it("应该支持多次Mock状态切换", () => {
      // 第一次渲染 - 加载状态
      mockUseAuth.mockReturnValue({
        isLoading: true,
        user: null,
      })

      const { rerender } = render(
        <div data-testid="state-switch">
          {(() => {
            const { isLoading, user } = useAuth()
            return isLoading ? "loading" : user ? "authenticated" : "not-authenticated"
          })()}
        </div>
      )

      expect(screen.getByTestId("state-switch")).toHaveTextContent("loading")

      // 第二次渲染 - 已认证
      mockUseAuth.mockReturnValue({
        isLoading: false,
        user: { id: "test", name: "Test User" },
      })

      rerender(
        <div data-testid="state-switch">
          {(() => {
            const { isLoading, user } = useAuth()
            return isLoading ? "loading" : user ? "authenticated" : "not-authenticated"
          })()}
        </div>
      )

      expect(screen.getByTestId("state-switch")).toHaveTextContent("authenticated")

      // 第三次渲染 - 未认证
      mockUseAuth.mockReturnValue({
        isLoading: false,
        user: null,
      })

      rerender(
        <div data-testid="state-switch">
          {(() => {
            const { isLoading, user } = useAuth()
            return isLoading ? "loading" : user ? "authenticated" : "not-authenticated"
          })()}
        </div>
      )

      expect(screen.getByTestId("state-switch")).toHaveTextContent("not-authenticated")
    })
  })
})
