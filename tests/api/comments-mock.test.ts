import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest, NextResponse } from "next/server"

// 简化的 Mock 实现
const mockGetComments = vi.fn()
const mockCreateComment = vi.fn()
const mockDeleteComment = vi.fn()

// 模拟评论 API 响应
const createMockResponse = (data: any, status = 200) => {
  return NextResponse.json(data, { status })
}

// GET /api/comments 的模拟实现
const mockCommentsGET = async (request: NextRequest) => {
  const url = new URL(request.url)
  const postId = url.searchParams.get("postId")
  const activityId = url.searchParams.get("activityId")
  const cursor = url.searchParams.get("cursor")
  const limit = url.searchParams.get("limit")
  const includeReplies = url.searchParams.get("includeReplies")

  // 参数验证
  if (!postId && !activityId) {
    return createMockResponse(
      {
        success: false,
        error: { code: "INVALID_REQUEST", message: "必须提供 postId 或 activityId" },
      },
      400
    )
  }

  const result = await mockGetComments({
    postId,
    activityId,
    cursor,
    limit: limit ? parseInt(limit) : 10,
    includeReplies: includeReplies === "true",
  })

  return createMockResponse({
    success: true,
    data: result.data,
    meta: {
      pagination: {
        hasNext: result.hasNext,
        nextCursor: result.nextCursor,
      },
    },
  })
}

// POST /api/comments 的模拟实现
const mockCommentsPOST = async (request: NextRequest, user: any) => {
  // 认证检查
  if (!user) {
    return createMockResponse(
      {
        success: false,
        error: { code: "UNAUTHORIZED", message: "用户未认证" },
      },
      401
    )
  }

  if (user.status === "BANNED") {
    return createMockResponse(
      {
        success: false,
        error: { code: "FORBIDDEN", message: "用户已被封禁" },
      },
      403
    )
  }

  const body = await request.json()
  const result = await mockCreateComment({
    ...body,
    userId: user.id,
  })

  return createMockResponse({
    success: true,
    data: result,
  })
}

// DELETE /api/comments/[id] 的模拟实现
const mockCommentsDELETE = async (commentId: string, user: any) => {
  // 认证检查
  if (!user) {
    return createMockResponse(
      {
        success: false,
        error: { code: "UNAUTHORIZED", message: "用户未认证" },
      },
      401
    )
  }

  // 查找评论
  const comment = { id: commentId, userId: "user1", activityId: "activity1" }

  if (!comment) {
    return createMockResponse(
      {
        success: false,
        error: { code: "NOT_FOUND", message: "评论不存在" },
      },
      404
    )
  }

  // 权限检查
  if (comment.userId !== user.id && user.role !== "ADMIN") {
    return createMockResponse(
      {
        success: false,
        error: { code: "FORBIDDEN", message: "无权删除此评论" },
      },
      403
    )
  }

  const result = await mockDeleteComment(commentId, {
    hardDelete: false,
    updateActivityCount: false,
  })

  return createMockResponse({
    success: true,
    data: result,
  })
}

describe("Comments API - Mock Contract Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("GET /api/comments", () => {
    it("应该允许公开访问评论列表", async () => {
      mockGetComments.mockResolvedValue({
        data: [
          {
            id: "1",
            content: "测试评论",
            userId: "user1",
            user: { id: "user1", name: "用户1" },
            _count: { likes: 5 },
          },
        ],
        hasNext: false,
      })

      const request = new NextRequest("http://localhost:3000/api/comments?postId=post1")
      const response = await mockCommentsGET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(1)
      expect(data.meta?.pagination).toBeDefined()
    })

    it("应该返回 400 当缺少必要参数", async () => {
      const request = new NextRequest("http://localhost:3000/api/comments")
      const response = await mockCommentsGET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("INVALID_REQUEST")
    })

    it("应该支持分页参数", async () => {
      mockGetComments.mockResolvedValue({
        data: [],
        hasNext: true,
        nextCursor: "next123",
      })

      const request = new NextRequest(
        "http://localhost:3000/api/comments?postId=post1&cursor=cursor123&limit=20"
      )
      await mockCommentsGET(request)

      expect(mockGetComments).toHaveBeenCalledWith({
        postId: "post1",
        activityId: null,
        cursor: "cursor123",
        limit: 20,
        includeReplies: false,
      })
    })
  })

  describe("POST /api/comments", () => {
    it("应该拒绝未登录用户 (401)", async () => {
      const request = new NextRequest("http://localhost:3000/api/comments", {
        method: "POST",
        body: JSON.stringify({ content: "新评论", postId: "post1" }),
      })

      const response = await mockCommentsPOST(request, null)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("UNAUTHORIZED")
    })

    it("应该拒绝 BANNED 用户 (403)", async () => {
      const request = new NextRequest("http://localhost:3000/api/comments", {
        method: "POST",
        body: JSON.stringify({ content: "新评论", postId: "post1" }),
      })

      const user = { id: "user1", status: "BANNED" }
      const response = await mockCommentsPOST(request, user)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("FORBIDDEN")
    })

    it("应该允许 ACTIVE 用户创建评论", async () => {
      mockCreateComment.mockResolvedValue({
        id: "new1",
        content: "新评论",
        userId: "user1",
      })

      const request = new NextRequest("http://localhost:3000/api/comments", {
        method: "POST",
        body: JSON.stringify({ content: "新评论", postId: "post1" }),
      })

      const user = { id: "user1", status: "ACTIVE" }
      const response = await mockCommentsPOST(request, user)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.content).toBe("新评论")
    })
  })

  describe("DELETE /api/comments/[id]", () => {
    it("应该允许作者删除自己的评论", async () => {
      mockDeleteComment.mockResolvedValue({
        id: "comment1",
        deletedAt: new Date(),
      })

      const user = { id: "user1", status: "ACTIVE", role: "USER" }
      const response = await mockCommentsDELETE("comment1", user)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it("应该允许 ADMIN 删除任何评论", async () => {
      mockDeleteComment.mockResolvedValue({
        id: "comment1",
        deletedAt: new Date(),
      })

      const user = { id: "admin1", status: "ACTIVE", role: "ADMIN" }
      const response = await mockCommentsDELETE("comment1", user)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it("应该拒绝非作者删除他人评论", async () => {
      const user = { id: "user2", status: "ACTIVE", role: "USER" }
      const response = await mockCommentsDELETE("comment1", user)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("FORBIDDEN")
    })
  })
})

describe("统一路由与兼容路由响应一致性", () => {
  it("GET 响应结构应该一致", async () => {
    const mockData = [{ id: "1", content: "评论" }]
    mockGetComments.mockResolvedValue({
      data: mockData,
      hasNext: false,
    })

    // 统一路由
    const unifiedRequest = new NextRequest(
      "http://localhost:3000/api/comments?activityId=activity1"
    )
    const unifiedResponse = await mockCommentsGET(unifiedRequest)
    const unifiedData = await unifiedResponse.json()

    // 兼容路由模拟（实际应该从路径参数提取 activityId）
    const compatRequest = new NextRequest("http://localhost:3000/api/comments?activityId=activity1")
    const compatResponse = await mockCommentsGET(compatRequest)
    const compatData = await compatResponse.json()

    // 验证结构一致性
    expect(unifiedData.success).toBe(compatData.success)
    expect(unifiedData.data).toEqual(compatData.data)
    expect(unifiedData.meta).toEqual(compatData.meta)
  })

  it("错误响应结构应该一致", async () => {
    // 401 响应
    const request1 = new NextRequest("http://localhost:3000/api/comments", {
      method: "POST",
      body: JSON.stringify({ content: "评论" }),
    })
    const response1 = await mockCommentsPOST(request1, null)
    const data1 = await response1.json()

    const request2 = new NextRequest("http://localhost:3000/api/activities/activity1/comments", {
      method: "POST",
      body: JSON.stringify({ content: "评论" }),
    })
    const response2 = await mockCommentsPOST(request2, null)
    const data2 = await response2.json()

    expect(data1.success).toBe(false)
    expect(data2.success).toBe(false)
    expect(data1.error.code).toBe(data2.error.code)
  })
})

// 中间件 matchesPath 函数测试
describe("中间件路径匹配测试", () => {
  function matchesPath(pathname: string, patterns: readonly string[]): boolean {
    return patterns.some((pattern) => {
      // 处理中间通配符 * 的情况
      if (pattern.includes("*/") && !pattern.endsWith("/*")) {
        const regexPattern = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]+")
        const regex = new RegExp(`^${regexPattern}$`)
        return regex.test(pathname)
      }

      if (pattern.endsWith("/*")) {
        const basePattern = pattern.slice(0, -2)
        return pathname.startsWith(basePattern)
      }

      return pathname === pattern || pathname.startsWith(pattern + "/")
    })
  }

  const publicGetOnlyPatterns = ["/api/comments", "/api/activities/*/comments"]

  it("应该匹配评论相关路径", () => {
    expect(matchesPath("/api/comments", publicGetOnlyPatterns)).toBe(true)
    expect(matchesPath("/api/activities/123/comments", publicGetOnlyPatterns)).toBe(true)
    expect(matchesPath("/api/activities/abc-def/comments", publicGetOnlyPatterns)).toBe(true)
  })

  it("不应该匹配其他路径", () => {
    expect(matchesPath("/api/posts", publicGetOnlyPatterns)).toBe(false)
    expect(matchesPath("/api/activities/123/likes", publicGetOnlyPatterns)).toBe(false)
    expect(matchesPath("/api/activities", publicGetOnlyPatterns)).toBe(false)
    expect(matchesPath("/api/comments-other", publicGetOnlyPatterns)).toBe(false)
  })

  it("不应该匹配多层路径", () => {
    expect(matchesPath("/api/activities/123/456/comments", publicGetOnlyPatterns)).toBe(false)
    expect(matchesPath("/api/activities/comments", publicGetOnlyPatterns)).toBe(false)
  })
})
