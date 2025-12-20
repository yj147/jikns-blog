import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { GET as listFeeds } from "@/app/api/admin/feeds/route"
import { GET as getFeed } from "@/app/api/admin/feeds/[feedId]/route"
import { POST as batchAction } from "@/app/api/admin/feeds/batch/route"
import {
  feedInclude,
  FEED_ORDER_BY,
  buildFeedWhere,
  mapFeedRecord,
} from "@/app/api/admin/feeds/utils"
import { createErrorResponse } from "@/lib/api-guards"
import { prisma } from "@/lib/prisma"

const adminUser = vi.hoisted(() => ({
  id: "11111111-1111-1111-1111-111111111111",
  email: "admin@example.com",
  role: "ADMIN" as const,
  status: "ACTIVE" as const,
  name: "Admin",
}))

const authorUser = vi.hoisted(() => ({
  id: "22222222-2222-2222-2222-222222222222",
  email: "author@example.com",
  role: "USER" as const,
  status: "ACTIVE" as const,
  name: "Writer",
}))

const feedRecord = vi.hoisted(() => ({
  id: "feed-1",
  authorId: authorUser.id,
  content: "hello world",
  contentTokens: "hello world",
  imageUrls: ["a.jpg"],
  isPinned: false,
  deletedAt: null,
  likesCount: 10,
  commentsCount: 2,
  viewsCount: 99,
  createdAt: new Date("2025-01-01T00:00:00Z"),
  updatedAt: new Date("2025-01-02T00:00:00Z"),
  author: {
    id: authorUser.id,
    name: authorUser.name,
    role: authorUser.role,
    status: authorUser.status,
  },
}))

const authHarness = vi.hoisted(() => ({
  currentUser: { ...adminUser },
  overrideResponse: null as ReturnType<typeof createErrorResponse> | null,
}))

vi.mock("@/lib/api-guards", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-guards")>("@/lib/api-guards")
  return {
    ...actual,
    withApiAuth: (handler: Parameters<typeof actual.withApiAuth>[0]) => {
      return (request: NextRequest, context?: any) => {
        if (authHarness.overrideResponse) {
          const response = authHarness.overrideResponse
          authHarness.overrideResponse = null
          return response
        }
        return handler(request, authHarness.currentUser as any, context)
      }
    },
  }
})

const mockPrisma = vi.hoisted(() => ({
  activity: {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    deleteMany: vi.fn(),
    updateMany: vi.fn(),
  },
  $transaction: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
  default: mockPrisma,
}))

beforeEach(() => {
  vi.clearAllMocks()
  authHarness.currentUser = { ...adminUser }
  authHarness.overrideResponse = null
  mockPrisma.activity.findMany.mockReset()
  mockPrisma.activity.count.mockReset()
  mockPrisma.activity.findUnique.mockReset()
  mockPrisma.activity.deleteMany.mockReset()
  mockPrisma.activity.updateMany.mockReset()
  mockPrisma.$transaction.mockReset()
  mockPrisma.$transaction.mockImplementation(async (fn) => fn(mockPrisma as any))
})

describe("admin feeds API", () => {
  describe("GET /api/admin/feeds", () => {
    it("管理员可按多条件筛选并返回分页信息", async () => {
      vi.mocked(prisma.activity.findMany).mockResolvedValue([feedRecord] as any)
      vi.mocked(prisma.activity.count).mockResolvedValue(25 as any)

      const request = new NextRequest(
        `http://localhost:3000/api/admin/feeds?page=2&limit=5&authorId=${authorUser.id}&q=hello&dateFrom=2025-01-01&dateTo=2025-02-01&isPinned=true&includeDeleted=true`
      )

      const response = await listFeeds(request)
      const payload = await response.json()
      const { meta, ...strippedPayload } = payload
      expect(meta).toEqual(expect.objectContaining({ timestamp: expect.any(String) }))

      expect(response.status).toBe(200)
      expect(payload.success).toBe(true)
      expect(payload.data.feeds[0].id).toBe("feed-1")
      expect(prisma.activity.findMany).toHaveBeenCalledWith({
        where: {
          AND: [
            { authorId: authorUser.id },
            {
              OR: [
                { content: { contains: "hello", mode: "insensitive" } },
                { contentTokens: { contains: "hello", mode: "insensitive" } },
              ],
            },
            { createdAt: { gte: new Date("2025-01-01"), lte: new Date("2025-02-01") } },
            { isPinned: true },
          ],
        },
        skip: 5,
        take: 5,
        orderBy: FEED_ORDER_BY,
        include: feedInclude,
      })
      expect(payload.data.pagination).toEqual(
        expect.objectContaining({
          currentPage: 2,
          totalPages: 5,
          totalCount: 25,
          hasNext: true,
          hasPrev: true,
        })
      )
    })

    it("复杂分页筛选返回稳定快照", async () => {
      const pinnedFeed = {
        ...feedRecord,
        id: "feed-42",
        isPinned: true,
        deletedAt: new Date("2025-03-01T12:00:00Z"),
        createdAt: new Date("2025-02-10T09:30:00Z"),
        updatedAt: new Date("2025-02-10T10:00:00Z"),
        author: { ...feedRecord.author },
      }
      const secondaryFeed = {
        ...feedRecord,
        id: "feed-41",
        authorId: adminUser.id,
        content: "secondary",
        createdAt: new Date("2025-02-05T00:00:00Z"),
        updatedAt: new Date("2025-02-05T00:00:00Z"),
        author: { ...feedRecord.author, id: adminUser.id, name: adminUser.name },
      }

      vi.mocked(prisma.activity.findMany).mockResolvedValue([pinnedFeed, secondaryFeed] as any)
      vi.mocked(prisma.activity.count).mockResolvedValue(205 as any)

      const response = await listFeeds(
        new NextRequest(
          "http://localhost:3000/api/admin/feeds?page=3&limit=80&authorId=22222222-2222-2222-2222-222222222222&includeDeleted=true&q=beta&dateFrom=2025-02-01&dateTo=2025-03-10&isPinned=false"
        )
      )
      const payload = await response.json()
      const { meta, ...strippedPayload } = payload
      expect(meta).toEqual(expect.objectContaining({ timestamp: expect.any(String) }))

      expect(prisma.activity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 160,
          take: 80,
          orderBy: FEED_ORDER_BY,
        })
      )

      expect(strippedPayload).toMatchInlineSnapshot(`
        {
          "data": {
            "feeds": [
              {
                "author": {
                  "id": "22222222-2222-2222-2222-222222222222",
                  "name": "Writer",
                  "role": "USER",
                  "status": "ACTIVE",
                },
                "authorId": "22222222-2222-2222-2222-222222222222",
                "commentsCount": 2,
                "content": "hello world",
                "createdAt": "2025-02-10T09:30:00.000Z",
                "deletedAt": "2025-03-01T12:00:00.000Z",
                "id": "feed-42",
                "imageUrls": [
                  "a.jpg",
                ],
                "isPinned": true,
                "likesCount": 10,
                "updatedAt": "2025-02-10T10:00:00.000Z",
                "viewsCount": 99,
              },
              {
                "author": {
                  "id": "11111111-1111-1111-1111-111111111111",
                  "name": "Admin",
                  "role": "USER",
                  "status": "ACTIVE",
                },
                "authorId": "11111111-1111-1111-1111-111111111111",
                "commentsCount": 2,
                "content": "secondary",
                "createdAt": "2025-02-05T00:00:00.000Z",
                "deletedAt": null,
                "id": "feed-41",
                "imageUrls": [
                  "a.jpg",
                ],
                "isPinned": false,
                "likesCount": 10,
                "updatedAt": "2025-02-05T00:00:00.000Z",
                "viewsCount": 99,
              },
            ],
            "pagination": {
              "currentPage": 3,
              "hasNext": false,
              "hasPrev": true,
              "totalCount": 205,
              "totalPages": 3,
            },
          },
          "success": true,
        }
      `)
    })

    it("非管理员强制限定为本人且隐藏删除", async () => {
      authHarness.currentUser = { ...authorUser }
      vi.mocked(prisma.activity.findMany).mockResolvedValue([] as any)
      vi.mocked(prisma.activity.count).mockResolvedValue(0 as any)

      const request = new NextRequest(
        `http://localhost:3000/api/admin/feeds?authorId=${adminUser.id}&includeDeleted=true&limit=50`
      )

      const response = await listFeeds(request)
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.data.pagination.totalCount).toBe(0)
      expect(prisma.activity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [{ deletedAt: null }, { authorId: authorUser.id }],
          },
          take: 50,
        })
      )
    })

    it("无效日期区间返回 400", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/admin/feeds?dateFrom=2025-02-02&dateTo=2025-01-01"
      )

      const response = await listFeeds(request)
      const payload = await response.json()

      expect(response.status).toBe(400)
      expect(payload.error.code).toBe("INVALID_QUERY")
      expect(prisma.activity.findMany).not.toHaveBeenCalled()
    })

    it("认证失败时直接返回守卫错误", async () => {
      authHarness.overrideResponse = createErrorResponse("未登录", "UNAUTH", 401)

      const response = await listFeeds(new NextRequest("http://localhost:3000/api/admin/feeds"))
      const payload = await response.json()

      expect(response.status).toBe(401)
      expect(payload.error.code).toBe("UNAUTH")
      expect(prisma.activity.findMany).not.toHaveBeenCalled()
      expect(prisma.activity.count).not.toHaveBeenCalled()
    })
  })

  describe("GET /api/admin/feeds/[feedId]", () => {
    it("缺少 feedId 返回 400", async () => {
      const response = await getFeed(new NextRequest("http://localhost:3000/api/admin/feeds/"), {
        params: {} as any,
      })
      const payload = await response.json()

      expect(response.status).toBe(400)
      expect(payload.error.code).toBe("MISSING_ID")
    })

    it("作者或管理员可读取详情", async () => {
      authHarness.currentUser = { ...authorUser }
      vi.mocked(prisma.activity.findUnique).mockResolvedValue(feedRecord as any)

      const response = await getFeed(
        new NextRequest("http://localhost:3000/api/admin/feeds/feed-1"),
        {
          params: { feedId: "feed-1" },
        }
      )
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.data.id).toBe("feed-1")
      expect(payload.data.authorId).toBe(authorUser.id)
    })

    it("越权访问被拒绝", async () => {
      authHarness.currentUser = { ...authorUser, id: "other-user" }
      vi.mocked(prisma.activity.findUnique).mockResolvedValue(feedRecord as any)

      const response = await getFeed(
        new NextRequest("http://localhost:3000/api/admin/feeds/feed-1"),
        {
          params: { feedId: "feed-1" },
        }
      )
      const payload = await response.json()

      expect(response.status).toBe(403)
      expect(payload.error.code).toBe("FORBIDDEN")
    })

    it("不存在的动态返回 404", async () => {
      vi.mocked(prisma.activity.findUnique).mockResolvedValue(null as any)

      const response = await getFeed(
        new NextRequest("http://localhost:3000/api/admin/feeds/nope"),
        {
          params: { feedId: "nope" },
        }
      )
      const payload = await response.json()

      expect(response.status).toBe(404)
      expect(payload.error.code).toBe("NOT_FOUND")
    })

    it("未登录访问直接返回守卫错误", async () => {
      authHarness.overrideResponse = createErrorResponse("未登录", "UNAUTH", 401)

      const response = await getFeed(
        new NextRequest("http://localhost:3000/api/admin/feeds/feed-1"),
        {
          params: { feedId: "feed-1" },
        }
      )
      const payload = await response.json()

      expect(response.status).toBe(401)
      expect(payload.error.code).toBe("UNAUTH")
      expect(prisma.activity.findUnique).not.toHaveBeenCalled()
    })
  })

  describe("POST /api/admin/feeds/batch", () => {
    it("批量删除在事务内执行并返回影响行数", async () => {
      vi.mocked(prisma.activity.findMany).mockResolvedValue([
        { id: "f1", authorId: adminUser.id },
        { id: "f2", authorId: adminUser.id },
      ] as any)
      mockPrisma.activity.deleteMany.mockResolvedValue({ count: 2 } as any)

      const response = await batchAction(
        new NextRequest("http://localhost:3000/api/admin/feeds/batch", {
          method: "POST",
          body: JSON.stringify({ action: "delete", ids: ["f1", "f2"] }),
        })
      )
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.data).toEqual({ action: "delete", affected: 2 })
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
      expect(mockPrisma.activity.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ["f1", "f2"] } },
      })
    })

    it("作者删除仅影响自身动态", async () => {
      authHarness.currentUser = { ...authorUser }
      vi.mocked(prisma.activity.findMany).mockResolvedValue([
        { id: "f1", authorId: authorUser.id },
      ] as any)
      mockPrisma.activity.deleteMany.mockResolvedValue({ count: 1 } as any)

      const response = await batchAction(
        new NextRequest("http://localhost:3000/api/admin/feeds/batch", {
          method: "POST",
          body: JSON.stringify({ action: "delete", ids: ["f1"] }),
        })
      )

      expect(response.status).toBe(200)
      expect(mockPrisma.activity.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ["f1"] }, authorId: authorUser.id },
      })
    })

    it("包含他人动态时返回 403 并不执行事务", async () => {
      authHarness.currentUser = { ...authorUser }
      vi.mocked(prisma.activity.findMany).mockResolvedValue([
        { id: "f1", authorId: authorUser.id },
        { id: "f2", authorId: "other" },
      ] as any)

      const response = await batchAction(
        new NextRequest("http://localhost:3000/api/admin/feeds/batch", {
          method: "POST",
          body: JSON.stringify({ action: "pin", ids: ["f1", "f2"] }),
        })
      )
      const payload = await response.json()

      expect(response.status).toBe(403)
      expect(payload.error.code).toBe("FORBIDDEN")
      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })

    it("批量操作始终使用事务上下文防止部分提交", async () => {
      vi.mocked(prisma.activity.findMany).mockResolvedValue([
        { id: "f1", authorId: adminUser.id },
        { id: "f2", authorId: adminUser.id },
      ] as any)

      const txActivity = {
        updateMany: vi.fn().mockResolvedValue({ count: 2 }),
      }

      mockPrisma.$transaction.mockImplementationOnce(async (fn) =>
        fn({ activity: txActivity } as any)
      )

      const response = await batchAction(
        new NextRequest("http://localhost:3000/api/admin/feeds/batch", {
          method: "POST",
          body: JSON.stringify({ action: "pin", ids: ["f1", "f2"] }),
        })
      )
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.data.affected).toBe(2)
      expect(txActivity.updateMany).toHaveBeenCalledTimes(1)
      expect(txActivity.updateMany).toHaveBeenCalledWith({
        data: { isPinned: true },
        where: { deletedAt: null, id: { in: ["f1", "f2"] } },
      })
      expect(mockPrisma.activity.updateMany).not.toHaveBeenCalled()
    })

    it("隐藏操作应仅处理未删除记录并设置删除时间", async () => {
      vi.mocked(prisma.activity.findMany).mockResolvedValue([
        { id: "f1", authorId: adminUser.id },
      ] as any)
      mockPrisma.activity.updateMany.mockResolvedValue({ count: 1 } as any)

      const response = await batchAction(
        new NextRequest("http://localhost:3000/api/admin/feeds/batch", {
          method: "POST",
          body: JSON.stringify({ action: "hide", ids: ["f1"] }),
        })
      )
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.data.affected).toBe(1)
      expect(mockPrisma.activity.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ["f1"] }, deletedAt: null },
        data: { deletedAt: expect.any(Date) },
      })
    })

    it("作者隐藏仅作用自身未删除动态", async () => {
      authHarness.currentUser = { ...authorUser }
      vi.mocked(prisma.activity.findMany).mockResolvedValue([
        { id: "f1", authorId: authorUser.id },
      ] as any)
      mockPrisma.activity.updateMany.mockResolvedValue({ count: 1 } as any)

      const response = await batchAction(
        new NextRequest("http://localhost:3000/api/admin/feeds/batch", {
          method: "POST",
          body: JSON.stringify({ action: "hide", ids: ["f1"] }),
        })
      )

      expect(response.status).toBe(200)
      expect(mockPrisma.activity.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ["f1"] }, deletedAt: null, authorId: authorUser.id },
        data: { deletedAt: expect.any(Date) },
      })
    })

    it("作者置顶仅作用于自身未删除动态", async () => {
      authHarness.currentUser = { ...authorUser }
      vi.mocked(prisma.activity.findMany).mockResolvedValue([
        { id: "f1", authorId: authorUser.id },
      ] as any)
      mockPrisma.activity.updateMany.mockResolvedValue({ count: 1 } as any)

      const response = await batchAction(
        new NextRequest("http://localhost:3000/api/admin/feeds/batch", {
          method: "POST",
          body: JSON.stringify({ action: "pin", ids: ["f1"] }),
        })
      )

      expect(response.status).toBe(200)
      expect(mockPrisma.activity.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ["f1"] }, deletedAt: null, authorId: authorUser.id },
        data: { isPinned: true },
      })
    })

    it("管理员置顶不受作者限制", async () => {
      vi.mocked(prisma.activity.findMany).mockResolvedValue([
        { id: "f1", authorId: adminUser.id },
      ] as any)
      mockPrisma.activity.updateMany.mockResolvedValue({ count: 1 } as any)

      const response = await batchAction(
        new NextRequest("http://localhost:3000/api/admin/feeds/batch", {
          method: "POST",
          body: JSON.stringify({ action: "pin", ids: ["f1"] }),
        })
      )

      expect(response.status).toBe(200)
      expect(mockPrisma.activity.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ["f1"] }, deletedAt: null },
        data: { isPinned: true },
      })
    })

    it("取消置顶会清除 isPinned", async () => {
      vi.mocked(prisma.activity.findMany).mockResolvedValue([
        { id: "f1", authorId: adminUser.id },
      ] as any)
      mockPrisma.activity.updateMany.mockResolvedValue({ count: 1 } as any)

      const response = await batchAction(
        new NextRequest("http://localhost:3000/api/admin/feeds/batch", {
          method: "POST",
          body: JSON.stringify({ action: "unpin", ids: ["f1"] }),
        })
      )

      expect(response.status).toBe(200)
      expect(mockPrisma.activity.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ["f1"] } },
        data: { isPinned: false },
      })
    })

    it("作者取消置顶同样受作者约束", async () => {
      authHarness.currentUser = { ...authorUser }
      vi.mocked(prisma.activity.findMany).mockResolvedValue([
        { id: "f1", authorId: authorUser.id },
      ] as any)
      mockPrisma.activity.updateMany.mockResolvedValue({ count: 1 } as any)

      const response = await batchAction(
        new NextRequest("http://localhost:3000/api/admin/feeds/batch", {
          method: "POST",
          body: JSON.stringify({ action: "unpin", ids: ["f1"] }),
        })
      )

      expect(response.status).toBe(200)
      expect(mockPrisma.activity.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ["f1"] }, authorId: authorUser.id },
        data: { isPinned: false },
      })
    })

    it("恢复显示时会限制作者", async () => {
      authHarness.currentUser = { ...authorUser }
      vi.mocked(prisma.activity.findMany).mockResolvedValue([
        { id: "f1", authorId: authorUser.id },
      ] as any)
      mockPrisma.activity.updateMany.mockResolvedValue({ count: 1 } as any)

      const response = await batchAction(
        new NextRequest("http://localhost:3000/api/admin/feeds/batch", {
          method: "POST",
          body: JSON.stringify({ action: "unhide", ids: ["f1"] }),
        })
      )

      expect(response.status).toBe(200)
      expect(mockPrisma.activity.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ["f1"] }, authorId: authorUser.id },
        data: { deletedAt: null },
      })
    })

    it("管理员恢复显示可操作任意作者", async () => {
      vi.mocked(prisma.activity.findMany).mockResolvedValue([
        { id: "f1", authorId: adminUser.id },
      ] as any)
      mockPrisma.activity.updateMany.mockResolvedValue({ count: 1 } as any)

      const response = await batchAction(
        new NextRequest("http://localhost:3000/api/admin/feeds/batch", {
          method: "POST",
          body: JSON.stringify({ action: "unhide", ids: ["f1"] }),
        })
      )

      expect(response.status).toBe(200)
      expect(mockPrisma.activity.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ["f1"] } },
        data: { deletedAt: null },
      })
    })

    it("目标不存在时返回 404", async () => {
      vi.mocked(prisma.activity.findMany).mockResolvedValue([] as any)

      const response = await batchAction(
        new NextRequest("http://localhost:3000/api/admin/feeds/batch", {
          method: "POST",
          body: JSON.stringify({ action: "delete", ids: ["missing"] }),
        })
      )
      const payload = await response.json()

      expect(response.status).toBe(404)
      expect(payload.error.code).toBe("NOT_FOUND")
    })

    it("事务失败返回 500 并不中断权限校验", async () => {
      vi.mocked(prisma.activity.findMany).mockResolvedValue([
        { id: "f1", authorId: adminUser.id },
      ] as any)
      mockPrisma.$transaction.mockRejectedValueOnce(new Error("tx failed"))

      const response = await batchAction(
        new NextRequest("http://localhost:3000/api/admin/feeds/batch", {
          method: "POST",
          body: JSON.stringify({ action: "delete", ids: ["f1"] }),
        })
      )
      const payload = await response.json()

      expect(response.status).toBe(500)
      expect(payload.error.code).toBe("BATCH_FAILED")
    })

    it("请求体验证失败返回 400", async () => {
      const response = await batchAction(
        new NextRequest("http://localhost:3000/api/admin/feeds/batch", {
          method: "POST",
          body: JSON.stringify({ action: "pin", ids: [] }),
        })
      )
      const payload = await response.json()

      expect(response.status).toBe(400)
      expect(payload.error.code).toBe("INVALID_BODY")
      expect(mockPrisma.activity.findMany).not.toHaveBeenCalled()
    })

    it("认证失败时直接返回错误响应", async () => {
      authHarness.overrideResponse = createErrorResponse("未登录", "UNAUTH", 401)

      const response = await batchAction(
        new NextRequest("http://localhost:3000/api/admin/feeds/batch", {
          method: "POST",
          body: JSON.stringify({ action: "pin", ids: ["f1"] }),
        })
      )
      const payload = await response.json()

      expect(response.status).toBe(401)
      expect(payload.error.code).toBe("UNAUTH")
      expect(mockPrisma.activity.findMany).not.toHaveBeenCalled()
    })
  })

  describe("feed utils", () => {
    it("空过滤返回空对象", () => {
      const where = buildFeedWhere({
        page: 1,
        limit: 20,
        includeDeleted: true,
      } as any)

      expect(where).toEqual({})
    })

    it("仅单个条件时不包裹 AND", () => {
      const authorId = crypto.randomUUID()
      const where = buildFeedWhere({
        page: 1,
        limit: 20,
        includeDeleted: true,
        authorId,
      } as any)

      expect(where).toEqual({ authorId })
    })

    it("mapFeedRecord 规范化时间字段", () => {
      const record = mapFeedRecord(feedRecord as any)
      expect(record.createdAt).toBe("2025-01-01T00:00:00.000Z")
      expect(record.deletedAt).toBeNull()
    })

    it("默认过滤会排除已删除记录并组合多条件", () => {
      const where = buildFeedWhere({
        page: 1,
        limit: 20,
        includeDeleted: false,
        authorId: adminUser.id,
        q: "beta",
        dateFrom: new Date("2025-01-01"),
        dateTo: new Date("2025-01-31"),
        isPinned: true,
      } as any)

      expect(where).toMatchInlineSnapshot(`
        {
          "AND": [
            {
              "deletedAt": null,
            },
            {
              "authorId": "11111111-1111-1111-1111-111111111111",
            },
            {
              "OR": [
                {
                  "content": {
                    "contains": "beta",
                    "mode": "insensitive",
                  },
                },
                {
                  "contentTokens": {
                    "contains": "beta",
                    "mode": "insensitive",
                  },
                },
              ],
            },
            {
              "createdAt": {
                "gte": 2025-01-01T00:00:00.000Z,
                "lte": 2025-01-31T00:00:00.000Z,
              },
            },
            {
              "isPinned": true,
            },
          ],
        }
      `)
    })
  })
})
