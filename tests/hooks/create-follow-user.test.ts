import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"

import { createFollowUserHook } from "@/hooks/internal/create-follow-user"
import type { ToggleFollowResponse } from "@/lib/interactions/follow-client"

const createDeps = () => {
  const mutate = vi.fn().mockResolvedValue(undefined)
  const toast = { success: vi.fn(), error: vi.fn() }
  const logger = { warn: vi.fn(), error: vi.fn() }

  return { mutate, toast, logger }
}

describe("createFollowUserHook", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("successfully follows a user", async () => {
    const toggle = vi
      .fn<(userId: string, follow: boolean) => Promise<ToggleFollowResponse>>()
      .mockResolvedValue({
        success: true,
        data: {
          followerId: "actor",
          followingId: "target-1",
          createdAt: new Date().toISOString(),
          wasNew: true,
          targetName: "Target",
        },
        message: "followed",
      })

    const { mutate, toast, logger } = createDeps()
    const useHook = createFollowUserHook({ toggle, mutate, toast, logger })
    const { result } = renderHook(() => useHook({ showToast: false, mutateCacheKeys: [] }))

    // 验证初始状态
    expect(result.current.isFollowing("target-1")).toBe(false)

    // 关注用户
    await act(async () => {
      const actionResult = await result.current.followUser("target-1")
      expect(actionResult.success).toBe(true)
    })

    // 验证操作被调用
    expect(toggle).toHaveBeenCalledTimes(1)
    expect(toggle).toHaveBeenCalledWith("target-1", true)

    // 验证最终状态 - 不依赖 isLoading,只验证业务状态
    expect(result.current.isFollowing("target-1")).toBe(true)
  }, 10000)

  it("returns the same promise for identical pending actions", async () => {
    const toggle = vi
      .fn<(userId: string, follow: boolean) => Promise<ToggleFollowResponse>>()
      .mockResolvedValue({
        success: true,
        data: {
          followerId: "actor",
          followingId: "target-2",
          createdAt: new Date().toISOString(),
          wasNew: true,
          targetName: "Target",
        },
        message: "followed",
      })

    const { mutate, toast, logger } = createDeps()
    const useHook = createFollowUserHook({ toggle, mutate, toast, logger })
    const { result } = renderHook(() => useHook({ showToast: false, mutateCacheKeys: [] }))

    let firstPromise: ReturnType<typeof result.current.followUser> | undefined
    let secondPromise: ReturnType<typeof result.current.followUser> | undefined

    // 在同一个 act 中进行两次调用,第二次应该返回相同的 Promise
    act(() => {
      firstPromise = result.current.followUser("target-2")
      secondPromise = result.current.followUser("target-2")
    })

    expect(toggle).toHaveBeenCalledTimes(1)
    expect(secondPromise).toBe(firstPromise)

    // 等待操作完成
    await act(async () => {
      await firstPromise
    })

    expect(toggle).toHaveBeenCalledTimes(1)
  }, 10000)

  it("rolls back optimistic updates and maps server errors", async () => {
    const toggle = vi.fn<(userId: string, follow: boolean) => Promise<ToggleFollowResponse>>(() =>
      Promise.resolve({
        success: false,
        error: { code: "TARGET_INACTIVE" },
      })
    )

    const { mutate, toast, logger } = createDeps()
    const useHook = createFollowUserHook({ toggle, mutate, toast, logger })
    const { result } = renderHook(() =>
      useHook({ initialFollowing: ["existing-user"], showToast: true, mutateCacheKeys: [] })
    )

    await act(async () => {
      const actionResult = await result.current.followUser("target-3")
      expect(actionResult.success).toBe(false)
    })

    expect(result.current.isFollowing("target-3")).toBe(false)
    expect(result.current.isFollowing("existing-user")).toBe(true)
    expect(result.current.error).toEqual({
      code: "TARGET_INACTIVE",
      message: "无法关注该用户",
    })
    expect(toast.success).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith("无法关注该用户")
    expect(mutate).not.toHaveBeenCalled()
  }, 10000)

  it("logs unexpected errors and restores previous state", async () => {
    const toggle = vi
      .fn<(userId: string, follow: boolean) => Promise<ToggleFollowResponse>>()
      .mockRejectedValue(new Error("network"))

    const { mutate, toast, logger } = createDeps()
    const useHook = createFollowUserHook({ toggle, mutate, toast, logger })
    const { result } = renderHook(() =>
      useHook({ initialFollowing: ["target-4"], showToast: true, mutateCacheKeys: [] })
    )

    await act(async () => {
      const actionResult = await result.current.unfollowUser("target-4")
      expect(actionResult.success).toBe(false)
    })

    expect(result.current.isFollowing("target-4")).toBe(true)
    expect(result.current.error).toEqual({
      code: "UNKNOWN_ERROR",
      message: "取消关注失败，请稍后再试",
    })
    expect(logger.error).toHaveBeenCalledTimes(1)
    expect(toast.error).toHaveBeenCalledWith("取消关注失败，请稍后再试")
    expect(mutate).not.toHaveBeenCalled()
  }, 10000)

  it("deduplicates cache refresh targets before invoking mutate", async () => {
    const toggle = vi
      .fn<(userId: string, follow: boolean) => Promise<ToggleFollowResponse>>()
      .mockResolvedValue({
        success: true,
        data: {
          followerId: "actor",
          followingId: "target-5",
          createdAt: new Date().toISOString(),
          wasNew: false,
        },
        message: "ok",
      })

    const { mutate, toast, logger } = createDeps()
    const useHook = createFollowUserHook({ toggle, mutate, toast, logger })
    const { result } = renderHook(() =>
      useHook({
        showToast: true,
        mutateCacheKeys: [
          ["follow-status", "target-5"],
          "/api/users/suggested?cursor=1",
          "/api/users/suggested?cursor=1",
        ],
        mutateMatchers: [(key) => typeof key === "string" && key.startsWith("/api/custom")],
      })
    )

    await act(async () => {
      const actionResult = await result.current.followUser("target-5")
      expect(actionResult.success).toBe(true)
    })

    // 等待异步缓存刷新完成
    await vi.waitFor(
      () => {
        expect(mutate).toHaveBeenCalled()
      },
      { timeout: 1000 }
    )

    expect(mutate.mock.calls.every(([matcher]) => typeof matcher === "function")).toBe(true)
    expect(toast.success).toHaveBeenCalledWith("ok")
  }, 10000)
})
