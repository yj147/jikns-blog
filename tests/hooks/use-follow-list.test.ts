/**
 * 关注列表 Hook 测试
 * 测试 useFollowers、useFollowing 和 useFollowStatusBatch 功能
 */

import { renderHook, waitFor } from "@testing-library/react"
import { describe, it, expect, beforeEach, vi } from "vitest"
import useSWR from "swr"
import useSWRInfinite from "swr/infinite"
import { useFollowers, useFollowing, useFollowStatusBatch } from "@/hooks/use-follow-list"
import { logger } from "@/lib/utils/logger"

// Mock dependencies
vi.mock("swr/infinite")
vi.mock("swr", () => ({
  __esModule: true,
  default: vi.fn(),
}))
vi.mock("@/lib/utils/logger", () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}))

const mockedUseSWR = vi.mocked(useSWR)
const mockedUseSWRInfinite = vi.mocked(useSWRInfinite)
const mockedLogger = vi.mocked(logger)

const mockFetch = vi.fn()
globalThis.fetch = mockFetch as unknown as typeof fetch

describe("useFollowers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockFollowersData = [
    {
      data: [
        {
          id: "user-1",
          name: "用户1",
          email: "user1@example.com",
          avatarUrl: "avatar1.jpg",
          bio: "用户1的简介",
          status: "ACTIVE" as const,
          isMutual: true,
          followedAt: "2025-09-28T10:00:00Z",
        },
        {
          id: "user-2",
          name: "用户2",
          email: "user2@example.com",
          avatarUrl: "avatar2.jpg",
          bio: "用户2的简介",
          status: "ACTIVE" as const,
          isMutual: false,
          followedAt: "2025-09-28T11:00:00Z",
        },
      ],
      meta: {
        pagination: {
          page: 1,
          limit: 20,
          total: 25,
          hasMore: true,
          nextCursor: "cursor-1",
        },
      },
    },
    {
      data: [
        {
          id: "user-3",
          name: "用户3",
          email: "user3@example.com",
          avatarUrl: "avatar3.jpg",
          bio: "用户3的简介",
          status: "ACTIVE" as const,
          isMutual: false,
          followedAt: "2025-09-28T12:00:00Z",
        },
      ],
      meta: {
        pagination: {
          page: 2,
          limit: 20,
          total: 25,
          hasMore: false,
        },
      },
    },
  ]

  it("应该正确获取粉丝列表", () => {
    mockedUseSWRInfinite.mockReturnValue({
      data: mockFollowersData,
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
      size: 2,
      setSize: vi.fn(),
    })

    const { result } = renderHook(() => useFollowers("user-123"))

    expect(result.current.items).toHaveLength(3)
    expect(result.current.items[0].id).toBe("user-1")
    expect(result.current.items[1].id).toBe("user-2")
    expect(result.current.items[2].id).toBe("user-3")
    expect(result.current.hasMore).toBe(false)
    expect(result.current.pagination.total).toBe(25)
  })

  it("应该处理空数据", () => {
    mockedUseSWRInfinite.mockReturnValue({
      data: null,
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
      size: 0,
      setSize: vi.fn(),
    })

    const { result } = renderHook(() => useFollowers("user-123"))

    expect(result.current.items).toHaveLength(0)
    expect(result.current.hasMore).toBe(false)
    expect(result.current.pagination.total).toBeNull()
  })

  it("应该处理加载状态", () => {
    mockedUseSWRInfinite.mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
      isValidating: false,
      mutate: vi.fn(),
      size: 1,
      setSize: vi.fn(),
    })

    const { result } = renderHook(() => useFollowers("user-123"))

    expect(result.current.isLoading).toBe(true)
    expect(result.current.isLoadingMore).toBe(false)
  })

  it("应该处理加载更多状态", () => {
    mockedUseSWRInfinite.mockReturnValue({
      data: [mockFollowersData[0]],
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
      size: 2,
      setSize: vi.fn(),
    })

    const { result } = renderHook(() => useFollowers("user-123"))

    expect(result.current.isLoading).toBe(false)
    expect(result.current.isLoadingMore).toBe(true)
  })

  it("应该处理错误状态", () => {
    const mockError = new Error("获取粉丝列表失败")

    mockedUseSWRInfinite.mockReturnValue({
      data: undefined,
      error: mockError,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
      size: 1,
      setSize: vi.fn(),
    })

    const { result } = renderHook(() => useFollowers("user-123"))

    const options = mockedUseSWRInfinite.mock.calls.at(-1)?.[2]
    options?.onError?.(mockError)

    expect(result.current.isError).toBe(true)
    expect(result.current.error).toBe(mockError)
    expect(mockedLogger.error).toHaveBeenCalledWith("获取粉丝列表失败:", mockError)
  })

  it("应该支持加载更多功能", () => {
    const mockSetSize = vi.fn()

    mockedUseSWRInfinite.mockReturnValue({
      data: [mockFollowersData[0]],
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
      size: 1,
      setSize: mockSetSize,
    })

    const { result } = renderHook(() => useFollowers("user-123"))

    // 有更多数据且未在加载更多时，应该能够加载更多
    expect(result.current.hasMore).toBe(true)
    expect(result.current.isLoadingMore).toBe(false)

    result.current.loadMore()

    expect(mockSetSize).toHaveBeenCalledWith(expect.any(Function))
  })

  it("应该在没有更多数据时禁用加载更多", () => {
    const mockSetSize = vi.fn()

    mockedUseSWRInfinite.mockReturnValue({
      data: [mockFollowersData[1]], // 第二页数据，hasMore: false
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
      size: 1,
      setSize: mockSetSize,
    })

    const { result } = renderHook(() => useFollowers("user-123"))

    expect(result.current.hasMore).toBe(false)

    result.current.loadMore()

    expect(mockSetSize).not.toHaveBeenCalled()
  })

  it("应该支持自定义选项", () => {
    const customOptions = {
      limit: 10,
      autoLoad: false,
      revalidateOnFocus: true,
    }

    renderHook(() => useFollowers("user-123", customOptions))

    expect(mockedUseSWRInfinite).toHaveBeenCalledWith(
      expect.any(Function), // 由于 autoLoad: false，keyGetter 会返回 null
      expect.any(Function),
      expect.objectContaining({
        revalidateOnFocus: true,
        revalidateOnReconnect: false,
        errorRetryCount: 2,
      })
    )
  })
})

describe("useFollowing", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedUseSWRInfinite.mockReset()
    mockedLogger.error.mockReset()
  })

  it("应该与 useFollowers 具有相同的基础功能", () => {
    const mockFollowingData = [
      {
        data: [
          {
            id: "user-4",
            name: "关注的用户1",
            email: "follow1@example.com",
            avatarUrl: "avatar4.jpg",
            bio: "关注的用户1的简介",
            status: "ACTIVE" as const,
            isMutual: true,
            followedAt: "2025-09-28T13:00:00Z",
          },
        ],
        meta: {
          pagination: {
            page: 1,
            limit: 20,
            total: 1,
            hasMore: false,
          },
        },
      },
    ]

    mockedUseSWRInfinite.mockReturnValue({
      data: mockFollowingData,
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
      size: 1,
      setSize: vi.fn(),
    })

    const { result } = renderHook(() => useFollowing("user-123"))

    expect(result.current.items).toHaveLength(1)
    expect(result.current.items[0].id).toBe("user-4")
    expect(result.current.hasMore).toBe(false)
  })
})

describe("useFollowStatusBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockClear()
    mockedUseSWR.mockReset()
    mockedLogger.error.mockReset()
    mockedUseSWR.mockReturnValue({
      data: [],
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    })
  })

  it("应该正确批量查询关注状态（键值对格式）", () => {
    const mockMutate = vi.fn()

    // Linus 原则：API 响应格式统一
    // 现在返回键值对结构：{ [userId]: { isFollowing, isMutual } }
    mockedUseSWR.mockReturnValue({
      data: {
        "user-1": { isFollowing: true, isMutual: false },
        "user-2": { isFollowing: false, isMutual: true },
        "user-3": { isFollowing: true, isMutual: false },
      },
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    })

    const targetIds = ["user-1", "user-2", "user-3"]
    const { result } = renderHook(() => useFollowStatusBatch(targetIds, "current-user"))

    expect(result.current.statusMap.size).toBe(3)
    expect(result.current.isFollowing("user-1")).toBe(true)
    expect(result.current.isFollowing("user-2")).toBe(false)
    expect(result.current.isMutual("user-2")).toBe(true)
    expect(result.current.refresh).toBe(mockMutate)
  })

  it("应该在没有目标用户时跳过请求", () => {
    const { result } = renderHook(() => useFollowStatusBatch([], "current-user"))

    expect(mockedUseSWR).toHaveBeenCalledWith(null, expect.any(Function), expect.any(Object))
    expect(result.current.statusMap.size).toBe(0)
  })

  it("应该在没有 actorId 时跳过请求", () => {
    const targetIds = ["user-1", "user-2"]
    const { result } = renderHook(() => useFollowStatusBatch(targetIds))

    expect(mockedUseSWR).toHaveBeenCalledWith(null, expect.any(Function), expect.any(Object))
    expect(result.current.statusMap.size).toBe(0)
  })

  it("应该处理查询错误", () => {
    const mockError = new Error("批量查询失败")

    mockedUseSWR.mockReturnValue({
      data: undefined,
      error: mockError,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    })

    const targetIds = ["user-1", "user-2"]
    const { result } = renderHook(() => useFollowStatusBatch(targetIds, "current-user"))

    expect(result.current.isError).toBe(true)
    expect(result.current.error).toBe(mockError)
    expect(result.current.statusMap.size).toBe(0)
  })

  it("应该为不存在的用户返回默认状态", () => {
    mockedUseSWR.mockReturnValue({
      data: {
        "user-1": { isFollowing: true, isMutual: false },
      },
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    })

    const targetIds = ["user-1", "user-2"]
    const { result } = renderHook(() => useFollowStatusBatch(targetIds, "current-user"))

    expect(result.current.isFollowing("user-1")).toBe(true)
    expect(result.current.isFollowing("user-2")).toBe(false) // 默认值
    expect(result.current.isMutual("user-nonexistent")).toBe(false) // 默认值
  })
})

describe("Key generation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedUseSWRInfinite.mockReset()
  })

  it("应该为粉丝列表生成正确的 API URL", () => {
    mockedUseSWRInfinite.mockReturnValue({
      data: null,
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
      size: 1,
      setSize: vi.fn(),
    })

    renderHook(() => useFollowers("user-123", { limit: 10 }))

    const keyGenerator = mockedUseSWRInfinite.mock.calls[0][0]

    // 第一页（默认不请求总数，但会明确传 includeTotal=false）
    expect(keyGenerator(0, null)).toBe("/api/users/user-123/followers?limit=10&includeTotal=false")

    // 第二页（有 cursor，后续请求也传 includeTotal=false）
    const mockPreviousData = {
      meta: {
        pagination: {
          hasMore: true,
          nextCursor: "cursor-123",
        },
      },
    }
    expect(keyGenerator(1, mockPreviousData)).toBe(
      "/api/users/user-123/followers?limit=10&cursor=cursor-123&includeTotal=false"
    )

    // 没有更多数据时
    const mockNoMoreData = {
      meta: {
        pagination: {
          hasMore: false,
        },
      },
    }
    expect(keyGenerator(1, mockNoMoreData)).toBeNull()
  })

  it("应该为关注列表生成正确的 API URL", () => {
    mockedUseSWRInfinite.mockReturnValue({
      data: null,
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
      size: 1,
      setSize: vi.fn(),
    })

    renderHook(() => useFollowing("user-456", { limit: 20 }))

    const keyGenerator = mockedUseSWRInfinite.mock.calls[0][0]

    expect(keyGenerator(0, null)).toBe("/api/users/user-456/following?limit=20&includeTotal=false")
  })

  it("应该在 includeTotal=true 时仅在首次请求传递参数", () => {
    mockedUseSWRInfinite.mockReturnValue({
      data: null,
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
      size: 1,
      setSize: vi.fn(),
    })

    renderHook(() => useFollowers("user-123", { limit: 10, includeTotal: true }))

    const keyGenerator = mockedUseSWRInfinite.mock.calls[0][0]

    // 第一页应该包含 includeTotal=true
    expect(keyGenerator(0, null)).toBe("/api/users/user-123/followers?limit=10&includeTotal=true")

    // 第二页应该传 includeTotal=false（性能优化，避免重复 COUNT(*)）
    const mockPreviousData = {
      meta: {
        pagination: {
          hasMore: true,
          nextCursor: "cursor-123",
        },
      },
    }
    expect(keyGenerator(1, mockPreviousData)).toBe(
      "/api/users/user-123/followers?limit=10&cursor=cursor-123&includeTotal=false"
    )
  })

  it("应该在 includeTotal=false 时传递 includeTotal=false（默认行为）", () => {
    mockedUseSWRInfinite.mockReturnValue({
      data: null,
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
      size: 1,
      setSize: vi.fn(),
    })

    renderHook(() => useFollowers("user-123", { limit: 10, includeTotal: false }))

    const keyGenerator = mockedUseSWRInfinite.mock.calls[0][0]

    // 第一页应该明确传 includeTotal=false
    expect(keyGenerator(0, null)).toBe("/api/users/user-123/followers?limit=10&includeTotal=false")
  })
})
