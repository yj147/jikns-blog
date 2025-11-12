import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

const hoistedMocks = vi.hoisted(() => ({
  mockFetchAuthenticatedUser: vi.fn(),
  mockAssertPolicy: vi.fn(),
  mockGenerateRequestId: vi.fn(() => "req-comments-contract"),
}))

vi.mock("@/lib/auth/session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/session")>("@/lib/auth/session")

  return {
    ...actual,
    fetchAuthenticatedUser: hoistedMocks.mockFetchAuthenticatedUser,
    assertPolicy: hoistedMocks.mockAssertPolicy,
    generateRequestId: hoistedMocks.mockGenerateRequestId,
  }
})

vi.mock("@/lib/interactions", () => ({
  listComments: vi.fn(),
  createComment: vi.fn(),
  deleteComment: vi.fn(),
}))

vi.mock("@/lib/rate-limit/comment-limits", () => ({
  checkCommentRate: vi.fn().mockResolvedValue({ allowed: true }),
  extractClientIP: vi.fn(() => "127.0.0.1"),
}))

import { GET as getComments, POST as createCommentHandler } from "@/app/api/comments/route"
import { listComments, createComment } from "@/lib/interactions"

const { mockFetchAuthenticatedUser, mockAssertPolicy } = hoistedMocks

const POST_ID = "c123456789012345678901234"
const USER_ID = "c423456789012345678901234"

describe("comments API contract", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchAuthenticatedUser.mockResolvedValue(null)
    mockAssertPolicy.mockResolvedValue([
      {
        id: USER_ID,
        email: "user@example.com",
        role: "USER",
        status: "ACTIVE",
        name: "Contract User",
      } as any,
      null,
    ])
  })

  it("normalizes list responses and surfaces childrenCount", async () => {
    vi.mocked(listComments).mockResolvedValue({
      comments: [
        {
          id: "c900000000000000000000001",
          content: "content",
          authorId: USER_ID,
          targetType: "post" as const,
          targetId: POST_ID,
          postId: POST_ID,
          activityId: null,
          parentId: null,
          isDeleted: false,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          author: {
            id: USER_ID,
            name: "Contract User",
            email: "user@example.com",
            avatarUrl: null,
            role: "USER" as const,
          },
          _count: { replies: 2 },
        },
      ],
      hasMore: false,
      nextCursor: null,
    })

    const request = new NextRequest(
      `http://localhost:3000/api/comments?targetType=post&targetId=${POST_ID}`
    )

    const response = await getComments(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data[0].childrenCount).toBe(2)
    expect(body.data[0]._count.replies).toBe(2)
  })

  it("fills default childrenCount on create", async () => {
    vi.mocked(createComment).mockResolvedValue({
      id: "c900000000000000000000002",
      content: "new comment",
      authorId: USER_ID,
      targetType: "post",
      targetId: POST_ID,
      postId: POST_ID,
      activityId: null,
      parentId: null,
      isDeleted: false,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      author: {
        id: USER_ID,
        name: "Contract User",
        email: "user@example.com",
        avatarUrl: null,
        role: "USER",
      },
    } as any)

    const request = new NextRequest("http://localhost:3000/api/comments", {
      method: "POST",
      body: JSON.stringify({
        content: "new comment",
        targetType: "post",
        targetId: POST_ID,
      }),
    })

    const response = await createCommentHandler(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.childrenCount).toBe(0)
    expect(body.data._count.replies).toBe(0)
  })
})
