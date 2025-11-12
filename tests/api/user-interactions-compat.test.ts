/**
 * 用户互动 API 兼容性测试
 * 验证历史路由委托到统一服务层后，对外行为保持完全一致
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { POST } from "@/app/api/user/interactions/route"
import { prisma } from "@/lib/prisma"
import * as interactions from "@/lib/interactions"

const authMocks = vi.hoisted(() => ({
  assertPolicy: vi.fn(),
  generateRequestId: vi.fn(() => "req-test-id"),
}))

// Mock 依赖
vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    activity: {
      findUnique: vi.fn(),
    },
    like: {
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
    },
    bookmark: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    follow: {
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}))

// Mock 交互服务
vi.mock("@/lib/interactions", () => ({
  toggleLike: vi.fn(),
  toggleBookmark: vi.fn(),
}))

vi.mock("@/lib/auth/session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/session")>("@/lib/auth/session")
  return {
    ...actual,
    assertPolicy: authMocks.assertPolicy,
    generateRequestId: authMocks.generateRequestId,
  }
})

vi.mock("@/lib/audit-log", () => ({
  auditLogger: {
    logEvent: vi.fn().mockResolvedValue(undefined),
  },
  getClientIP: vi.fn(() => "127.0.0.1"),
  getClientUserAgent: vi.fn(() => "vitest-agent"),
}))

describe("用户互动 API 兼容性测试", () => {
  const mockUser = {
    id: "user-123",
    email: "test@example.com",
    name: "Test User",
    role: "USER" as const,
    status: "ACTIVE" as const,
    avatarUrl: null,
  }

  const mockPost = {
    id: "post-123",
    title: "Test Post",
    slug: "test-post",
    published: true,
    authorId: "author-123",
  }

  const mockActivity = {
    id: "activity-123",
    content: "Test Activity",
    authorId: "author-456",
  }

  beforeEach(() => {
    vi.clearAllMocks()
    authMocks.assertPolicy.mockResolvedValue([mockUser as any, null])
  })

  function expectPolicyInvocation() {
    expect(authMocks.assertPolicy).toHaveBeenCalledWith(
      "user-active",
      expect.objectContaining({
        path: "/api/user/interactions",
        requestId: "req-test-id",
        ip: "127.0.0.1",
        ua: "vitest-agent",
      })
    )
  }

  describe("点赞功能兼容性", () => {
    describe("文章点赞", () => {
      it("未点赞到点赞 - 响应格式保持一致", async () => {
        // 设置 mock
        const prismaMock = prisma as any
        prismaMock.post.findUnique.mockResolvedValue(mockPost)

        const toggleLikeMock = interactions.toggleLike as any
        toggleLikeMock.mockResolvedValue({
          isLiked: true, // 服务层返回 isLiked
          count: 10,
        })

        // mock 查询新创建的点赞ID
        prismaMock.like.findFirst.mockResolvedValue({
          id: "like-new-123",
        })

        // 创建请求
        const request = new NextRequest("http://localhost:3000/api/user/interactions", {
          method: "POST",
          body: JSON.stringify({
            type: "like",
            targetType: "POST",
            targetId: "post-123",
            action: "like",
          }),
        })

        // 执行请求
        const response = await POST(request)
        const data = await response.json()

        // 验证响应格式与原实现一致
        expect(data.success).toBe(true)
        expect(data.data).toEqual({
          action: "liked", // 原格式：action 字段
          likeId: "like-new-123",
          likeCount: 10, // 原格式：likeCount 字段
          targetType: "POST",
          targetId: "post-123",
        })

        // 验证调用了服务层
        expect(toggleLikeMock).toHaveBeenCalledWith("post", "post-123", "user-123")
        expectPolicyInvocation()
      })

      it("已点赞到取消点赞 - 响应格式保持一致", async () => {
        const prismaMock = prisma as any
        prismaMock.post.findUnique.mockResolvedValue(mockPost)

        const toggleLikeMock = interactions.toggleLike as any
        toggleLikeMock.mockResolvedValue({
          isLiked: false, // 服务层返回 isLiked
          count: 9,
        })

        const request = new NextRequest("http://localhost:3000/api/user/interactions", {
          method: "POST",
          body: JSON.stringify({
            type: "like",
            targetType: "POST",
            targetId: "post-123",
            action: "unlike",
          }),
        })

        const response = await POST(request)
        const data = await response.json()

        expect(data.success).toBe(true)
        expect(data.data).toEqual({
          action: "unliked", // 原格式：action 字段
          likeCount: 9, // 原格式：likeCount 字段
          targetType: "POST",
          targetId: "post-123",
        })
        expectPolicyInvocation()
      })

      it("文章不存在 - 错误格式保持一致", async () => {
        const prismaMock = prisma as any
        prismaMock.post.findUnique.mockResolvedValue(null)

        const request = new NextRequest("http://localhost:3000/api/user/interactions", {
          method: "POST",
          body: JSON.stringify({
            type: "like",
            targetType: "POST",
            targetId: "post-not-exist",
            action: "like",
          }),
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(404)
        expect(data.success).toBe(false)
        expect(data.error.code).toBe("TARGET_NOT_FOUND")
        expect(data.error.message).toBe("目标内容不存在")
        expectPolicyInvocation()
      })
    })

    describe("动态点赞", () => {
      it("动态点赞 - 响应格式保持一致", async () => {
        const prismaMock = prisma as any
        prismaMock.activity.findUnique.mockResolvedValue(mockActivity)

        const toggleLikeMock = interactions.toggleLike as any
        toggleLikeMock.mockResolvedValue({
          isLiked: true, // 服务层返回 isLiked
          count: 5,
        })

        // mock 查询新创建的点赞ID
        prismaMock.like.findFirst.mockResolvedValue({
          id: "like-activity-123",
        })

        const request = new NextRequest("http://localhost:3000/api/user/interactions", {
          method: "POST",
          body: JSON.stringify({
            type: "like",
            targetType: "ACTIVITY",
            targetId: "activity-123",
            action: "like",
          }),
        })

        const response = await POST(request)
        const data = await response.json()

        expect(data.success).toBe(true)
        expect(data.data).toEqual({
          action: "liked",
          likeId: "like-activity-123",
          likeCount: 5,
          targetType: "ACTIVITY",
          targetId: "activity-123",
        })

        expect(toggleLikeMock).toHaveBeenCalledWith("activity", "activity-123", "user-123")
        expectPolicyInvocation()
      })
    })
  })

  describe("收藏功能兼容性", () => {
    it("未收藏到收藏 - 响应格式保持一致", async () => {
      const prismaMock = prisma as any
      prismaMock.post.findUnique.mockResolvedValue(mockPost)
      // count 已由服务层返回，无需再次查询

      const toggleBookmarkMock = interactions.toggleBookmark as any
      toggleBookmarkMock.mockResolvedValue({
        isBookmarked: true, // 服务层返回 isBookmarked
        count: 15,
      })

      // mock 查询新创建的收藏ID
      prismaMock.bookmark.findUnique.mockResolvedValue({
        id: "bookmark-new-123",
      })

      const request = new NextRequest("http://localhost:3000/api/user/interactions", {
        method: "POST",
        body: JSON.stringify({
          type: "bookmark",
          postId: "post-123",
          action: "bookmark",
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data).toEqual({
        action: "bookmarked", // 原格式：action 字段
        bookmarkId: "bookmark-new-123",
        post: { id: "post-123", title: "Test Post" },
        bookmarkCount: 15, // 原格式：bookmarkCount 字段
      })

      expect(toggleBookmarkMock).toHaveBeenCalledWith("post-123", "user-123")
      expectPolicyInvocation()
    })

    it("已收藏到取消收藏 - 响应格式保持一致", async () => {
      const prismaMock = prisma as any
      prismaMock.post.findUnique.mockResolvedValue(mockPost)
      // count 已由服务层返回，无需再次查询

      const toggleBookmarkMock = interactions.toggleBookmark as any
      toggleBookmarkMock.mockResolvedValue({
        isBookmarked: false, // 服务层返回 isBookmarked
        count: 14,
      })

      const request = new NextRequest("http://localhost:3000/api/user/interactions", {
        method: "POST",
        body: JSON.stringify({
          type: "bookmark",
          postId: "post-123",
          action: "unbookmark",
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data).toEqual({
        action: "unbookmarked", // 原格式：action 字段
        post: { id: "post-123", title: "Test Post" },
        bookmarkCount: 14, // 原格式：bookmarkCount 字段
      })
      expectPolicyInvocation()
    })

    it("文章未发布 - 错误格式保持一致", async () => {
      const prismaMock = prisma as any
      prismaMock.post.findUnique.mockResolvedValue(null)

      const request = new NextRequest("http://localhost:3000/api/user/interactions", {
        method: "POST",
        body: JSON.stringify({
          type: "bookmark",
          postId: "post-unpublished",
          action: "bookmark",
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("POST_NOT_FOUND")
      expect(data.error.message).toBe("文章不存在或未发布")
      expectPolicyInvocation()
    })
  })

  describe("关注功能冒烟测试", () => {
    it("关注功能不受影响 - 保持原有逻辑", async () => {
      const prismaMock = prisma as any
      const targetUser = {
        id: "target-user-123",
        email: "target@example.com",
        name: "Target User",
        status: "ACTIVE",
      }

      // Mock user.findUnique 时，包含select参数，只返回需要的字段
      prismaMock.user.findUnique.mockImplementation((args: any) => {
        if (args.select) {
          // 如果有 select 参数，只返回指定字段
          return Promise.resolve({
            id: "target-user-123",
            email: "target@example.com",
            name: "Target User",
          })
        }
        // 没有 select 时返回完整对象
        return Promise.resolve(targetUser)
      })
      prismaMock.follow.findFirst.mockResolvedValue(null)
      prismaMock.follow.create.mockResolvedValue({
        followerId: mockUser.id,
        followingId: targetUser.id,
      })
      prismaMock.follow.count.mockResolvedValue(100)

      const request = new NextRequest("http://localhost:3000/api/user/interactions", {
        method: "POST",
        body: JSON.stringify({
          type: "follow",
          targetUserId: "target-user-123",
          action: "follow",
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      // 验证关注功能响应格式未变
      expect(data.success).toBe(true)
      expect(data.data).toEqual({
        action: "followed",
        targetUser: {
          id: "target-user-123",
          email: "target@example.com",
          name: "Target User",
        },
        followerCount: 100,
      })

      // 确保没有调用点赞或收藏服务
      expect(interactions.toggleLike).not.toHaveBeenCalled()
      expect(interactions.toggleBookmark).not.toHaveBeenCalled()
      expectPolicyInvocation()
    })
  })

  describe("错误处理兼容性", () => {
    it("参数缺失 - 错误格式保持一致", async () => {
      const request = new NextRequest("http://localhost:3000/api/user/interactions", {
        method: "POST",
        body: JSON.stringify({
          type: "like",
          targetType: "POST",
          // 缺少 targetId 和 action
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("INVALID_PARAMETERS")
      expect(data.error.message).toBe("参数错误：目标类型、目标ID和操作是必需的")
      expectPolicyInvocation()
    })

    it("不支持的目标类型 - 错误格式保持一致", async () => {
      const request = new NextRequest("http://localhost:3000/api/user/interactions", {
        method: "POST",
        body: JSON.stringify({
          type: "like",
          targetType: "COMMENT", // 不支持的类型
          targetId: "comment-123",
          action: "like",
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("UNSUPPORTED_TARGET_TYPE")
      expect(data.error.message).toBe("不支持的目标类型")
      expectPolicyInvocation()
    })

    it("不支持的互动类型 - 错误格式保持一致", async () => {
      const request = new NextRequest("http://localhost:3000/api/user/interactions", {
        method: "POST",
        body: JSON.stringify({
          type: "share", // 不支持的互动类型
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("UNSUPPORTED_INTERACTION_TYPE")
      expect(data.error.message).toBe("不支持的互动类型")
      expectPolicyInvocation()
    })

    it("鉴权失败 - 仍保持历史错误契约", async () => {
      authMocks.assertPolicy.mockResolvedValueOnce([
        null,
        {
          code: "UNAUTHORIZED",
          message: "未登录",
          statusCode: 401,
        } as any,
      ])

      const request = new NextRequest("http://localhost:3000/api/user/interactions", {
        method: "POST",
        body: JSON.stringify({
          type: "like",
          targetType: "POST",
          targetId: "post-123",
          action: "like",
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe("UNAUTHORIZED")
      expect(data.error.message).toBe("未登录")
      expectPolicyInvocation()
    })
  })
})
