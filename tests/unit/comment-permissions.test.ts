import { describe, it, expect } from "vitest"
import { CommentPermissions, type CommentForPermission } from "@/lib/permissions/comment-permissions"
import type { AuthenticatedUser } from "@/lib/auth/session"
import { Role, UserStatus } from "@/lib/generated/prisma"

const viewer: AuthenticatedUser = {
  id: "viewer-1",
  email: "viewer@example.com",
  role: Role.USER,
  status: UserStatus.ACTIVE,
  name: "viewer",
  avatarUrl: null,
}

describe("CommentPermissions.canLike", () => {
  it("允许活跃用户点赞他人评论", () => {
    const comment: CommentForPermission = {
      id: "c1",
      authorId: "author-1",
      deletedAt: null,
      authorStatus: UserStatus.ACTIVE,
    }

    expect(CommentPermissions.canLike(viewer, comment)).toBe(true)
  })

  it("拒绝自赞评论", () => {
    const comment: CommentForPermission = {
      id: "c1",
      authorId: viewer.id,
      deletedAt: null,
      authorStatus: UserStatus.ACTIVE,
    }

    expect(CommentPermissions.canLike(viewer, comment)).toBe(false)
  })

  it("拒绝点赞被封禁作者的评论", () => {
    const comment: CommentForPermission = {
      id: "c1",
      authorId: "author-1",
      deletedAt: null,
      authorStatus: UserStatus.BANNED,
    }

    expect(CommentPermissions.canLike(viewer, comment)).toBe(false)
  })

  it("拒绝点赞已删除评论", () => {
    const comment: CommentForPermission = {
      id: "c1",
      authorId: "author-1",
      deletedAt: new Date(),
      authorStatus: UserStatus.ACTIVE,
    }

    expect(CommentPermissions.canLike(viewer, comment)).toBe(false)
  })
})
