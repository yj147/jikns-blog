import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import {
  GET as getActivityComments,
  POST as postActivityComment,
} from "@/app/api/activities/[id]/comments/route"
import { DELETE as deleteActivityComment } from "@/app/api/activities/[id]/comments/[commentId]/route"
import { GET as getComments, POST as postComment } from "@/app/api/comments/route"
import { DELETE as deleteComment } from "@/app/api/comments/[id]/route"

// Mock dependencies
vi.mock("@/lib/api/unified-auth", () => ({
  getCurrentUser: vi.fn(),
  withApiAuth: vi.fn((handler) => handler),
  handleApiError: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    comment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    activity: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    post: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock("@/lib/api-response", () => ({
  createApiResponse: vi.fn((data, meta) => ({
    success: true,
    data,
    ...(meta && { meta }),
  })),
  createErrorResponse: vi.fn((message, code, status) => ({
    success: false,
    error: { code, message },
  })),
}))

import { getCurrentUser } from "@/lib/api/unified-auth"
import { prisma } from "@/lib/prisma"

describe("活动评论兼容层测试", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("GET请求响应结构一致性", () => {
    it("统一路由和兼容路由应该返回相同的响应结构", async () => {
      const mockComments = [
        {
          id: "comment-1",
          content: "测试评论",
          authorId: "user-1",
          activityId: "activity-1",
          postId: null,
          parentId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          author: { id: "user-1", name: "用户1" },
        },
      ]

      // 设置mock
      vi.mocked(prisma.activity.findUnique).mockResolvedValue({ id: "activity-1" } as any)
      vi.mocked(prisma.comment.findMany).mockResolvedValue(mockComments)
      vi.mocked(prisma.comment.count).mockResolvedValue(1)

      // 测试统一路由
      const unifiedRequest = new NextRequest(
        "http://localhost:3000/api/comments?activityId=activity-1"
      )
      const unifiedResponse = await getComments(unifiedRequest)
      const unifiedData = await unifiedResponse.json()

      // 测试兼容路由
      const compatRequest = new NextRequest(
        "http://localhost:3000/api/activities/activity-1/comments"
      )
      const compatResponse = await getActivityComments(compatRequest, {
        params: { id: "activity-1" },
      })
      const compatData = await compatResponse.json()

      // 验证响应结构一致
      expect(unifiedData.success).toBe(compatData.success)
      expect(unifiedData.data).toBeDefined()
      expect(compatData.data).toBeDefined()
      expect(unifiedData.meta?.pagination).toBeDefined()
      expect(compatData.meta?.pagination).toBeDefined()

      // 验证分页结构
      if (unifiedData.meta?.pagination && compatData.meta?.pagination) {
        expect(unifiedData.meta.pagination).toHaveProperty("hasNext")
        expect(unifiedData.meta.pagination).toHaveProperty("nextCursor")
        expect(compatData.meta.pagination).toHaveProperty("hasNext")
        expect(compatData.meta.pagination).toHaveProperty("nextCursor")
      }
    })

    it("分页参数应该在两个路由中工作一致", async () => {
      vi.mocked(prisma.activity.findUnique).mockResolvedValue({ id: "activity-1" } as any)
      vi.mocked(prisma.comment.findMany).mockResolvedValue([])
      vi.mocked(prisma.comment.count).mockResolvedValue(0)

      // 统一路由带分页
      const unifiedRequest = new NextRequest(
        "http://localhost:3000/api/comments?activityId=activity-1&cursor=abc&limit=5"
      )
      await getComments(unifiedRequest)

      // 兼容路由带分页
      const compatRequest = new NextRequest(
        "http://localhost:3000/api/activities/activity-1/comments?cursor=abc&limit=5"
      )
      await getActivityComments(compatRequest, { params: { id: "activity-1" } })

      // 验证两个路由都使用相同的分页参数调用prisma
      expect(prisma.comment.findMany).toHaveBeenCalledTimes(2)
      const calls = vi.mocked(prisma.comment.findMany).mock.calls

      // 两次调用应该使用相同的分页参数
      expect(calls[0][0].take).toBe(calls[1][0].take)
      expect(calls[0][0].cursor).toEqual(calls[1][0].cursor)
    })
  })

  describe("POST请求响应结构一致性", () => {
    it("创建评论的响应结构应该一致", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: "user-1",
        role: "USER",
        status: "ACTIVE",
      } as any)

      vi.mocked(prisma.activity.findUnique).mockResolvedValue({ id: "activity-1" } as any)

      const mockComment = {
        id: "new-comment",
        content: "新评论",
        authorId: "user-1",
        activityId: "activity-1",
        postId: null,
        createdAt: new Date(),
        author: { id: "user-1", name: "用户1" },
      }

      vi.mocked(prisma.comment.create).mockResolvedValue(mockComment as any)

      // 测试统一路由
      const unifiedRequest = new NextRequest("http://localhost:3000/api/comments", {
        method: "POST",
        body: JSON.stringify({
          content: "新评论",
          activityId: "activity-1",
        }),
      })
      const unifiedResponse = await postComment(unifiedRequest)
      const unifiedData = await unifiedResponse.json()

      // 重置mock返回值
      vi.mocked(prisma.comment.create).mockResolvedValue(mockComment as any)

      // 测试兼容路由
      const compatRequest = new NextRequest(
        "http://localhost:3000/api/activities/activity-1/comments",
        {
          method: "POST",
          body: JSON.stringify({
            content: "新评论",
          }),
        }
      )
      const compatResponse = await postActivityComment(compatRequest, {
        params: { id: "activity-1" },
      })
      const compatData = await compatResponse.json()

      // 验证响应结构一致
      expect(unifiedData.success).toBe(compatData.success)
      expect(unifiedData.data).toBeDefined()
      expect(compatData.data).toBeDefined()
    })
  })

  describe("错误响应结构一致性", () => {
    it("401错误响应结构应该一致", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      // 统一路由401
      const unifiedRequest = new NextRequest("http://localhost:3000/api/comments", {
        method: "POST",
        body: JSON.stringify({ content: "评论" }),
      })
      const unifiedResponse = await postComment(unifiedRequest)
      const unifiedData = await unifiedResponse.json()

      // 兼容路由401
      const compatRequest = new NextRequest(
        "http://localhost:3000/api/activities/activity-1/comments",
        {
          method: "POST",
          body: JSON.stringify({ content: "评论" }),
        }
      )
      const compatResponse = await postActivityComment(compatRequest, {
        params: { id: "activity-1" },
      })
      const compatData = await compatResponse.json()

      // 验证错误结构一致
      expect(unifiedResponse.status).toBe(401)
      expect(compatResponse.status).toBe(401)
      expect(unifiedData.success).toBe(false)
      expect(compatData.success).toBe(false)
      expect(unifiedData.error).toBeDefined()
      expect(compatData.error).toBeDefined()
      expect(unifiedData.error.code).toBeDefined()
      expect(compatData.error.code).toBeDefined()
    })

    it("403错误响应结构应该一致", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: "user-1",
        role: "USER",
        status: "BANNED",
      } as any)

      // 统一路由403
      const unifiedRequest = new NextRequest("http://localhost:3000/api/comments", {
        method: "POST",
        body: JSON.stringify({ content: "评论", activityId: "activity-1" }),
      })
      const unifiedResponse = await postComment(unifiedRequest)
      const unifiedData = await unifiedResponse.json()

      // 兼容路由403
      const compatRequest = new NextRequest(
        "http://localhost:3000/api/activities/activity-1/comments",
        {
          method: "POST",
          body: JSON.stringify({ content: "评论" }),
        }
      )
      const compatResponse = await postActivityComment(compatRequest, {
        params: { id: "activity-1" },
      })
      const compatData = await compatResponse.json()

      // 验证错误结构一致
      expect(unifiedResponse.status).toBe(403)
      expect(compatResponse.status).toBe(403)
      expect(unifiedData.success).toBe(false)
      expect(compatData.success).toBe(false)
      expect(unifiedData.error.code).toBeDefined()
      expect(compatData.error.code).toBeDefined()
    })

    it("404错误响应结构应该一致", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: "user-1",
        role: "USER",
      } as any)

      vi.mocked(prisma.comment.findUnique).mockResolvedValue(null)

      // 统一路由404
      const unifiedRequest = new NextRequest("http://localhost:3000/api/comments/non-existent", {
        method: "DELETE",
      })
      const unifiedResponse = await deleteComment(unifiedRequest, {
        params: { id: "non-existent" },
      })
      const unifiedData = await unifiedResponse.json()

      // 兼容路由404
      const compatRequest = new NextRequest(
        "http://localhost:3000/api/activities/activity-1/comments/non-existent",
        {
          method: "DELETE",
        }
      )
      const compatResponse = await deleteActivityComment(compatRequest, {
        params: { id: "activity-1", commentId: "non-existent" },
      })
      const compatData = await compatResponse.json()

      // 验证错误结构一致
      expect(unifiedResponse.status).toBe(404)
      expect(compatResponse.status).toBe(404)
      expect(unifiedData.success).toBe(false)
      expect(compatData.success).toBe(false)
      expect(unifiedData.error.code).toBeDefined()
      expect(compatData.error.code).toBeDefined()
    })

    it("400错误响应结构应该一致", async () => {
      // 统一路由400（缺少参数）
      const unifiedRequest = new NextRequest("http://localhost:3000/api/comments")
      const unifiedResponse = await getComments(unifiedRequest)
      const unifiedData = await unifiedResponse.json()

      // 兼容路由一般不会有400（因为activityId在路径中），这里测试无效的activityId
      vi.mocked(prisma.activity.findUnique).mockResolvedValue(null)
      const compatRequest = new NextRequest("http://localhost:3000/api/activities/invalid/comments")
      const compatResponse = await getActivityComments(compatRequest, { params: { id: "invalid" } })
      const compatData = await compatResponse.json()

      // 验证错误结构一致
      expect(unifiedResponse.status).toBe(400)
      expect(compatResponse.status).toBe(404) // 活动不存在返回404
      expect(unifiedData.success).toBe(false)
      expect(compatData.success).toBe(false)
      expect(unifiedData.error).toBeDefined()
      expect(compatData.error).toBeDefined()
    })
  })

  describe("DELETE请求响应结构一致性", () => {
    it("删除成功的响应结构应该一致", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: "user-1",
        role: "USER",
      } as any)

      const mockComment = {
        id: "comment-1",
        authorId: "user-1",
        activityId: "activity-1",
        content: "我的评论",
      }

      vi.mocked(prisma.comment.findUnique).mockResolvedValue(mockComment as any)
      vi.mocked(prisma.comment.update).mockResolvedValue({
        ...mockComment,
        content: "[该评论已删除]",
      } as any)

      // 统一路由删除
      const unifiedRequest = new NextRequest("http://localhost:3000/api/comments/comment-1", {
        method: "DELETE",
      })
      const unifiedResponse = await deleteComment(unifiedRequest, { params: { id: "comment-1" } })
      const unifiedData = await unifiedResponse.json()

      // 重置mock
      vi.mocked(prisma.comment.findUnique).mockResolvedValue(mockComment as any)
      vi.mocked(prisma.comment.update).mockResolvedValue({
        ...mockComment,
        content: "[该评论已删除]",
      } as any)

      // 兼容路由删除
      const compatRequest = new NextRequest(
        "http://localhost:3000/api/activities/activity-1/comments/comment-1",
        {
          method: "DELETE",
        }
      )
      const compatResponse = await deleteActivityComment(compatRequest, {
        params: { id: "activity-1", commentId: "comment-1" },
      })
      const compatData = await compatResponse.json()

      // 验证响应结构一致
      expect(unifiedResponse.status).toBe(200)
      expect(compatResponse.status).toBe(200)
      expect(unifiedData.success).toBe(true)
      expect(compatData.success).toBe(true)
      expect(unifiedData.data).toBeDefined()
      expect(compatData.data).toBeDefined()
    })
  })
})
