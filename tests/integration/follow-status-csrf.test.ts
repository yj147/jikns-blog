/**
 * 集成测试：验证批量关注状态查询的 CSRF Token 传递
 *
 * Linus 原则：测试真实的生产场景
 * 验证 useFollowStatusBatch 使用 fetchPost 后，CSRF Token 正确传递
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { useFollowStatusBatch } from "@/hooks/use-follow-list"
import { fetchPost } from "@/lib/api/fetch-json"

// Mock fetchPost
vi.mock("@/lib/api/fetch-json", () => ({
  fetchPost: vi.fn(),
}))

describe("批量关注状态查询 - CSRF Token 验证", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // 模拟 sessionStorage 中的 CSRF Token
    Object.defineProperty(window, "sessionStorage", {
      value: {
        getItem: vi.fn((key: string) => {
          if (key === "csrf-token") return "test-csrf-token-12345"
          return null
        }),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("应该使用 fetchPost 发送请求（自动注入 CSRF Token）", async () => {
    const mockResponse = {
      success: true,
      data: {
        "user-1": { isFollowing: true, isMutual: false },
        "user-2": { isFollowing: false, isMutual: false },
      },
    }

    vi.mocked(fetchPost).mockResolvedValue(mockResponse)

    const { result } = renderHook(() =>
      useFollowStatusBatch(["user-1", "user-2"], "current-user-id")
    )

    // 等待 SWR 完成请求
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // 验证 fetchPost 被调用
    expect(fetchPost).toHaveBeenCalledTimes(1)
    expect(fetchPost).toHaveBeenCalledWith("/api/users/follow/status", {
      targetIds: ["user-1", "user-2"],
    })

    // 验证返回的状态映射
    expect(result.current.statusMap.size).toBe(2)
    expect(result.current.isFollowing("user-1")).toBe(true)
    expect(result.current.isFollowing("user-2")).toBe(false)
  })

  it("应该正确处理空目标 ID 列表", async () => {
    const { result } = renderHook(() => useFollowStatusBatch([], "current-user-id"))

    // 空列表不应该发送请求
    expect(fetchPost).not.toHaveBeenCalled()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.statusMap.size).toBe(0)
  })

  it("应该正确处理未登录用户（无 actorId）", async () => {
    const { result } = renderHook(() => useFollowStatusBatch(["user-1", "user-2"], undefined))

    // 未登录不应该发送请求
    expect(fetchPost).not.toHaveBeenCalled()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.statusMap.size).toBe(0)
  })

  it("应该去重目标 ID 列表", async () => {
    const mockResponse = {
      success: true,
      data: {
        "user-1": { isFollowing: true, isMutual: false },
      },
    }

    vi.mocked(fetchPost).mockResolvedValue(mockResponse)

    const { result } = renderHook(() =>
      useFollowStatusBatch(["user-1", "user-1", "user-1"], "current-user-id")
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // 验证去重后只传递一个 ID
    expect(fetchPost).toHaveBeenCalledWith("/api/users/follow/status", {
      targetIds: ["user-1"],
    })
  })

  it("应该提供便捷方法查询关注状态", async () => {
    const mockResponse = {
      success: true,
      data: {
        "user-1": { isFollowing: true, isMutual: true },
        "user-2": { isFollowing: false, isMutual: false },
        "user-3": { isFollowing: true, isMutual: false },
      },
    }

    vi.mocked(fetchPost).mockResolvedValue(mockResponse)

    const { result } = renderHook(() =>
      useFollowStatusBatch(["user-1", "user-2", "user-3"], "current-user-id")
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // 验证便捷方法
    expect(result.current.isFollowing("user-1")).toBe(true)
    expect(result.current.isFollowing("user-2")).toBe(false)
    expect(result.current.isFollowing("user-3")).toBe(true)
    expect(result.current.isFollowing("user-999")).toBe(false) // 不存在的用户

    expect(result.current.isMutual("user-1")).toBe(true)
    expect(result.current.isMutual("user-2")).toBe(false)
    expect(result.current.isMutual("user-3")).toBe(false)
    expect(result.current.isMutual("user-999")).toBe(false) // 不存在的用户
  })
})
