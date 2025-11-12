import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { ErrorCode, createErrorResponse } from "@/lib/api/unified-response"
import { GET, POST, PUT, DELETE } from "@/app/api/admin/posts/route"
import { prisma } from "@/lib/prisma"

const hoisted = vi.hoisted(() => ({
  withApiAuthMock: vi.fn(),
}))

vi.mock("@/lib/api/unified-auth", () => ({
  withApiAuth: (...args: Parameters<typeof hoisted.withApiAuthMock>) =>
    hoisted.withApiAuthMock(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

const ADMIN_USER = {
  id: "admin-001",
  email: "admin@example.com",
  role: "ADMIN" as const,
  status: "ACTIVE" as const,
  name: "Admin",
  avatarUrl: null,
}

const defaultAuthContext = (request: NextRequest) => ({
  user: ADMIN_USER,
  requestId: "req-admin",
  ip: "127.0.0.1",
  ua: "vitest-agent",
  path: request.nextUrl.pathname,
  timestamp: new Date(),
})

beforeEach(() => {
  vi.clearAllMocks()
  hoisted.withApiAuthMock.mockImplementation(async (request, _policy, handler) => {
    return handler(defaultAuthContext(request) as any)
  })
})

describe("Admin posts route", () => {
  describe("GET", () => {
    it("返回文章列表并包含分页信息", async () => {
      vi.mocked(prisma.post.findMany).mockResolvedValue([
        {
          id: "post-1",
          title: "Test Post",
          createdAt: new Date("2025-01-01"),
          author: { id: "user-1", email: "user@example.com", name: "User" },
          series: null,
          tags: [],
          _count: { comments: 0, likes: 0, bookmarks: 0 },
        },
      ] as any)
      vi.mocked(prisma.post.count).mockResolvedValue(1 as any)

      const request = new NextRequest(
        "http://localhost:3000/api/admin/posts?page=2&limit=5&search=react&published=true"
      )

      const response = await GET(request)
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data.posts).toHaveLength(1)
      expect(prisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
          take: 5,
          where: expect.objectContaining({ published: true }),
        })
      )
    })

    it("当认证失败时返回对应响应", async () => {
      hoisted.withApiAuthMock.mockImplementationOnce(async () =>
        createErrorResponse(ErrorCode.FORBIDDEN, "无权限")
      )

      const request = new NextRequest("http://localhost:3000/api/admin/posts")
      const response = await GET(request)
      const body = await response.json()

      expect(response.status).toBe(403)
      expect(body.error.code).toBe(ErrorCode.FORBIDDEN)
    })

    it("数据库异常时返回失败响应", async () => {
      vi.mocked(prisma.post.findMany).mockRejectedValueOnce(new Error("db failure"))
      vi.mocked(prisma.post.count).mockResolvedValueOnce(0 as any)

      const request = new NextRequest("http://localhost:3000/api/admin/posts")
      const response = await GET(request)
      const body = await response.json()

      expect(response.status).toBe(500)
      expect(body.error.code).toBe(ErrorCode.GET_POSTS_FAILED)
    })
  })

  describe("POST", () => {
    it("成功创建文章并处理标签", async () => {
      vi.mocked(prisma.post.findUnique).mockResolvedValueOnce(null as any)
      vi.mocked(prisma.post.create).mockResolvedValueOnce({
        id: "post-new",
        title: "安全标题",
        content: "内容",
        excerpt: "内容",
        slug: "anquan-biaoti",
        author: { id: ADMIN_USER.id, email: ADMIN_USER.email, name: ADMIN_USER.name },
        series: null,
        tags: [],
      } as any)

      const request = new NextRequest("http://localhost:3000/api/admin/posts", {
        method: "POST",
        body: JSON.stringify({
          title: "安全标题",
          content: "内容",
          excerpt: "内容",
          tags: ["Next.js"],
          published: true,
        }),
      })

      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
      expect(prisma.post.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: "安全标题",
            authorId: ADMIN_USER.id,
            published: true,
          }),
        })
      )
    })

    it("缺少必填字段时返回 400", async () => {
      const request = new NextRequest("http://localhost:3000/api/admin/posts", {
        method: "POST",
        body: JSON.stringify({ content: "只有内容" }),
      })

      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error.code).toBe(ErrorCode.MISSING_REQUIRED_FIELDS)
      expect(prisma.post.create).not.toHaveBeenCalled()
    })

    it("创建失败时返回错误响应", async () => {
      vi.mocked(prisma.post.findUnique).mockResolvedValueOnce(null as any)
      vi.mocked(prisma.post.create).mockRejectedValueOnce(new Error("insert failed"))

      const request = new NextRequest("http://localhost:3000/api/admin/posts", {
        method: "POST",
        body: JSON.stringify({ title: "标题", content: "内容" }),
      })

      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(500)
      expect(body.error.code).toBe(ErrorCode.CREATE_POST_FAILED)
    })
  })

  describe("PUT", () => {
    it("更新文章发布状态", async () => {
      vi.mocked(prisma.post.findUnique).mockResolvedValueOnce({
        id: "post-1",
        title: "旧标题",
        published: false,
        authorId: ADMIN_USER.id,
      } as any)
      vi.mocked(prisma.post.update).mockResolvedValueOnce({
        id: "post-1",
        published: true,
        author: { id: ADMIN_USER.id, email: ADMIN_USER.email, name: ADMIN_USER.name },
        _count: { comments: 0, likes: 0, bookmarks: 0 },
      } as any)

      const request = new NextRequest("http://localhost:3000/api/admin/posts", {
        method: "PUT",
        body: JSON.stringify({ postId: "post-1", published: true }),
      })

      const response = await PUT(request)
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.data.action).toBe("published")
      expect(prisma.post.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "post-1" } })
      )
    })

    it("文章不存在时返回 404", async () => {
      vi.mocked(prisma.post.findUnique).mockResolvedValueOnce(null as any)

      const request = new NextRequest("http://localhost:3000/api/admin/posts", {
        method: "PUT",
        body: JSON.stringify({ postId: "missing", published: true }),
      })

      const response = await PUT(request)
      const body = await response.json()

      expect(response.status).toBe(404)
      expect(body.error.code).toBe(ErrorCode.POST_NOT_FOUND)
    })

    it("缺少参数时返回 400", async () => {
      const request = new NextRequest("http://localhost:3000/api/admin/posts", {
        method: "PUT",
        body: JSON.stringify({ published: true }),
      })

      const response = await PUT(request)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error.code).toBe(ErrorCode.INVALID_PARAMETERS)
      expect(prisma.post.update).not.toHaveBeenCalled()
    })
  })

  describe("DELETE", () => {
    it("删除指定文章并返回影响计数", async () => {
      vi.mocked(prisma.post.findUnique).mockResolvedValueOnce({
        id: "post-1",
        title: "待删除",
        authorId: ADMIN_USER.id,
        _count: { comments: 3, likes: 2, bookmarks: 1 },
      } as any)
      vi.mocked(prisma.post.delete).mockResolvedValueOnce({} as any)

      const request = new NextRequest("http://localhost:3000/api/admin/posts?id=post-1", {
        method: "DELETE",
      })

      const response = await DELETE(request)
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.data.deletedPost.id).toBe("post-1")
      expect(prisma.post.delete).toHaveBeenCalledWith({ where: { id: "post-1" } })
    })

    it("缺少文章ID时返回 400", async () => {
      const request = new NextRequest("http://localhost:3000/api/admin/posts", {
        method: "DELETE",
      })

      const response = await DELETE(request)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error.code).toBe(ErrorCode.MISSING_POST_ID)
      expect(prisma.post.delete).not.toHaveBeenCalled()
    })

    it("文章不存在时返回 404", async () => {
      vi.mocked(prisma.post.findUnique).mockResolvedValueOnce(null as any)

      const request = new NextRequest("http://localhost:3000/api/admin/posts?id=missing", {
        method: "DELETE",
      })

      const response = await DELETE(request)
      const body = await response.json()

      expect(response.status).toBe(404)
      expect(body.error.code).toBe(ErrorCode.POST_NOT_FOUND)
    })
  })
})
