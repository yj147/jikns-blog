/**
 * 前端权限组件集成测试
 * 测试 ProtectedRoute、AdminOnly 等权限相关组件的集成表现
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { useRouter } from "next/navigation"
import { TEST_USERS } from "../helpers/test-data"
import { setCurrentTestUser, resetMocks } from "../__mocks__/supabase"

// Mock Next.js router
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}))

// Mock AuthProvider context
const mockUseAuth = vi.fn()
vi.mock("@/app/providers/auth-provider", () => ({
  useAuth: () => mockUseAuth(),
}))

// 导入要测试的组件
import { ProtectedRoute } from "@/components/auth/protected-route"
import { AdminOnly } from "@/components/auth/admin-only"

describe("前端权限组件集成测试", () => {
  const mockPush = vi.fn()
  const mockReplace = vi.fn()

  beforeEach(() => {
    resetMocks()
    vi.clearAllMocks()

    // 设置 router mock
    vi.mocked(useRouter).mockReturnValue({
      push: mockPush,
      replace: mockReplace,
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn(),
    } as any)
  })

  describe("ProtectedRoute 组件测试", () => {
    it("应该在加载状态显示加载指示器", () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: true,
      })

      render(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      )

      expect(screen.getByTestId("loading")).toBeInTheDocument()
      expect(screen.getByText("验证身份中...")).toBeInTheDocument()
      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument()
    })

    it("应该为未认证用户显示登录提示", () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
      })

      render(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      )

      expect(screen.getByTestId("unauthorized")).toBeInTheDocument()
      expect(screen.getByText("需要登录")).toBeInTheDocument()
      expect(screen.getByText("此页面需要登录后才能访问")).toBeInTheDocument()
      expect(screen.getByText("前往登录")).toBeInTheDocument()
      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument()
    })

    it("应该为被封禁用户显示封禁提示", () => {
      mockUseAuth.mockReturnValue({
        user: TEST_USERS.bannedUser,
        isLoading: false,
      })

      render(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      )

      expect(screen.getByTestId("banned")).toBeInTheDocument()
      expect(screen.getByText("账户已被封禁")).toBeInTheDocument()
      expect(screen.getByText("您的账户已被管理员封禁，无法访问此页面")).toBeInTheDocument()
      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument()
    })

    it("应该为活跃用户显示保护内容", () => {
      mockUseAuth.mockReturnValue({
        user: TEST_USERS.user,
        isLoading: false,
      })

      render(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      )

      expect(screen.getByText("Protected Content")).toBeInTheDocument()
      expect(screen.queryByTestId("loading")).not.toBeInTheDocument()
      expect(screen.queryByTestId("unauthorized")).not.toBeInTheDocument()
      expect(screen.queryByTestId("banned")).not.toBeInTheDocument()
    })

    it("应该在未认证时自动重定向到登录页", async () => {
      // Mock window.location
      delete (window as any).location
      window.location = { pathname: "/profile", search: "?tab=settings" } as any

      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
      })

      render(
        <ProtectedRoute redirectTo="/login">
          <div>Protected Content</div>
        </ProtectedRoute>
      )

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith("/login?redirect=%2Fprofile%3Ftab%3Dsettings")
      })
    })

    it("应该支持自定义 fallback 内容", () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
      })

      const CustomFallback = () => (
        <div data-testid="custom-fallback">Custom unauthorized message</div>
      )

      render(
        <ProtectedRoute fallback={<CustomFallback />}>
          <div>Protected Content</div>
        </ProtectedRoute>
      )

      expect(screen.getByTestId("custom-fallback")).toBeInTheDocument()
      expect(screen.getByText("Custom unauthorized message")).toBeInTheDocument()
      expect(screen.queryByTestId("unauthorized")).not.toBeInTheDocument()
    })

    it("应该支持隐藏加载状态", () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: true,
      })

      render(
        <ProtectedRoute showLoading={false}>
          <div>Protected Content</div>
        </ProtectedRoute>
      )

      expect(screen.queryByTestId("loading")).not.toBeInTheDocument()
    })
  })

  describe("AdminOnly 组件测试", () => {
    it("应该在加载状态显示加载指示器", () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: true,
      })

      render(
        <AdminOnly>
          <div>Admin Content</div>
        </AdminOnly>
      )

      expect(screen.getByTestId("loading")).toBeInTheDocument()
      expect(screen.getByText("加载中...")).toBeInTheDocument()
      expect(screen.queryByText("Admin Content")).not.toBeInTheDocument()
    })

    it("应该为非管理员用户隐藏内容（默认模式）", () => {
      mockUseAuth.mockReturnValue({
        user: TEST_USERS.user, // 普通用户
        isLoading: false,
      })

      render(
        <AdminOnly>
          <div>Admin Content</div>
        </AdminOnly>
      )

      expect(screen.queryByText("Admin Content")).not.toBeInTheDocument()
    })

    it("应该为未登录用户隐藏内容", () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
      })

      render(
        <AdminOnly>
          <div>Admin Content</div>
        </AdminOnly>
      )

      expect(screen.queryByText("Admin Content")).not.toBeInTheDocument()
    })

    it("应该为被封禁的管理员隐藏内容", () => {
      mockUseAuth.mockReturnValue({
        user: { ...TEST_USERS.admin, status: "BANNED" as const },
        isLoading: false,
      })

      render(
        <AdminOnly>
          <div>Admin Content</div>
        </AdminOnly>
      )

      expect(screen.queryByText("Admin Content")).not.toBeInTheDocument()
    })

    it("应该为活跃的管理员显示内容", () => {
      mockUseAuth.mockReturnValue({
        user: TEST_USERS.admin,
        isLoading: false,
      })

      render(
        <AdminOnly>
          <div>Admin Content</div>
        </AdminOnly>
      )

      expect(screen.getByText("Admin Content")).toBeInTheDocument()
      expect(screen.queryByTestId("loading")).not.toBeInTheDocument()
    })

    it("应该支持自定义 fallback 内容", () => {
      mockUseAuth.mockReturnValue({
        user: TEST_USERS.user,
        isLoading: false,
      })

      const CustomFallback = () => <div data-testid="custom-admin-fallback">需要管理员权限</div>

      render(
        <AdminOnly fallback={<CustomFallback />}>
          <div>Admin Content</div>
        </AdminOnly>
      )

      expect(screen.getByTestId("custom-admin-fallback")).toBeInTheDocument()
      expect(screen.getByText("需要管理员权限")).toBeInTheDocument()
      expect(screen.queryByText("Admin Content")).not.toBeInTheDocument()
    })

    it("应该支持显示权限提示", () => {
      mockUseAuth.mockReturnValue({
        user: TEST_USERS.user,
        isLoading: false,
      })

      render(
        <AdminOnly showFallback={true}>
          <div>Admin Content</div>
        </AdminOnly>
      )

      expect(screen.getByTestId("no-admin-permission")).toBeInTheDocument()
      expect(screen.getByText("此内容仅限管理员查看")).toBeInTheDocument()
      expect(screen.queryByText("Admin Content")).not.toBeInTheDocument()
    })
  })

  describe("组件集成场景测试", () => {
    it("应该正确处理 ProtectedRoute 包装 AdminOnly 的嵌套场景", () => {
      mockUseAuth.mockReturnValue({
        user: TEST_USERS.admin,
        isLoading: false,
      })

      render(
        <ProtectedRoute>
          <AdminOnly>
            <div>Nested Admin Content</div>
          </AdminOnly>
        </ProtectedRoute>
      )

      expect(screen.getByText("Nested Admin Content")).toBeInTheDocument()
    })

    it("嵌套组件应该优先显示外层保护的错误", () => {
      mockUseAuth.mockReturnValue({
        user: null, // 未登录
        isLoading: false,
      })

      render(
        <ProtectedRoute>
          <AdminOnly showFallback={true}>
            <div>Nested Admin Content</div>
          </AdminOnly>
        </ProtectedRoute>
      )

      // 应该显示 ProtectedRoute 的未授权提示，而不是 AdminOnly 的提示
      expect(screen.getByTestId("unauthorized")).toBeInTheDocument()
      expect(screen.queryByTestId("no-admin-permission")).not.toBeInTheDocument()
      expect(screen.queryByText("Nested Admin Content")).not.toBeInTheDocument()
    })

    it("嵌套组件应该正确处理普通用户访问管理员内容的场景", () => {
      mockUseAuth.mockReturnValue({
        user: TEST_USERS.user, // 普通用户
        isLoading: false,
      })

      render(
        <ProtectedRoute>
          <AdminOnly showFallback={true}>
            <div>Nested Admin Content</div>
          </AdminOnly>
        </ProtectedRoute>
      )

      // ProtectedRoute 应该通过（用户已认证），AdminOnly 应该显示权限提示
      expect(screen.queryByTestId("unauthorized")).not.toBeInTheDocument()
      expect(screen.getByTestId("no-admin-permission")).toBeInTheDocument()
      expect(screen.queryByText("Nested Admin Content")).not.toBeInTheDocument()
    })
  })

  describe("权限状态变化测试", () => {
    it("应该响应用户状态的动态变化", async () => {
      const { rerender } = render(
        <AdminOnly>
          <div>Admin Content</div>
        </AdminOnly>
      )

      // 初始状态：加载中
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: true,
      })

      rerender(
        <AdminOnly>
          <div>Admin Content</div>
        </AdminOnly>
      )

      expect(screen.getByTestId("loading")).toBeInTheDocument()

      // 状态变化：管理员登录
      mockUseAuth.mockReturnValue({
        user: TEST_USERS.admin,
        isLoading: false,
      })

      rerender(
        <AdminOnly>
          <div>Admin Content</div>
        </AdminOnly>
      )

      expect(screen.queryByTestId("loading")).not.toBeInTheDocument()
      expect(screen.getByText("Admin Content")).toBeInTheDocument()

      // 状态变化：管理员被封禁
      mockUseAuth.mockReturnValue({
        user: { ...TEST_USERS.admin, status: "BANNED" as const },
        isLoading: false,
      })

      rerender(
        <AdminOnly>
          <div>Admin Content</div>
        </AdminOnly>
      )

      expect(screen.queryByText("Admin Content")).not.toBeInTheDocument()
    })

    it("应该在用户权限降级时隐藏内容", async () => {
      const { rerender } = render(
        <AdminOnly>
          <div>Admin Content</div>
        </AdminOnly>
      )

      // 初始状态：管理员
      mockUseAuth.mockReturnValue({
        user: TEST_USERS.admin,
        isLoading: false,
      })

      rerender(
        <AdminOnly>
          <div>Admin Content</div>
        </AdminOnly>
      )

      expect(screen.getByText("Admin Content")).toBeInTheDocument()

      // 权限变化：降级为普通用户
      mockUseAuth.mockReturnValue({
        user: { ...TEST_USERS.admin, role: "USER" as const },
        isLoading: false,
      })

      rerender(
        <AdminOnly showFallback={true}>
          <div>Admin Content</div>
        </AdminOnly>
      )

      expect(screen.queryByText("Admin Content")).not.toBeInTheDocument()
      expect(screen.getByTestId("no-admin-permission")).toBeInTheDocument()
    })
  })

  describe("无障碍性和可用性测试", () => {
    it("加载状态应该有正确的语义化标记", () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: true,
      })

      render(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      )

      const loadingElement = screen.getByTestId("loading")
      expect(loadingElement).toHaveClass("flex", "items-center", "justify-center")

      // 应该有适当的加载文本
      expect(screen.getByText("验证身份中...")).toBeInTheDocument()
    })

    it("未授权状态应该有清晰的用户指引", () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
      })

      render(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      )

      // 应该有明确的标题和说明
      expect(screen.getByText("需要登录")).toBeInTheDocument()
      expect(screen.getByText("此页面需要登录后才能访问")).toBeInTheDocument()

      // 应该有可操作的按钮
      const loginButton = screen.getByText("前往登录")
      expect(loginButton).toBeInTheDocument()
      expect(loginButton).toHaveClass("px-4", "py-2")
    })

    it("封禁状态应该有适当的视觉反馈", () => {
      mockUseAuth.mockReturnValue({
        user: TEST_USERS.bannedUser,
        isLoading: false,
      })

      render(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      )

      const bannedElement = screen.getByTestId("banned")
      expect(bannedElement).toHaveClass("flex", "flex-col")

      const title = screen.getByText("账户已被封禁")
      expect(title).toHaveClass("text-2xl", "font-semibold", "text-destructive")
    })
  })
})
