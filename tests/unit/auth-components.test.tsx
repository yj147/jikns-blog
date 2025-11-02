/**
 * 认证相关组件单元测试
 * 测试 <ProtectedRoute>、<AdminOnly>、<AuthRequired> 等权限组件
 */

import React from "react"
import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { TEST_USERS } from "../helpers/test-data"
import { setCurrentTestUser, resetMocks } from "../__mocks__/supabase"

// Mock Next.js navigation
const mockPush = vi.fn()
const mockReplace = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/test-path",
  useSearchParams: () => new URLSearchParams(),
}))

// Mock 认证 Provider
interface MockUser {
  id: string
  email: string
  name: string
  role: "USER" | "ADMIN"
  status: "ACTIVE" | "BANNED"
  avatarUrl?: string | null
  lastLoginAt: Date
  createdAt: Date
  updatedAt: Date
}

const mockAuthContext = {
  user: null as MockUser | null,
  isLoading: false,
  isAdmin: false,
  signIn: vi.fn(),
  signOut: vi.fn(),
  refresh: vi.fn(),
}

vi.mock("@/app/providers/auth-provider", () => ({
  useAuth: () => mockAuthContext,
}))

describe("认证组件单元测试", () => {
  const user = userEvent.setup()

  beforeEach(() => {
    resetMocks()
    vi.clearAllMocks()
    mockPush.mockClear()
    mockReplace.mockClear()

    // 重置 mock 认证状态
    mockAuthContext.user = null
    mockAuthContext.isLoading = false
    mockAuthContext.isAdmin = false
  })

  describe("<ProtectedRoute> 组件测试", () => {
    // 这个组件在 Phase 3 实现时会存在
    const ProtectedRoute = ({
      children,
      fallback,
    }: {
      children: React.ReactNode
      fallback?: React.ReactNode
    }) => {
      const { user: authUser, isLoading } = mockAuthContext

      if (isLoading) {
        return <div data-testid="loading">加载中...</div>
      }

      if (!authUser) {
        return fallback ? <>{fallback}</> : <div data-testid="unauthorized">请先登录</div>
      }

      if (authUser.status !== "ACTIVE") {
        return <div data-testid="banned">账户已被封禁</div>
      }

      return <>{children}</>
    }

    it("未登录用户应该显示未授权提示", () => {
      mockAuthContext.user = null

      render(
        <ProtectedRoute>
          <div data-testid="protected-content">受保护的内容</div>
        </ProtectedRoute>
      )

      expect(screen.getByTestId("unauthorized")).toBeInTheDocument()
      expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument()
    })

    it("已登录的活跃用户应该能看到保护内容", () => {
      mockAuthContext.user = TEST_USERS.user

      render(
        <ProtectedRoute>
          <div data-testid="protected-content">受保护的内容</div>
        </ProtectedRoute>
      )

      expect(screen.getByTestId("protected-content")).toBeInTheDocument()
      expect(screen.queryByTestId("unauthorized")).not.toBeInTheDocument()
    })

    it("被封禁用户应该看到封禁提示", () => {
      mockAuthContext.user = TEST_USERS.bannedUser

      render(
        <ProtectedRoute>
          <div data-testid="protected-content">受保护的内容</div>
        </ProtectedRoute>
      )

      expect(screen.getByTestId("banned")).toBeInTheDocument()
      expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument()
    })

    it("加载状态应该显示加载指示器", () => {
      mockAuthContext.isLoading = true

      render(
        <ProtectedRoute>
          <div data-testid="protected-content">受保护的内容</div>
        </ProtectedRoute>
      )

      expect(screen.getByTestId("loading")).toBeInTheDocument()
      expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument()
    })

    it("应该支持自定义 fallback 组件", () => {
      mockAuthContext.user = null

      render(
        <ProtectedRoute fallback={<div data-testid="custom-fallback">自定义未授权页面</div>}>
          <div data-testid="protected-content">受保护的内容</div>
        </ProtectedRoute>
      )

      expect(screen.getByTestId("custom-fallback")).toBeInTheDocument()
      expect(screen.queryByTestId("unauthorized")).not.toBeInTheDocument()
    })
  })

  describe("<AdminOnly> 组件测试", () => {
    const AdminOnly = ({
      children,
      fallback,
    }: {
      children: React.ReactNode
      fallback?: React.ReactNode
    }) => {
      const { user: authUser, isLoading } = mockAuthContext

      if (isLoading) {
        return <div data-testid="loading">加载中...</div>
      }

      if (!authUser) {
        return fallback ? <>{fallback}</> : null
      }

      if (authUser.role !== "ADMIN" || authUser.status !== "ACTIVE") {
        return fallback ? <>{fallback}</> : null
      }

      return <>{children}</>
    }

    it("管理员用户应该能看到管理员内容", () => {
      mockAuthContext.user = TEST_USERS.admin
      mockAuthContext.isAdmin = true

      render(
        <AdminOnly>
          <div data-testid="admin-content">管理员专用内容</div>
        </AdminOnly>
      )

      expect(screen.getByTestId("admin-content")).toBeInTheDocument()
    })

    it("普通用户不应该看到管理员内容", () => {
      mockAuthContext.user = TEST_USERS.user

      render(
        <AdminOnly>
          <div data-testid="admin-content">管理员专用内容</div>
        </AdminOnly>
      )

      expect(screen.queryByTestId("admin-content")).not.toBeInTheDocument()
    })

    it("未登录用户不应该看到管理员内容", () => {
      mockAuthContext.user = null

      render(
        <AdminOnly>
          <div data-testid="admin-content">管理员专用内容</div>
        </AdminOnly>
      )

      expect(screen.queryByTestId("admin-content")).not.toBeInTheDocument()
    })

    it("被封禁的管理员不应该看到管理员内容", () => {
      const bannedAdmin = { ...TEST_USERS.admin, status: "BANNED" as const }
      mockAuthContext.user = bannedAdmin

      render(
        <AdminOnly>
          <div data-testid="admin-content">管理员专用内容</div>
        </AdminOnly>
      )

      expect(screen.queryByTestId("admin-content")).not.toBeInTheDocument()
    })

    it("应该支持自定义 fallback", () => {
      mockAuthContext.user = TEST_USERS.user

      render(
        <AdminOnly fallback={<div data-testid="no-admin">权限不足</div>}>
          <div data-testid="admin-content">管理员专用内容</div>
        </AdminOnly>
      )

      expect(screen.getByTestId("no-admin")).toBeInTheDocument()
      expect(screen.queryByTestId("admin-content")).not.toBeInTheDocument()
    })
  })

  describe("<AuthRequired> 组件测试", () => {
    const AuthRequired = ({
      children,
      redirectTo = "/login",
      showFallback = true,
    }: {
      children: React.ReactNode
      redirectTo?: string
      showFallback?: boolean
    }) => {
      const { user: authUser, isLoading } = mockAuthContext

      React.useEffect(() => {
        if (!isLoading && !authUser && redirectTo) {
          const pathname = "/test-path" // Mock pathname
          mockReplace(`${redirectTo}?redirect=${encodeURIComponent(pathname)}`)
        }
      }, [authUser, isLoading, redirectTo])

      if (isLoading) {
        return <div data-testid="loading">正在验证身份...</div>
      }

      if (!authUser) {
        return showFallback ? (
          <div data-testid="auth-required">
            <p>此页面需要登录访问</p>
            <button onClick={() => mockPush("/login")}>去登录</button>
          </div>
        ) : null
      }

      return <>{children}</>
    }

    it("已认证用户应该能看到内容", () => {
      mockAuthContext.user = TEST_USERS.user

      render(
        <AuthRequired>
          <div data-testid="auth-content">需要认证的内容</div>
        </AuthRequired>
      )

      expect(screen.getByTestId("auth-content")).toBeInTheDocument()
    })

    it("未认证用户应该看到登录提示", () => {
      mockAuthContext.user = null

      render(
        <AuthRequired>
          <div data-testid="auth-content">需要认证的内容</div>
        </AuthRequired>
      )

      expect(screen.getByTestId("auth-required")).toBeInTheDocument()
      expect(screen.queryByTestId("auth-content")).not.toBeInTheDocument()
    })

    it("点击登录按钮应该跳转到登录页", async () => {
      mockAuthContext.user = null

      render(
        <AuthRequired>
          <div data-testid="auth-content">需要认证的内容</div>
        </AuthRequired>
      )

      const loginButton = screen.getByText("去登录")
      await user.click(loginButton)

      expect(mockPush).toHaveBeenCalledWith("/login")
    })

    it("应该自动重定向到登录页", () => {
      mockAuthContext.user = null
      mockAuthContext.isLoading = false

      render(
        <AuthRequired redirectTo="/auth/login">
          <div data-testid="auth-content">需要认证的内容</div>
        </AuthRequired>
      )

      expect(mockReplace).toHaveBeenCalledWith(expect.stringContaining("/auth/login?redirect="))
    })

    it("加载状态应该显示加载指示器", () => {
      mockAuthContext.isLoading = true

      render(
        <AuthRequired>
          <div data-testid="auth-content">需要认证的内容</div>
        </AuthRequired>
      )

      expect(screen.getByTestId("loading")).toBeInTheDocument()
      expect(screen.queryByTestId("auth-content")).not.toBeInTheDocument()
    })

    it("应该支持禁用 fallback 显示", () => {
      mockAuthContext.user = null

      const { container } = render(
        <AuthRequired showFallback={false}>
          <div data-testid="auth-content">需要认证的内容</div>
        </AuthRequired>
      )

      expect(container.firstChild).toBeNull()
    })
  })

  describe("权限 Hook 测试", () => {
    // 模拟权限 Hook
    const usePermissions = () => {
      const { user: authUser } = mockAuthContext

      return {
        isAuthenticated: !!authUser,
        isAdmin: authUser?.role === "ADMIN" && authUser?.status === "ACTIVE",
        isActive: authUser?.status === "ACTIVE",
        canAccess: (resource: string) => {
          if (!authUser) return false
          if (authUser.status !== "ACTIVE") return false

          if (resource.startsWith("admin:")) {
            return authUser.role === "ADMIN"
          }

          return true
        },
      }
    }

    const TestComponent = () => {
      const { isAuthenticated, isAdmin, canAccess } = usePermissions()

      return (
        <div>
          <div data-testid="authenticated">{isAuthenticated.toString()}</div>
          <div data-testid="admin">{isAdmin.toString()}</div>
          <div data-testid="can-access-admin">{canAccess("admin:users").toString()}</div>
          <div data-testid="can-access-user">{canAccess("user:profile").toString()}</div>
        </div>
      )
    }

    it("未登录用户的权限状态应该正确", () => {
      mockAuthContext.user = null

      render(<TestComponent />)

      expect(screen.getByTestId("authenticated")).toHaveTextContent("false")
      expect(screen.getByTestId("admin")).toHaveTextContent("false")
      expect(screen.getByTestId("can-access-admin")).toHaveTextContent("false")
      expect(screen.getByTestId("can-access-user")).toHaveTextContent("false")
    })

    it("普通用户的权限状态应该正确", () => {
      mockAuthContext.user = TEST_USERS.user

      render(<TestComponent />)

      expect(screen.getByTestId("authenticated")).toHaveTextContent("true")
      expect(screen.getByTestId("admin")).toHaveTextContent("false")
      expect(screen.getByTestId("can-access-admin")).toHaveTextContent("false")
      expect(screen.getByTestId("can-access-user")).toHaveTextContent("true")
    })

    it("管理员用户的权限状态应该正确", () => {
      mockAuthContext.user = TEST_USERS.admin

      render(<TestComponent />)

      expect(screen.getByTestId("authenticated")).toHaveTextContent("true")
      expect(screen.getByTestId("admin")).toHaveTextContent("true")
      expect(screen.getByTestId("can-access-admin")).toHaveTextContent("true")
      expect(screen.getByTestId("can-access-user")).toHaveTextContent("true")
    })

    it("被封禁用户的权限状态应该正确", () => {
      mockAuthContext.user = TEST_USERS.bannedUser

      render(<TestComponent />)

      expect(screen.getByTestId("authenticated")).toHaveTextContent("true")
      expect(screen.getByTestId("admin")).toHaveTextContent("false")
      expect(screen.getByTestId("can-access-admin")).toHaveTextContent("false")
      expect(screen.getByTestId("can-access-user")).toHaveTextContent("false")
    })
  })

  describe("用户界面响应测试", () => {
    const UserMenu = () => {
      const { user: authUser, isAdmin, signOut } = mockAuthContext

      if (!authUser) {
        return (
          <div data-testid="login-prompt">
            <button onClick={() => mockPush("/login")}>登录</button>
          </div>
        )
      }

      return (
        <div data-testid="user-menu">
          <div data-testid="user-name">{authUser.name}</div>
          <div data-testid="user-role">{authUser.role}</div>
          {isAdmin && <div data-testid="admin-badge">管理员</div>}
          <button onClick={signOut} data-testid="logout-btn">
            登出
          </button>
        </div>
      )
    }

    it("未登录状态应该显示登录按钮", () => {
      mockAuthContext.user = null

      render(<UserMenu />)

      expect(screen.getByTestId("login-prompt")).toBeInTheDocument()
      expect(screen.queryByTestId("user-menu")).not.toBeInTheDocument()
    })

    it("已登录状态应该显示用户菜单", () => {
      mockAuthContext.user = TEST_USERS.user

      render(<UserMenu />)

      expect(screen.getByTestId("user-menu")).toBeInTheDocument()
      expect(screen.getByTestId("user-name")).toHaveTextContent(TEST_USERS.user.name)
      expect(screen.getByTestId("user-role")).toHaveTextContent("USER")
    })

    it("管理员应该显示管理员标识", () => {
      mockAuthContext.user = TEST_USERS.admin
      mockAuthContext.isAdmin = true

      render(<UserMenu />)

      expect(screen.getByTestId("admin-badge")).toBeInTheDocument()
    })

    it("点击登出按钮应该调用登出函数", async () => {
      mockAuthContext.user = TEST_USERS.user

      render(<UserMenu />)

      const logoutButton = screen.getByTestId("logout-btn")
      await user.click(logoutButton)

      expect(mockAuthContext.signOut).toHaveBeenCalledOnce()
    })
  })

  describe("权限状态变更测试", () => {
    const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
      const { user: authUser } = mockAuthContext

      if (!authUser) {
        return <div data-testid="unauthorized">请先登录</div>
      }

      if (authUser.status === "BANNED") {
        return <div data-testid="banned">账户已被封禁</div>
      }

      return <>{children}</>
    }

    it("用户状态从未登录变为已登录应该更新UI", async () => {
      mockAuthContext.user = null

      const { rerender } = render(
        <ProtectedRoute>
          <div data-testid="protected-content">受保护内容</div>
        </ProtectedRoute>
      )

      expect(screen.getByTestId("unauthorized")).toBeInTheDocument()

      // 模拟用户登录
      mockAuthContext.user = TEST_USERS.user
      rerender(
        <ProtectedRoute>
          <div data-testid="protected-content">受保护内容</div>
        </ProtectedRoute>
      )

      expect(screen.getByTestId("protected-content")).toBeInTheDocument()
      expect(screen.queryByTestId("unauthorized")).not.toBeInTheDocument()
    })

    it("用户被封禁后应该更新UI状态", async () => {
      mockAuthContext.user = TEST_USERS.user

      const { rerender } = render(
        <ProtectedRoute>
          <div data-testid="protected-content">受保护内容</div>
        </ProtectedRoute>
      )

      expect(screen.getByTestId("protected-content")).toBeInTheDocument()

      // 模拟用户被封禁
      mockAuthContext.user = TEST_USERS.bannedUser
      rerender(
        <ProtectedRoute>
          <div data-testid="protected-content">受保护内容</div>
        </ProtectedRoute>
      )

      expect(screen.getByTestId("banned")).toBeInTheDocument()
      expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument()
    })
  })
})

// 辅助函数：等待异步状态更新
async function waitForAuthState(expectedState: "loading" | "authenticated" | "unauthenticated") {
  await waitFor(() => {
    switch (expectedState) {
      case "loading":
        expect(screen.getByTestId("loading")).toBeInTheDocument()
        break
      case "authenticated":
        expect(screen.queryByTestId("loading")).not.toBeInTheDocument()
        expect(screen.queryByTestId("unauthorized")).not.toBeInTheDocument()
        break
      case "unauthenticated":
        expect(screen.queryByTestId("loading")).not.toBeInTheDocument()
        expect(screen.getByTestId("unauthorized")).toBeInTheDocument()
        break
    }
  })
}
