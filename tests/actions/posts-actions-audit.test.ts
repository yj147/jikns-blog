import { describe, it, expect, beforeEach, vi } from "vitest"

const requireAdminMock = vi.fn()
const logEventMock = vi.fn()
const syncPostTagsMock = vi.fn()
const recalculateTagCountsMock = vi.fn()

vi.mock("@/lib/auth", () => ({
  requireAdmin: () => requireAdminMock(),
}))

const postMock = {
  findUnique: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
  findFirst: vi.fn(),
  delete: vi.fn(),
  deleteMany: vi.fn(),
  create: vi.fn(),
}

const postTagMock = {
  findMany: vi.fn(),
  deleteMany: vi.fn(),
  createMany: vi.fn(),
  count: vi.fn(),
}

const tagMock = {
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}

const prismaMock = {
  post: postMock,
  postTag: postTagMock,
  tag: tagMock,
  $transaction: vi.fn(async (callback: any) => callback(prismaMock)),
}

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}))

vi.mock("@/lib/repos/tag-repo", () => ({
  syncPostTags: (...args: any[]) => syncPostTagsMock(...args),
  recalculateTagCounts: (...args: any[]) => recalculateTagCountsMock(...args),
}))

vi.mock("@/lib/audit-log", () => ({
  auditLogger: {
    logEvent: logEventMock,
  },
  AuditEventType: {
    ADMIN_ACTION: "ADMIN_ACTION",
  },
}))

vi.mock("@/lib/server-context", () => ({
  getServerContext: () => ({
    requestId: "req-test",
    ipAddress: "127.0.0.1",
    userAgent: "vitest",
  }),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

describe("Posts Server Actions 错误分类与审计", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAdminMock.mockResolvedValue({ id: "admin-1" })
    ;[
      postMock.findUnique,
      postMock.findMany,
      postMock.update,
      postMock.findFirst,
      postMock.delete,
      postMock.deleteMany,
      postMock.create,
      postTagMock.findMany,
      postTagMock.deleteMany,
      postTagMock.createMany,
      postTagMock.count,
      tagMock.findMany,
      tagMock.create,
      tagMock.update,
    ].forEach((fn) => fn.mockReset())
    logEventMock.mockReset()
    syncPostTagsMock.mockReset()
    recalculateTagCountsMock.mockReset()
    prismaMock.$transaction.mockImplementation(async (callback: any) => callback(prismaMock))
    logEventMock.mockResolvedValue(undefined)
    syncPostTagsMock.mockResolvedValue({ tagIds: [] })
    recalculateTagCountsMock.mockResolvedValue(undefined)
  })

  it("createPost 应返回校验错误并记录审计日志", async () => {
    const { createPost } = await import("@/lib/actions/posts")

    const result = await createPost({
      title: "ab",
      content: "有效内容至少十个字符",
    } as any)

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe("VALIDATION_ERROR")

    expect(logEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "POST_CREATE",
        success: false,
        details: expect.objectContaining({ errorCode: "VALIDATION_ERROR" }),
        requestId: "req-test",
      })
    )
  })

  it("createPost 应使用自定义 slug 并返回成功响应", async () => {
    const { createPost } = await import("@/lib/actions/posts")
    const customSlug = "custom-slug"

    postMock.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: "post-1",
      slug: customSlug,
      title: "测试文章",
      content: "有效内容至少十个字符",
      excerpt: null,
      published: false,
      isPinned: false,
      canonicalUrl: null,
      seoTitle: null,
      seoDescription: null,
      coverImage: null,
      viewCount: 0,
      createdAt: new Date("2025-01-01T00:00:00Z"),
      updatedAt: new Date("2025-01-01T00:00:00Z"),
      publishedAt: null,
      authorId: "admin-1",
      seriesId: null,
      author: { id: "admin-1", name: "Admin", avatarUrl: null, bio: null },
      series: null,
      tags: [],
      _count: { comments: 0, likes: 0, bookmarks: 0 },
    })

    postMock.create.mockResolvedValue({
      id: "post-1",
    })

    const result = await createPost({
      title: "测试文章",
      content: "有效内容至少十个字符",
      slug: customSlug,
    })

    expect(result.success).toBe(true)
    expect(result.data?.slug).toBe(customSlug)
    expect(postMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ slug: customSlug }),
      })
    )
  })

  it("createPost 自定义 slug 冲突时返回 CONFLICT", async () => {
    const { createPost } = await import("@/lib/actions/posts")
    const customSlug = "duplicate-slug"

    postMock.findUnique.mockResolvedValueOnce({ id: "existing-post" })

    const result = await createPost({
      title: "冲突文章",
      content: "有效内容至少十个字符",
      slug: customSlug,
    })

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe("CONFLICT")
  })

  it("publishPost 找不到文章时返回 NOT_FOUND 并记录失败审计", async () => {
    const { publishPost } = await import("@/lib/actions/posts")
    const { prisma } = await import("@/lib/prisma")

    vi.mocked(prisma.post.findUnique).mockResolvedValueOnce(null)

    const result = await publishPost("missing-post")

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe("NOT_FOUND")
    expect(logEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "POST_PUBLISH",
        success: false,
        details: expect.objectContaining({ errorCode: "NOT_FOUND" }),
      })
    )
  })

  it("publishPost 成功时应记录成功审计事件", async () => {
    const { publishPost } = await import("@/lib/actions/posts")
    const { prisma } = await import("@/lib/prisma")

    // 第一次 findUnique: getPostOrThrow 调用
    vi.mocked(prisma.post.findUnique).mockResolvedValueOnce({
      id: "post-1",
      slug: "hello",
      published: false,
      tags: [],
    } as any)

    vi.mocked(prisma.post.update).mockResolvedValueOnce({
      id: "post-1",
      slug: "hello",
      published: true,
      publishedAt: new Date("2025-09-20T00:00:00Z"),
    } as any)

    // 第二次 findUnique: fetchPostWithRelations 调用（事务后）
    vi.mocked(prisma.post.findUnique).mockResolvedValueOnce({
      id: "post-1",
      slug: "hello",
      published: true,
      publishedAt: new Date("2025-09-20T00:00:00Z"),
      tags: [],
    } as any)

    const result = await publishPost("post-1")

    expect(result.success).toBe(true)
    expect(result.data?.message).toBe("文章发布成功")
    expect(logEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "POST_PUBLISH",
        success: true,
        userId: "admin-1",
        resource: "post-1",
      })
    )
  })

  it("updatePost 遇到 slug 冲突时返回 CONFLICT 并写入审计", async () => {
    const { updatePost } = await import("@/lib/actions/posts")
    const { prisma } = await import("@/lib/prisma")

    vi.mocked(prisma.post.findUnique).mockResolvedValueOnce({
      id: "post-1",
      slug: "original-slug",
      published: true,
      tags: [],
    } as any)

    vi.mocked(prisma.post.findFirst).mockResolvedValueOnce({ id: "post-2" } as any)

    const result = await updatePost({ id: "post-1", slug: "conflict-slug" })

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe("CONFLICT")
    expect(logEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "POST_UPDATE",
        success: false,
        details: expect.objectContaining({ errorCode: "CONFLICT" }),
      })
    )
  })

  it("deletePost 无权限时返回 FORBIDDEN 并记录审计", async () => {
    const { deletePost } = await import("@/lib/actions/posts")

    requireAdminMock.mockRejectedValueOnce(new Error("forbidden"))

    const result = await deletePost("post-3")

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe("FORBIDDEN")
    expect(logEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "POST_DELETE",
        success: false,
        details: expect.objectContaining({ errorCode: "FORBIDDEN" }),
      })
    )
  })

  describe("标签计数联动", () => {
    it("createPost 带标签时会同步标签并刷新缓存", async () => {
      const { createPost } = await import("@/lib/actions/posts")
      const { prisma } = await import("@/lib/prisma")
      const cache = await import("next/cache")

      const fullPost = {
        id: "post-100",
        slug: "post-100",
        title: "Valid Title",
        content: "Sufficient content length for testing.",
        excerpt: null,
        published: true,
        isPinned: false,
        canonicalUrl: null,
        seoTitle: null,
        seoDescription: null,
        coverImage: null,
        viewCount: 0,
        createdAt: new Date("2025-01-01T00:00:00Z"),
        updatedAt: new Date("2025-01-01T00:00:00Z"),
        publishedAt: new Date("2025-01-01T00:00:00Z"),
        author: { id: "admin-1", name: "Admin", avatarUrl: null, bio: null },
        series: null,
        tags: [
          {
            tag: { id: "tag-100", name: "Tech", slug: "tech", color: null },
          },
        ],
        _count: { comments: 0, likes: 0, bookmarks: 0 },
      }

      vi.mocked(prisma.post.findUnique)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(fullPost as any)

      vi.mocked(prisma.post.create).mockResolvedValueOnce({
        id: "post-100",
        slug: "post-100",
        published: true,
        authorId: "admin-1",
      } as any)

      syncPostTagsMock.mockResolvedValueOnce({ tagIds: ["tag-100"] })

      const result = await createPost({
        title: "Valid Title",
        content: "Sufficient content length for testing.",
        published: true,
        tagNames: ["Tech"],
      } as any)

      expect(result.success).toBe(true)
      expect(syncPostTagsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          postId: "post-100",
          newTagNames: ["Tech"],
        })
      )
      expect(cache.revalidateTag).toHaveBeenCalledWith("tags:list")
      expect(cache.revalidateTag).toHaveBeenCalledWith("tags:detail")
      expect(logEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "POST_CREATE",
          success: true,
          resource: "post-100",
        })
      )
    })

    it("updatePost 发布状态变化时会重算相关标签计数", async () => {
      const { updatePost } = await import("@/lib/actions/posts")
      const { prisma } = await import("@/lib/prisma")

      const existingPost = {
        id: "post-1",
        slug: "draft-post",
        published: false,
        tags: [
          {
            postId: "post-1",
            tagId: "tag-1",
            tag: { id: "tag-1", name: "Tag 1", slug: "tag-1", color: null },
          },
        ],
      }

      const updatedPost = {
        ...existingPost,
        title: "New Title",
        content: "Updated content with enough length",
        excerpt: null,
        published: true,
        isPinned: false,
        canonicalUrl: null,
        seoTitle: null,
        seoDescription: null,
        coverImage: null,
        viewCount: 0,
        createdAt: new Date("2025-01-01T00:00:00Z"),
        updatedAt: new Date("2025-01-01T00:00:00Z"),
        publishedAt: new Date("2025-01-02T00:00:00Z"),
        author: { id: "admin-1", name: "Admin", avatarUrl: null, bio: null },
        series: null,
        tags: [
          {
            tag: { id: "tag-1", name: "Tag 1", slug: "tag-1", color: null },
          },
        ],
        _count: { comments: 0, likes: 0, bookmarks: 0 },
      }

      vi.mocked(prisma.post.findUnique)
        .mockResolvedValueOnce(existingPost as any)
        .mockResolvedValueOnce(updatedPost as any)
      vi.mocked(prisma.post.update).mockResolvedValueOnce({} as any)
      vi.mocked(prisma.postTag.findMany).mockResolvedValueOnce([{ tagId: "tag-1" }])

      recalculateTagCountsMock.mockResolvedValueOnce(undefined)

      const result = await updatePost({
        id: "post-1",
        title: "New Title",
        content: "Updated content with enough length",
        published: true,
      })

      expect(result.success).toBe(true)
      expect(recalculateTagCountsMock).toHaveBeenCalled()
      expect(recalculateTagCountsMock.mock.calls[0][1]).toEqual(["tag-1"])
      expect(logEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "POST_UPDATE",
          success: true,
          resource: "post-1",
        })
      )
    })

    it("deletePost 会在事务内重算被影响的标签计数", async () => {
      const { deletePost } = await import("@/lib/actions/posts")
      const { prisma } = await import("@/lib/prisma")

      const existingPost = {
        id: "post-2",
        slug: "to-delete",
        tags: [
          {
            postId: "post-2",
            tagId: "tag-9",
            tag: { id: "tag-9", name: "Legacy", slug: "legacy", color: null },
          },
        ],
      }

      vi.mocked(prisma.post.findUnique).mockResolvedValueOnce(existingPost as any)
      vi.mocked(prisma.post.delete).mockResolvedValueOnce({} as any)
      recalculateTagCountsMock.mockResolvedValueOnce(undefined)

      const result = await deletePost("post-2")

      expect(result.success).toBe(true)
      expect(recalculateTagCountsMock).toHaveBeenCalled()
      expect(recalculateTagCountsMock.mock.calls[0][1]).toEqual(["tag-9"])
      expect(logEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "POST_DELETE",
          success: true,
          resource: "post-2",
        })
      )
    })

    it("bulkDeletePosts 会对去重后的标签集合重算计数", async () => {
      const { bulkDeletePosts } = await import("@/lib/actions/posts")
      const { prisma } = await import("@/lib/prisma")

      vi.mocked(prisma.post.findMany).mockResolvedValueOnce([
        {
          id: "post-3",
          slug: "p3",
          tags: [
            {
              tagId: "tag-1",
              tag: { id: "tag-1", name: "Foo", slug: "foo", color: null },
            },
          ],
        },
        {
          id: "post-4",
          slug: "p4",
          tags: [
            {
              tagId: "tag-1",
              tag: { id: "tag-1", name: "Foo", slug: "foo", color: null },
            },
            {
              tagId: "tag-2",
              tag: { id: "tag-2", name: "Bar", slug: "bar", color: null },
            },
          ],
        },
      ] as any)

      vi.mocked(prisma.post.deleteMany).mockResolvedValueOnce({ count: 2 } as any)
      recalculateTagCountsMock.mockResolvedValueOnce(undefined)

      const result = await bulkDeletePosts(["post-3", "post-4"])

      expect(result.success).toBe(true)
      expect(recalculateTagCountsMock).toHaveBeenCalled()
      expect(new Set(recalculateTagCountsMock.mock.calls[0][1])).toEqual(
        new Set(["tag-1", "tag-2"])
      )
      expect(logEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "POST_BULK_DELETE",
          success: true,
          resource: "post-3,post-4",
        })
      )
    })

    it("publishPost 会针对关联标签重算计数", async () => {
      const { publishPost } = await import("@/lib/actions/posts")
      const { prisma } = await import("@/lib/prisma")

      vi.mocked(prisma.post.findUnique).mockResolvedValueOnce({
        id: "post-5",
        slug: "publish-me",
        published: false,
        tags: [{ tagId: "tag-7" }],
      } as any)

      vi.mocked(prisma.post.update).mockResolvedValueOnce({
        id: "post-5",
        slug: "publish-me",
        published: true,
        publishedAt: new Date("2025-03-01T00:00:00Z"),
      } as any)

      recalculateTagCountsMock.mockResolvedValueOnce(undefined)

      const result = await publishPost("post-5")

      expect(result.success).toBe(true)
      expect(recalculateTagCountsMock).toHaveBeenCalled()
      expect(recalculateTagCountsMock.mock.calls[0][1]).toEqual(["tag-7"])
      expect(logEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "POST_PUBLISH",
          success: true,
          resource: "post-5",
        })
      )
    })

    it("unpublishPost 会针对关联标签重算计数", async () => {
      const { unpublishPost } = await import("@/lib/actions/posts")
      const { prisma } = await import("@/lib/prisma")

      vi.mocked(prisma.post.findUnique).mockResolvedValueOnce({
        id: "post-6",
        slug: "unpublish-me",
        published: true,
        tags: [{ tagId: "tag-8" }],
      } as any)

      vi.mocked(prisma.post.update).mockResolvedValueOnce({
        id: "post-6",
        slug: "unpublish-me",
        published: false,
        publishedAt: null,
      } as any)

      recalculateTagCountsMock.mockResolvedValueOnce(undefined)

      const result = await unpublishPost("post-6")

      expect(result.success).toBe(true)
      expect(recalculateTagCountsMock).toHaveBeenCalled()
      expect(recalculateTagCountsMock.mock.calls[0][1]).toEqual(["tag-8"])
      expect(logEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "POST_UNPUBLISH",
          success: true,
          resource: "post-6",
        })
      )
    })
  })
})
