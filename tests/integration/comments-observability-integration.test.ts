/**
 * 评论 API 可观测性集成测试
 * 验证 API 调用时日志和指标的正确记录
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest"
import { commentsMetrics } from "@/lib/metrics/comments-metrics"
import { createMockRequest } from "../helpers/test-utils"
import { GET, POST } from "@/app/api/comments/route"
import { DELETE } from "@/app/api/comments/[id]/route"

// Mock 认证
vi.mock("@/lib/api/unified-auth", () => ({
  withApiAuth: (req: any, role: string, handler: any) => {
    return handler({ id: "test-user", role: "USER" })
  },
  getCurrentUser: () => ({ id: "test-user", role: "USER" }),
  createAuditLog: vi.fn(),
}))

// Mock 交互服务
vi.mock("@/lib/interactions", () => ({
  listComments: vi.fn().mockResolvedValue({
    comments: [
      { id: "1", content: "Test comment 1" },
      { id: "2", content: "Test comment 2" },
    ],
    hasMore: false,
    nextCursor: null,
    totalCount: 2,
  }),
  createComment: vi.fn().mockResolvedValue({
    id: "new-comment",
    content: "New test comment",
    authorId: "test-user",
  }),
  deleteComment: vi.fn().mockResolvedValue(true),
}))

// Mock 限流
vi.mock("@/lib/rate-limit/comment-limits", () => ({
  checkCommentRate: vi.fn().mockResolvedValue({ allowed: true }),
  extractClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))

describe("Comments API Observability Integration", () => {
  let logSpy: any

  beforeAll(() => {
    // 设置环境变量
    process.env.NODE_ENV = "test"
  })

  beforeEach(() => {
    // 重置指标
    commentsMetrics.reset()

    // Mock console
    logSpy = {
      info: vi.spyOn(console, "info").mockImplementation(() => {}),
      error: vi.spyOn(console, "error").mockImplementation(() => {}),
      debug: vi.spyOn(console, "debug").mockImplementation(() => {}),
    }
  })

  afterAll(() => {
    vi.restoreAllMocks()
  })

  describe("GET /api/comments", () => {
    it("应该记录列表操作的日志和指标", async () => {
      const request = createMockRequest("GET", "/api/comments", {
        searchParams: {
          targetType: "post",
          targetId: "123",
          limit: "10",
        },
      })

      const response = await GET(request)
      const data = await response.json()

      // 验证响应
      expect(response.status).toBe(200)
      expect(data.data).toHaveLength(2)

      // 验证指标
      expect(commentsMetrics.getCounter("list", "success")).toBe(1)
      expect(commentsMetrics.getCounter("list", "failure")).toBe(0)

      // 验证时延记录
      const latency = commentsMetrics.getAverageLatency("list")
      expect(latency).toBeGreaterThan(0)

      // 验证日志
      expect(logSpy.debug).toHaveBeenCalledWith(
        expect.stringContaining("Starting comment list operation"),
        expect.objectContaining({
          targetType: "post",
          targetId: "123",
          limit: 10,
        })
      )

      expect(logSpy.info).toHaveBeenCalledWith(
        expect.stringContaining("Comment list: success"),
        expect.objectContaining({
          operation: "list",
          actor: "anonymous",
          target: "post:123",
          status: "success",
          resultCount: 2,
          hasMore: false,
        })
      )
    })

    it("应该记录失败的列表操作", async () => {
      const request = createMockRequest("GET", "/api/comments", {
        searchParams: {
          targetType: "invalid",
          targetId: "123",
        },
      })

      const response = await GET(request)

      // 验证响应
      expect(response.status).toBe(400)

      // 验证指标
      expect(commentsMetrics.getCounter("list", "failure")).toBe(1)
      expect(commentsMetrics.getCounter("list", "success")).toBe(0)

      // 验证日志
      expect(logSpy.error).toHaveBeenCalledWith(
        expect.stringContaining("Comment list: failure"),
        expect.objectContaining({
          operation: "list",
          status: "failure",
        })
      )
    })
  })

  describe("POST /api/comments", () => {
    it("应该记录创建操作的日志和指标", async () => {
      const request = createMockRequest("POST", "/api/comments", {
        body: {
          targetType: "post",
          targetId: "456",
          content: "Test comment content",
        },
      })

      const response = await POST(request)
      const data = await response.json()

      // 验证响应
      expect(response.status).toBe(200)
      expect(data.data.id).toBe("new-comment")

      // 验证指标
      expect(commentsMetrics.getCounter("create", "success")).toBe(1)
      expect(commentsMetrics.getCounter("create", "failure")).toBe(0)

      // 验证时延记录
      const latency = commentsMetrics.getAverageLatency("create")
      expect(latency).toBeGreaterThan(0)

      // 验证日志
      expect(logSpy.debug).toHaveBeenCalledWith(
        expect.stringContaining("Starting comment create operation"),
        expect.objectContaining({
          userId: "test-user",
          targetType: "post",
          targetId: "456",
          contentLength: 20,
        })
      )

      expect(logSpy.info).toHaveBeenCalledWith(
        expect.stringContaining("Comment create: success"),
        expect.objectContaining({
          operation: "create",
          actor: "test-user",
          target: "post:456",
          status: "success",
          commentId: "new-comment",
        })
      )
    })
  })

  describe("DELETE /api/comments/[id]", () => {
    it("应该记录删除操作的日志和指标", async () => {
      const request = createMockRequest("DELETE", "/api/comments/789")

      const response = await DELETE(request, { params: { id: "789" } })
      const data = await response.json()

      // 验证响应
      expect(response.status).toBe(200)
      expect(data.data.deleted).toBe(true)

      // 验证指标
      expect(commentsMetrics.getCounter("delete", "success")).toBe(1)
      expect(commentsMetrics.getCounter("delete", "failure")).toBe(0)

      // 验证时延记录
      const latency = commentsMetrics.getAverageLatency("delete")
      expect(latency).toBeGreaterThan(0)

      // 验证日志
      expect(logSpy.debug).toHaveBeenCalledWith(
        expect.stringContaining("Starting comment delete operation"),
        expect.objectContaining({
          userId: "test-user",
          commentId: "789",
        })
      )

      expect(logSpy.info).toHaveBeenCalledWith(
        expect.stringContaining("Comment delete: success"),
        expect.objectContaining({
          operation: "delete",
          actor: "test-user",
          target: "comment:789",
          status: "success",
          isAdmin: false,
        })
      )
    })
  })

  describe("Metrics Accumulation", () => {
    it("应该正确累计多个操作的指标", async () => {
      // 执行多个操作
      const requests = [
        createMockRequest("GET", "/api/comments", {
          searchParams: { targetType: "post", targetId: "1" },
        }),
        createMockRequest("GET", "/api/comments", {
          searchParams: { targetType: "post", targetId: "2" },
        }),
        createMockRequest("GET", "/api/comments", {
          searchParams: { targetType: "activity", targetId: "3" },
        }),
      ]

      // 并行执行
      await Promise.all(requests.map((req) => GET(req)))

      // 验证累计指标
      expect(commentsMetrics.getCounter("list", "success")).toBe(3)

      // 验证 QPS 计算
      const qps = commentsMetrics.getQPS("list")
      expect(qps).toBeGreaterThan(0)

      // 验证时延分布
      const p50 = commentsMetrics.getP50("list")
      const p95 = commentsMetrics.getP95("list")
      expect(p50).toBeGreaterThan(0)
      expect(p95).toBeGreaterThanOrEqual(p50!)
    })
  })

  describe("Error Scenarios", () => {
    it("应该记录验证错误", async () => {
      const request = createMockRequest("POST", "/api/comments", {
        body: {
          targetType: "post",
          // 缺少 targetId 和 content
        },
      })

      const response = await POST(request)

      expect(response.status).toBe(400)
      expect(commentsMetrics.getCounter("create", "failure")).toBe(1)

      // 验证错误日志
      expect(logSpy.error).toHaveBeenCalledWith(
        expect.stringContaining("Comment create: failure"),
        expect.objectContaining({
          status: "failure",
        })
      )
    })
  })

  describe("Summary Report", () => {
    it("应该生成完整的摘要报告", async () => {
      // 执行一些操作
      await GET(
        createMockRequest("GET", "/api/comments", {
          searchParams: { targetType: "post", targetId: "1" },
        })
      )

      await POST(
        createMockRequest("POST", "/api/comments", {
          body: { targetType: "post", targetId: "2", content: "Test" },
        })
      )

      await DELETE(createMockRequest("DELETE", "/api/comments/3"), { params: { id: "3" } })

      // 获取摘要
      const summary = commentsMetrics.getSummary()

      // 验证摘要结构
      expect(summary.counters.list.success).toBe(1)
      expect(summary.counters.create.success).toBe(1)
      expect(summary.counters.delete.success).toBe(1)

      expect(summary.qps.list).toBeGreaterThan(0)
      expect(summary.qps.create).toBeGreaterThan(0)
      expect(summary.qps.delete).toBeGreaterThan(0)

      expect(summary.latencies.list).toBeDefined()
      expect(summary.latencies.create).toBeDefined()
      expect(summary.latencies.delete).toBeDefined()
    })
  })
})
