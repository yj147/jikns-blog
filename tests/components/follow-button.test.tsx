import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, beforeEach, vi } from "vitest"

import FollowButton from "@/components/follow/follow-button"
import { useFollowUser } from "@/hooks/use-follow-user"
import { toast } from "sonner"

vi.mock("@/hooks/use-follow-user", () => ({
  useFollowUser: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const mockUseFollowUser = vi.mocked(useFollowUser)

function createHookReturn() {
  return {
    followUser: vi.fn(),
    unfollowUser: vi.fn(),
    toggleFollow: vi.fn().mockResolvedValue({ success: true }),
    isFollowing: vi.fn().mockReturnValue(false),
    clearError: vi.fn(),
    isLoading: false,
    error: null as any,
    followingUsers: new Set<string>(),
  }
}

describe("FollowButton", () => {
  const defaultProps = { targetUserId: "user-123" }
  let hookReturn = createHookReturn()

  beforeEach(() => {
    vi.clearAllMocks()
    hookReturn = createHookReturn()
    mockUseFollowUser.mockReturnValue(hookReturn)
  })

  describe("基础渲染", () => {
    it("渲染默认关注按钮", () => {
      render(<FollowButton {...defaultProps} />)

      const button = screen.getByRole("button")
      expect(button).toBeInTheDocument()
      expect(button).toHaveTextContent("关注")
      expect(button).toHaveAttribute("aria-pressed", "false")
    })

    it("渲染已关注状态", () => {
      hookReturn.isFollowing.mockReturnValue(true)
      render(<FollowButton {...defaultProps} initialFollowing />)

      const button = screen.getByRole("button")
      expect(button).toHaveTextContent("已关注")
      expect(button).toHaveAttribute("aria-pressed", "true")
    })

    it("支持仅图标模式", () => {
      render(<FollowButton {...defaultProps} iconOnly />)

      const button = screen.getByRole("button")
      expect(button).not.toHaveTextContent("关注")
      expect(button).toHaveAttribute("aria-label", "关注用户 user-123")
    })
  })

  describe("交互", () => {
    it("点击时调用 followUser", async () => {
      const user = userEvent.setup()
      const toggleSpy = vi.fn().mockResolvedValue({ success: true })
      mockUseFollowUser.mockReturnValue({
        ...hookReturn,
        toggleFollow: toggleSpy,
        isFollowing: vi.fn().mockReturnValue(false),
      })

      render(<FollowButton {...defaultProps} />)
      await user.click(screen.getByRole("button"))

      expect(toggleSpy).toHaveBeenCalledWith("user-123", false)
    })

    it("点击已关注时调用 unfollowUser", async () => {
      const user = userEvent.setup()
      const toggleSpy = vi.fn().mockResolvedValue({ success: true })
      mockUseFollowUser.mockReturnValue({
        ...hookReturn,
        toggleFollow: toggleSpy,
        isFollowing: vi.fn().mockReturnValue(true),
      })

      render(<FollowButton {...defaultProps} initialFollowing />)
      await user.click(screen.getByRole("button"))

      expect(toggleSpy).toHaveBeenCalledWith("user-123", true)
    })

    it("关注成功后触发回调并更新状态", async () => {
      const user = userEvent.setup()
      const toggleSpy = vi.fn().mockImplementation(async () => ({ success: true }))
      const onSuccess = vi.fn()

      mockUseFollowUser.mockReturnValue({
        ...hookReturn,
        toggleFollow: toggleSpy,
        isFollowing: vi.fn().mockReturnValue(false),
      })

      render(<FollowButton {...defaultProps} onFollowSuccess={onSuccess} />)
      await user.click(screen.getByRole("button"))

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith("user-123")
      })
    })
  })

  describe("加载与错误状态", () => {
    it("加载时显示旋转图标并禁用按钮", () => {
      mockUseFollowUser.mockReturnValue({
        ...hookReturn,
        isLoading: true,
      })

      render(<FollowButton {...defaultProps} />)

      const button = screen.getByRole("button")
      expect(button).toBeDisabled()
      expect(button).toHaveAttribute("aria-busy", "true")
      expect(button).toHaveTextContent("关注中...")
      expect(document.querySelector(".animate-spin")).toBeTruthy()
    })

    it("抛出错误时显示提示", () => {
      mockUseFollowUser.mockReturnValue({
        ...hookReturn,
        error: { code: "RATE_LIMIT_EXCEEDED", message: "过快", retryAfter: 60 },
      })

      render(<FollowButton {...defaultProps} />)
      expect(screen.getByText("操作过于频繁，请 60 秒后重试")).toBeInTheDocument()
    })
  })

  describe("错误回调", () => {
    it("follow 失败时触发 onError", async () => {
      const user = userEvent.setup()
      const toggleSpy = vi.fn().mockResolvedValue({
        success: false,
        error: { code: "UNKNOWN_ERROR", message: "失败" },
      })
      const onError = vi.fn()

      mockUseFollowUser.mockReturnValue({
        ...hookReturn,
        toggleFollow: toggleSpy,
        isFollowing: vi.fn().mockReturnValue(false),
      })

      render(<FollowButton {...defaultProps} onError={onError} />)
      await user.click(screen.getByRole("button"))

      expect(onError).toHaveBeenCalledWith({ code: "UNKNOWN_ERROR", message: "失败" })
    })
  })
})
