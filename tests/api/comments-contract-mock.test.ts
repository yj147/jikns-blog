import { describe, it, expect } from "vitest"
import { CommentResponseDto } from "@/lib/dto/comments.dto"

const baseComment = {
  id: "c123456789012345678901234",
  content: "test",
  targetType: "post" as const,
  targetId: "c223456789012345678901234",
  parentId: null,
  authorId: "c323456789012345678901234",
  postId: "c223456789012345678901234",
  activityId: null,
  isDeleted: false,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe("CommentResponseDto", () => {
  it("defaults childrenCount when missing", () => {
    const result = CommentResponseDto.parse({
      ...baseComment,
    })

    expect(result.childrenCount).toBe(0)
    expect(result._count?.replies ?? 0).toBe(0)
  })

  it("parses nested replies recursively", () => {
    const result = CommentResponseDto.parse({
      ...baseComment,
      _count: { replies: 1 },
      childrenCount: 1,
      replies: [
        {
          ...baseComment,
          id: "c234567890123456789012345",
          parentId: "c123456789012345678901234",
          _count: { replies: 0 },
          childrenCount: 0,
        },
      ],
    })

    expect(result.childrenCount).toBe(1)
    expect(result.replies?.[0].parentId).toBe("c123456789012345678901234")
    expect(result.replies?.[0].childrenCount).toBe(0)
  })
})
