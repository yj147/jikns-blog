import { renderHook, act, waitFor } from "@testing-library/react"
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { mutate } from "swr"
import type { Key } from "swr"
import { toast } from "sonner"
import { useFollowUser } from "@/hooks/use-follow-user"
import {
  setToggleFollowInvoker,
  setToggleFollowLoader,
  type ToggleFollowResponse,
} from "@/lib/interactions/follow-client"

vi.mock("swr", () => ({
  mutate: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const mutateMock = vi.mocked(mutate)
const toastMock = vi.mocked(toast)
const toggleFollowInvokerMock =
  vi.fn<(userId: string, follow: boolean) => Promise<ToggleFollowResponse>>()

beforeEach(() => {
  vi.clearAllMocks()
  mutateMock.mockResolvedValue(undefined)
  toggleFollowInvokerMock.mockReset()
  setToggleFollowInvoker(toggleFollowInvokerMock)
  setToggleFollowLoader(async () => toggleFollowInvokerMock)
})

afterEach(() => {
  setToggleFollowInvoker(null)
  setToggleFollowLoader(null)
})

describe("useFollowUser", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("初始化默认状态", () => {
    const { result } = renderHook(() => useFollowUser())

    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.followingUsers.size).toBe(0)
  })

  it("根据 initialFollowing 初始化集合并去重", () => {
    const { result } = renderHook(() =>
      useFollowUser({ initialFollowing: ["user-1", "user-2", "user-1", "", "user-3"] })
    )

    expect(result.current.followingUsers.size).toBe(3)
    expect(result.current.isFollowing("user-2")).toBe(true)
  })

  it("成功关注用户并刷新缓存", async () => {
    toggleFollowInvokerMock.mockResolvedValueOnce({
      success: true,
      data: {
        followerId: "me",
        followingId: "user-1",
        createdAt: new Date().toISOString(),
        wasNew: true,
        targetName: "User One",
      },
      message: "已关注 User One",
    })

    const { result } = renderHook(() => useFollowUser())

    await act(async () => {
      await result.current.followUser("user-1")
    })

    expect(toggleFollowInvokerMock).toHaveBeenCalledWith("user-1", true)
    await waitFor(() => {
      expect(result.current.isFollowing("user-1")).toBe(true)
    })
    expect(toastMock.success).toHaveBeenCalledWith("已关注 User One")
    await waitFor(() => {
      expect(mutateMock).toHaveBeenCalled()
    })
  })

  it("成功取消关注用户", async () => {
    toggleFollowInvokerMock.mockResolvedValueOnce({
      success: true,
      data: {
        followerId: "me",
        followingId: "user-1",
        wasDeleted: true,
      },
      message: "已取消关注",
    })

    const { result } = renderHook(() => useFollowUser({ initialFollowing: ["user-1"] }))

    await act(async () => {
      await result.current.unfollowUser("user-1")
    })

    expect(toggleFollowInvokerMock).toHaveBeenCalledWith("user-1", false)
    await waitFor(() => {
      expect(result.current.isFollowing("user-1")).toBe(false)
    })
    expect(toastMock.success).toHaveBeenCalledWith("已取消关注")
  })

  it("错误时回滚乐观更新并记录错误", async () => {
    toggleFollowInvokerMock.mockResolvedValueOnce({
      success: false,
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "too fast",
        retryAfter: 30,
      },
    })

    const { result } = renderHook(() => useFollowUser())

    await act(async () => {
      await result.current.followUser("user-1")
    })

    expect(result.current.isFollowing("user-1")).toBe(false)
    expect(result.current.error).toMatchObject({
      code: "RATE_LIMIT_EXCEEDED",
      message: "too fast",
      retryAfter: 30,
    })
    expect(toastMock.error).toHaveBeenCalledWith("too fast")
  })

  it("非乐观模式下仅在成功后更新状态", async () => {
    toggleFollowInvokerMock.mockResolvedValueOnce({
      success: true,
      data: {
        followerId: "me",
        followingId: "user-9",
        createdAt: new Date().toISOString(),
        wasNew: true,
        targetName: null,
      },
    })

    const { result } = renderHook(() => useFollowUser({ optimistic: false }))

    expect(result.current.isFollowing("user-9")).toBe(false)

    const promise = result.current.followUser("user-9")

    expect(result.current.isFollowing("user-9")).toBe(false)

    await act(async () => {
      await promise
    })

    await waitFor(() => {
      expect(result.current.isFollowing("user-9")).toBe(true)
    })
  })

  it("toggleFollow 根据当前状态选择动作", async () => {
    toggleFollowInvokerMock
      .mockResolvedValueOnce({
        success: true,
        data: {
          followerId: "me",
          followingId: "user-7",
          createdAt: new Date().toISOString(),
          wasNew: true,
          targetName: null,
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          followerId: "me",
          followingId: "user-7",
          wasDeleted: true,
        },
      })

    const { result } = renderHook(() => useFollowUser())

    await act(async () => {
      await result.current.toggleFollow("user-7", false)
    })
    expect(toggleFollowInvokerMock).toHaveBeenNthCalledWith(1, "user-7", true)
    await waitFor(() => {
      expect(result.current.isFollowing("user-7")).toBe(true)
    })

    await act(async () => {
      await result.current.toggleFollow("user-7", true)
    })
    expect(toggleFollowInvokerMock).toHaveBeenNthCalledWith(2, "user-7", false)
    expect(result.current.isFollowing("user-7")).toBe(false)
  })

  it("clearError 清除错误状态", async () => {
    toggleFollowInvokerMock.mockResolvedValueOnce({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "请登录",
      },
    })

    const { result } = renderHook(() => useFollowUser())

    await act(async () => {
      await result.current.followUser("user-1")
    })

    await waitFor(() => {
      expect(result.current.error?.code).toBe("UNAUTHORIZED")
    })

    act(() => {
      result.current.clearError()
    })

    expect(result.current.error).toBeNull()
  })

  it("自定义 mutate 键会被刷新", async () => {
    toggleFollowInvokerMock.mockResolvedValueOnce({
      success: true,
      data: {
        followerId: "me",
        followingId: "user-5",
        createdAt: new Date().toISOString(),
        wasNew: false,
        targetName: "User Five",
      },
    })

    const followKey: Key = ["follow-status", "me"]
    const customKeys = ["/api/custom", followKey]

    const { result } = renderHook(() =>
      useFollowUser({
        mutateCacheKeys: customKeys,
      })
    )

    await act(async () => {
      await result.current.followUser("user-5")
    })

    await waitFor(() => {
      expect(mutateMock).toHaveBeenCalled()
    })
    const calledKeys = mutateMock.mock.calls.map(([key]) => key)

    expect(calledKeys).toContainEqual("/api/custom")

    const matchers = calledKeys.filter(
      (key): key is (key: Key) => boolean => typeof key === "function"
    )
    expect(matchers.some((matcher) => matcher(followKey))).toBe(true)
  })
})
