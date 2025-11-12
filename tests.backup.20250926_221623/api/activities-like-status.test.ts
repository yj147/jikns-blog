/**
 * 动态API点赞状态测试
 * 验证动态列表API正确注入用户点赞状态
 */

import { NextRequest } from "next/server"
import { GET } from "@/app/api/activities/route"
import { vi } from "vitest"

// Mock dependencies
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock("@/lib/repos/activity-repo", () => ({
  listActivities: vi.fn(),
}))

vi.mock("@/lib/interactions/likes", () => ({
  getBatchLikeStatus: vi.fn(),
}))

import { getCurrentUser } from "@/lib/auth"
import { listActivities } from "@/lib/repos/activity-repo"
import { getBatchLikeStatus } from "@/lib/interactions/likes"

describe("GET /api/activities - 点赞状态注入", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("应该为登录用户注入点赞状态", async () => {
    // Mock 当前用户
    vi.mocked(getCurrentUser).mockResolvedValueOnce({
      id: "user-123",
      email: "test@example.com",
      role: "USER",
    } as any)

    // Mock 活动列表
    const mockActivities = [
      {
        id: "act-1",
        content: "动态1",
        likesCount: 10,
        commentsCount: 5,
        author: { id: "author-1", name: "作者1" },
      },
      {
        id: "act-2",
        content: "动态2",
        likesCount: 20,
        commentsCount: 3,
        author: { id: "author-2", name: "作者2" },
      },
    ]

    vi.mocked(listActivities).mockResolvedValueOnce({
      items: mockActivities,
      hasMore: false,
      nextCursor: null,
    })

    // Mock 点赞状态
    const likeStatusMap = new Map([
      ["act-1", { isLiked: true, count: 11 }], // 用户点赞了第一个
      ["act-2", { isLiked: false, count: 20 }], // 没点赞第二个
    ])

    vi.mocked(getBatchLikeStatus).mockResolvedValueOnce(likeStatusMap)

    // 创建请求
    const request = new NextRequest("http://localhost:3000/api/activities")

    // 调用API
    const response = await GET(request)
    const data = await response.json()

    // 验证调用
    expect(getCurrentUser).toHaveBeenCalled()
    expect(listActivities).toHaveBeenCalled()
    expect(getBatchLikeStatus).toHaveBeenCalledWith("activity", ["act-1", "act-2"], "user-123")

    // 验证响应数据
    expect(data.success).toBe(true)
    expect(data.data).toHaveLength(2)

    // 验证点赞状态被正确注入
    expect(data.data[0]).toMatchObject({
      id: "act-1",
      content: "动态1",
      likesCount: 11, // 更新后的计数
      isLiked: true, // 注入的点赞状态
    })

    expect(data.data[1]).toMatchObject({
      id: "act-2",
      content: "动态2",
      likesCount: 20,
      isLiked: false,
    })
  })

  it("未登录用户不应查询点赞状态", async () => {
    // Mock 无用户
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null)

    // Mock 活动列表
    const mockActivities = [
      {
        id: "act-1",
        content: "动态1",
        likesCount: 10,
        author: { id: "author-1", name: "作者1" },
      },
    ]

    vi.mocked(listActivities).mockResolvedValueOnce({
      items: mockActivities,
      hasMore: false,
      nextCursor: null,
    })

    // 创建请求
    const request = new NextRequest("http://localhost:3000/api/activities")

    // 调用API
    const response = await GET(request)
    const data = await response.json()

    // 验证不调用点赞状态查询
    expect(getCurrentUser).toHaveBeenCalled()
    expect(listActivities).toHaveBeenCalled()
    expect(getBatchLikeStatus).not.toHaveBeenCalled()

    // 验证响应数据（没有isLiked字段）
    expect(data.success).toBe(true)
    expect(data.data).toHaveLength(1)
    expect(data.data[0]).toMatchObject({
      id: "act-1",
      content: "动态1",
      likesCount: 10,
    })
    expect(data.data[0].isLiked).toBeUndefined()
  })

  it("空列表不应查询点赞状态", async () => {
    // Mock 用户
    vi.mocked(getCurrentUser).mockResolvedValueOnce({
      id: "user-123",
      email: "test@example.com",
      role: "USER",
    } as any)

    // Mock 空列表
    vi.mocked(listActivities).mockResolvedValueOnce({
      items: [],
      hasMore: false,
      nextCursor: null,
    })

    // 创建请求
    const request = new NextRequest("http://localhost:3000/api/activities")

    // 调用API
    const response = await GET(request)
    const data = await response.json()

    // 验证不调用点赞状态查询
    expect(getBatchLikeStatus).not.toHaveBeenCalled()

    // 验证响应
    expect(data.success).toBe(true)
    expect(data.data).toHaveLength(0)
  })

  it("应该正确处理游标分页参数", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null)

    vi.mocked(listActivities).mockResolvedValueOnce({
      items: [],
      hasMore: true,
      nextCursor: "cursor-abc",
    })

    // 创建带游标的请求
    const request = new NextRequest(
      "http://localhost:3000/api/activities?cursor=prev-cursor&limit=5"
    )

    // 调用API
    const response = await GET(request)
    const data = await response.json()

    // 验证listActivities被正确调用
    expect(listActivities).toHaveBeenCalledWith({
      page: 1,
      limit: 5,
      orderBy: "latest",
      authorId: undefined,
      cursor: "prev-cursor",
    })

    // 验证响应包含游标信息
    expect(data.meta).toMatchObject({
      hasMore: true,
      nextCursor: "cursor-abc",
    })
  })
})
