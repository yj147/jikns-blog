import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { ErrorCode } from "@/lib/api/unified-response"
import { GET as listTags, POST as createTagHandler } from "@/app/api/tags/route"
import {
  GET as getTagHandler,
  PATCH as updateTagHandler,
  DELETE as deleteTagHandler,
} from "@/app/api/tags/[tagId]/route"
import { getTags, createTag, getTag, updateTag, deleteTag } from "@/lib/actions/tags"

vi.mock("@/lib/actions/tags", () => ({
  getTags: vi.fn(),
  createTag: vi.fn(),
  getTag: vi.fn(),
  updateTag: vi.fn(),
  deleteTag: vi.fn(),
}))

const rateLimitMocks = vi.hoisted(() => ({
  enforce: vi.fn(),
}))

const authSessionMocks = vi.hoisted(() => ({
  getOptionalViewer: vi.fn(),
}))

vi.mock("@/lib/rate-limit/tag-limits", () => ({
  enforceTagRateLimitForRequest: (...args: Parameters<typeof rateLimitMocks.enforce>) =>
    rateLimitMocks.enforce(...args),
}))

vi.mock("@/lib/auth/session", () => ({
  getOptionalViewer: (...args: Parameters<typeof authSessionMocks.getOptionalViewer>) =>
    authSessionMocks.getOptionalViewer(...args),
}))

function createJsonRequest(url: string, method: string, body?: any) {
  return new NextRequest(url, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  })
}

describe("tags API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rateLimitMocks.enforce.mockResolvedValue({ allowed: true })
    authSessionMocks.getOptionalViewer.mockResolvedValue(null)
  })

  it("GET /api/tags 应该传递分页与排序参数", async () => {
    vi.mocked(getTags).mockResolvedValue({
      success: true,
      data: {
        tags: [],
        pagination: { page: 2, limit: 5, total: 0, totalPages: 0 },
      },
      meta: { timestamp: new Date().toISOString() },
    })

    const request = new NextRequest(
      "http://localhost:3000/api/tags?page=2&limit=5&orderBy=name&order=asc&search=js"
    )
    const response = await listTags(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(getTags).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        limit: 5,
        orderBy: "name",
        order: "asc",
        search: "js",
      })
    )
    expect(rateLimitMocks.enforce).toHaveBeenCalledWith(
      "search",
      expect.any(NextRequest),
      undefined
    )
  })

  it("GET /api/tags 应该映射验证错误为 400", async () => {
    vi.mocked(getTags).mockResolvedValue({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "参数错误" },
    })

    const request = new NextRequest("http://localhost:3000/api/tags?page=-1")
    const response = await listTags(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error.code).toBe("VALIDATION_ERROR")
  })

  it("GET /api/tags 命中限流时返回 429", async () => {
    const error = new Error("请求过于频繁") as any
    error.statusCode = 429
    error.retryAfter = 30
    rateLimitMocks.enforce.mockRejectedValue(error)

    const request = new NextRequest("http://localhost:3000/api/tags")
    const response = await listTags(request)
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body.error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED)
    expect(body.error.details.retryAfter).toBe(30)
  })

  it("GET /api/tags 遇到封禁错误时返回 403", async () => {
    vi.mocked(getTags).mockResolvedValue({
      success: false,
      error: { code: "ACCOUNT_BANNED", message: "账号已被封禁" },
    })

    const request = new NextRequest("http://localhost:3000/api/tags")
    const response = await listTags(request)
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error.code).toBe(ErrorCode.ACCOUNT_BANNED)
  })

  it("POST /api/tags 应该创建标签并返回 201", async () => {
    const tag = {
      id: "tag-1",
      name: "JavaScript",
      slug: "javascript",
      description: "JS",
      color: "#f7df1e",
      postsCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    vi.mocked(createTag).mockResolvedValue({
      success: true,
      data: { tag },
      meta: { timestamp: new Date().toISOString() },
    })

    const request = createJsonRequest("http://localhost:3000/api/tags", "POST", {
      name: "JavaScript",
      description: "JS",
      color: "#f7df1e",
    })

    const response = await createTagHandler(request)
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.success).toBe(true)
    expect(body.data.tag.name).toBe("JavaScript")
    expect(createTag).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "JavaScript",
        description: "JS",
        color: "#f7df1e",
      })
    )
    expect(rateLimitMocks.enforce).toHaveBeenCalledWith(
      "mutation",
      expect.any(NextRequest),
      undefined
    )
  })

  it("POST /api/tags 命中限流时返回 429", async () => {
    const error = new Error("操作过于频繁") as any
    error.statusCode = 429
    error.retryAfter = 45
    rateLimitMocks.enforce.mockRejectedValue(error)

    const request = createJsonRequest("http://localhost:3000/api/tags", "POST", {
      name: "Rust",
    })

    const response = await createTagHandler(request)
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body.error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED)
    expect(createTag).not.toHaveBeenCalled()
  })

  it("POST /api/tags 遇到无效 JSON 时返回 400", async () => {
    const request = new NextRequest("http://localhost:3000/api/tags", {
      method: "POST",
      body: "not-json",
      headers: { "content-type": "application/json" },
    })

    const response = await createTagHandler(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error.code).toBe(ErrorCode.INVALID_PARAMETERS)
  })

  it("POST /api/tags 权限不足应返回 403", async () => {
    vi.mocked(createTag).mockResolvedValue({
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "需要管理员权限",
        details: { statusCode: 403 },
      },
    })

    const request = createJsonRequest("http://localhost:3000/api/tags", "POST", {
      name: "Tag",
    })

    const response = await createTagHandler(request)
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error.code).toBe("FORBIDDEN")
  })

  it("GET /api/tags/[tagId] 应该返回指定标签", async () => {
    vi.mocked(getTag).mockResolvedValue({
      success: true,
      data: {
        tag: {
          id: "tag-1",
          name: "JavaScript",
          slug: "javascript",
          description: "JS",
          color: "#f7df1e",
          postsCount: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      meta: { timestamp: new Date().toISOString() },
    })

    const response = await getTagHandler(new NextRequest("http://localhost:3000/api/tags/tag-1"), {
      params: { tagId: "tag-1" },
    })

    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.tag.id).toBe("tag-1")
  })

  it("GET /api/tags/[tagId] 未找到标签返回 404", async () => {
    vi.mocked(getTag).mockResolvedValue({
      success: false,
      error: { code: "NOT_FOUND", message: "标签不存在" },
    })

    const response = await getTagHandler(
      new NextRequest("http://localhost:3000/api/tags/missing"),
      { params: { tagId: "missing" } }
    )
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error.code).toBe("NOT_FOUND")
  })

  it("PATCH /api/tags/[tagId] 应该传递可空字段", async () => {
    vi.mocked(updateTag).mockResolvedValue({
      success: true,
      data: {
        tag: {
          id: "tag-1",
          name: "JavaScript",
          slug: "javascript",
          description: null,
          color: null,
          postsCount: 2,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      meta: { timestamp: new Date().toISOString() },
    })

    const request = createJsonRequest("http://localhost:3000/api/tags/tag-1", "PATCH", {
      description: null,
      color: "#f7df1e",
    })

    const response = await updateTagHandler(request, { params: { tagId: "tag-1" } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.tag.description).toBeNull()
    expect(updateTag).toHaveBeenCalledWith("tag-1", {
      description: null,
      color: "#f7df1e",
    })
    expect(rateLimitMocks.enforce).toHaveBeenCalledWith(
      "mutation",
      expect.any(NextRequest),
      undefined
    )
  })

  it("PATCH /api/tags/[tagId] 命中限流时返回 429", async () => {
    const error = new Error("过于频繁") as any
    error.statusCode = 429
    error.retryAfter = 12
    rateLimitMocks.enforce.mockRejectedValue(error)

    const request = createJsonRequest("http://localhost:3000/api/tags/tag-1", "PATCH", {
      description: "Updated",
    })

    const response = await updateTagHandler(request, { params: { tagId: "tag-1" } })
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body.error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED)
    expect(updateTag).not.toHaveBeenCalled()
  })

  it("PATCH /api/tags/[tagId] 无效 JSON 返回 400", async () => {
    const request = new NextRequest("http://localhost:3000/api/tags/tag-1", {
      method: "PATCH",
      body: "invalid",
      headers: { "content-type": "application/json" },
    })

    const response = await updateTagHandler(request, { params: { tagId: "tag-1" } })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error.code).toBe(ErrorCode.INVALID_PARAMETERS)
  })

  it("DELETE /api/tags/[tagId] 应该删除标签", async () => {
    vi.mocked(deleteTag).mockResolvedValue({
      success: true,
      data: { message: "删除成功" },
      meta: { timestamp: new Date().toISOString() },
    })

    const response = await deleteTagHandler(
      new NextRequest("http://localhost:3000/api/tags/tag-1", { method: "DELETE" }),
      { params: { tagId: "tag-1" } }
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.message).toContain("删除")
    expect(deleteTag).toHaveBeenCalledWith("tag-1")
    expect(rateLimitMocks.enforce).toHaveBeenCalledWith(
      "mutation",
      expect.any(NextRequest),
      undefined
    )
  })

  it("DELETE /api/tags/[tagId] 命中限流时返回 429", async () => {
    const error = new Error("删除过于频繁") as any
    error.statusCode = 429
    rateLimitMocks.enforce.mockRejectedValue(error)

    const response = await deleteTagHandler(
      new NextRequest("http://localhost:3000/api/tags/tag-1", { method: "DELETE" }),
      { params: { tagId: "tag-1" } }
    )
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body.error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED)
    expect(deleteTag).not.toHaveBeenCalled()
  })

  it("DELETE /api/tags/[tagId] 未找到返回 404", async () => {
    vi.mocked(deleteTag).mockResolvedValue({
      success: false,
      error: { code: "NOT_FOUND", message: "标签不存在" },
    })

    const response = await deleteTagHandler(
      new NextRequest("http://localhost:3000/api/tags/missing", { method: "DELETE" }),
      { params: { tagId: "missing" } }
    )
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error.code).toBe("NOT_FOUND")
  })
})
