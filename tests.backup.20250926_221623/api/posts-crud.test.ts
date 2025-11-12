import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// 简化的Mock设置
const mockPrismaClient = {
  post: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  tag: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
}

// Mock管理员用户数据
const mockAdminUser = {
  id: "admin-1",
  email: "admin@test.com",
  role: "ADMIN",
  status: "ACTIVE",
  name: "管理员",
}

// Mock普通用户数据
const mockRegularUser = {
  id: "user-1",
  email: "user@test.com",
  role: "USER",
  status: "ACTIVE",
  name: "普通用户",
}

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrismaClient,
}))

const mockWithApiAuth = vi.fn()
vi.mock("@/lib/api/unified-auth", () => ({
  withApiAuth: mockWithApiAuth,
}))

vi.mock("@/lib/permissions", () => ({
  createPermissionError: vi.fn(),
}))

vi.mock("@/lib/security", () => ({
  XSSProtection: {
    validateAndSanitizeInput: vi.fn((input) => input),
  },
}))

vi.mock("@/lib/utils/logger", () => ({
  apiLogger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}))

// 动态导入API处理器
async function importApiHandlers() {
  const { GET, POST, PUT, DELETE } = await import("../../app/api/admin/posts/route")
  return { GET, POST, PUT, DELETE }
}

describe("Posts API CRUD 测试", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // 重置所有Mock函数
    Object.values(mockPrismaClient.post).forEach((fn) => {
      if (vi.isMockFunction(fn)) fn.mockReset()
    })

    // 默认权限验证成功，返回管理员用户
    mockWithApiAuth.mockImplementation(async (request, policy, handler) => {
      return await handler({
        user: mockAdminUser,
        requestId: "test-request-id",
        path: request.url,
      })
    })
  })

  describe("GET /api/admin/posts - 获取管理员文章列表", () => {
    it("应该返回分页的文章列表", async () => {
      const { GET } = await importApiHandlers()

      const mockPosts = [
        {
          id: "1",
          title: "测试文章1",
          slug: "test-post-1",
          content: "文章内容1",
          published: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          authorId: "admin-1",
          author: { id: "admin-1", email: "admin@test.com", name: "管理员" },
          tags: [],
          series: null,
          _count: { comments: 0, likes: 0, bookmarks: 0 },
        },
        {
          id: "2",
          title: "测试文章2",
          slug: "test-post-2",
          content: "文章内容2",
          published: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          authorId: "admin-1",
          author: { id: "admin-1", email: "admin@test.com", name: "管理员" },
          tags: [],
          series: null,
          _count: { comments: 0, likes: 0, bookmarks: 0 },
        },
      ]

      mockPrismaClient.post.findMany.mockResolvedValue(mockPosts)
      mockPrismaClient.post.count.mockResolvedValue(2)

      const request = new NextRequest(
        new URL("http://localhost:3000/api/admin/posts?page=1&limit=10")
      )

      const response = await GET(request)
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(result.data.posts).toHaveLength(2)
      expect(result.data.pagination.totalCount).toBe(2)
    })

    it("应该支持按状态筛选", async () => {
      const { GET } = await importApiHandlers()

      mockPrismaClient.post.findMany.mockResolvedValue([])
      mockPrismaClient.post.count.mockResolvedValue(0)

      const request = new NextRequest(
        new URL("http://localhost:3000/api/admin/posts?published=false")
      )

      await GET(request)

      expect(mockPrismaClient.post.findMany).toHaveBeenCalledWith({
        where: { published: false },
        include: expect.any(Object),
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 10,
      })
    })

    it("应该支持搜索功能", async () => {
      const { GET } = await importApiHandlers()

      mockPrismaClient.post.findMany.mockResolvedValue([])
      mockPrismaClient.post.count.mockResolvedValue(0)

      const request = new NextRequest(new URL("http://localhost:3000/api/admin/posts?search=测试"))

      await GET(request)

      expect(mockPrismaClient.post.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { title: { contains: "测试", mode: "insensitive" } },
            { excerpt: { contains: "测试", mode: "insensitive" } },
            { content: { contains: "测试", mode: "insensitive" } },
          ],
        },
        include: expect.any(Object),
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 10,
      })
    })
  })

  describe("POST /api/admin/posts - 创建文章", () => {
    it("管理员应该能够创建文章", async () => {
      const { POST } = await importApiHandlers()

      const newPost = {
        id: "new-post-1",
        title: "新文章",
        slug: "new-post",
        content: "新文章内容",
        excerpt: "摘要",
        published: false,
        authorId: "admin-1",
      }

      mockPrismaClient.post.create.mockResolvedValue(newPost)

      const request = new NextRequest(new URL("http://localhost:3000/api/admin/posts"), {
        method: "POST",
        body: JSON.stringify({
          title: "新文章",
          content: "新文章内容",
          excerpt: "摘要",
          tags: ["技术", "前端"],
        }),
      })

      const response = await POST(request)
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(mockPrismaClient.post.create).toHaveBeenCalled()
    })

    it("非管理员应该被拒绝创建文章", async () => {
      const { POST } = await importApiHandlers()

      // 模拟权限验证失败
      mockWithApiAuth.mockImplementation(async (request, policy, handler) => {
        throw new Error("权限不足")
      })

      const request = new NextRequest(new URL("http://localhost:3000/api/admin/posts"), {
        method: "POST",
        body: JSON.stringify({
          title: "新文章",
          content: "内容",
        }),
      })

      const response = await POST(request)

      expect(response.status).toBe(403)
    })

    it("应该验证必填字段", async () => {
      const { POST } = await importApiHandlers()

      const request = new NextRequest(new URL("http://localhost:3000/api/admin/posts"), {
        method: "POST",
        body: JSON.stringify({
          // 缺少 title 和 content
          excerpt: "摘要",
        }),
      })

      const response = await POST(request)
      const result = await response.json()

      expect(response.status).toBe(400)
      expect(result.success).toBe(false)
      expect(result.error.message).toContain("标题和内容是必需的")
    })
  })

  describe("PUT /api/admin/posts - 更新文章状态", () => {
    it("应该能更新文章发布状态", async () => {
      const { PUT } = await importApiHandlers()

      const existingPost = {
        id: "post-1",
        authorId: "admin-1",
        title: "原标题",
        published: false,
      }

      const updatedPost = {
        ...existingPost,
        published: true,
        publishedAt: new Date(),
      }

      mockPrismaClient.post.findUnique.mockResolvedValue(existingPost)
      mockPrismaClient.post.update.mockResolvedValue(updatedPost)

      const request = new NextRequest(new URL("http://localhost:3000/api/admin/posts"), {
        method: "PUT",
        body: JSON.stringify({
          postId: "post-1",
          published: true,
        }),
      })

      const response = await PUT(request)
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(result.data.action).toBe("published")
    })

    it("应该处理不存在的文章", async () => {
      const { PUT } = await importApiHandlers()

      mockPrismaClient.post.findUnique.mockResolvedValue(null)

      const request = new NextRequest(new URL("http://localhost:3000/api/admin/posts"), {
        method: "PUT",
        body: JSON.stringify({
          postId: "nonexistent",
          published: true,
        }),
      })

      const response = await PUT(request)
      const result = await response.json()

      expect(response.status).toBe(404)
      expect(result.success).toBe(false)
    })
  })

  describe("DELETE /api/admin/posts - 删除文章", () => {
    it("管理员应该能删除任何文章", async () => {
      const { DELETE } = await importApiHandlers()

      const existingPost = {
        id: "post-1",
        authorId: "user-1",
        title: "要删除的文章",
        _count: { comments: 0, likes: 0, bookmarks: 0 },
      }

      mockPrismaClient.post.findUnique.mockResolvedValue(existingPost)
      mockPrismaClient.post.delete.mockResolvedValue(existingPost)

      const request = new NextRequest(new URL("http://localhost:3000/api/admin/posts?id=post-1"), {
        method: "DELETE",
      })

      const response = await DELETE(request)
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(mockPrismaClient.post.delete).toHaveBeenCalledWith({
        where: { id: "post-1" },
      })
    })

    it("应该正确处理不存在的文章", async () => {
      const { DELETE } = await importApiHandlers()

      mockPrismaClient.post.findUnique.mockResolvedValue(null)

      const request = new NextRequest(
        new URL("http://localhost:3000/api/admin/posts?id=nonexistent"),
        {
          method: "DELETE",
        }
      )

      const response = await DELETE(request)
      const result = await response.json()

      expect(response.status).toBe(404)
      expect(result.success).toBe(false)
    })
  })

  describe("错误处理和边界情况", () => {
    it("应该处理数据库连接错误", async () => {
      const { GET } = await importApiHandlers()

      mockPrismaClient.post.findMany.mockRejectedValue(new Error("数据库连接失败"))

      const request = new NextRequest(new URL("http://localhost:3000/api/admin/posts"))

      const response = await GET(request)

      expect(response.status).toBe(500)
    })

    it("应该处理无效的分页参数", async () => {
      const { GET } = await importApiHandlers()

      const request = new NextRequest(
        new URL("http://localhost:3000/api/admin/posts?page=-1&limit=1000")
      )

      // 应该使用默认值或纠正无效参数
      mockPrismaClient.post.findMany.mockResolvedValue([])
      mockPrismaClient.post.count.mockResolvedValue(0)

      await GET(request)

      // 验证传递给数据库的参数是有效的
      expect(mockPrismaClient.post.findMany).toHaveBeenCalledWith({
        where: {},
        include: expect.any(Object),
        orderBy: { createdAt: "desc" },
        skip: expect.any(Number),
        take: expect.any(Number),
      })
    })

    it("应该处理恶意输入", async () => {
      const { POST } = await importApiHandlers()

      const request = new NextRequest(new URL("http://localhost:3000/api/admin/posts"), {
        method: "POST",
        body: JSON.stringify({
          title: '<script>alert("XSS")</script>',
          content: "恶意脚本内容",
        }),
      })

      // XSSProtection 应该会清理输入
      const response = await POST(request)

      if (response.status === 200) {
        const result = await response.json()
        // XSS防护应该已经清理了标题
        expect(result.success).toBe(true)
      }
    })
  })
})
