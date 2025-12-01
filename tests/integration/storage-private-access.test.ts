import { describe, it, expect, beforeEach, vi } from "vitest"
import { signAvatarUrl, signActivityListItem, resetSignedUrlCache } from "@/lib/storage/signed-url"
import { createServiceRoleClient } from "@/lib/supabase"
import { Role, UserStatus } from "@/lib/generated/prisma"

describe("Storage 私有化与签名 URL", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetSignedUrlCache()
  })

  it("头像路径生成 1 小时签名 URL，并使用 service_role", async () => {
    const path = "avatars/user-123/avatar.png"

    const signed = await signAvatarUrl(path)

    const client = vi.mocked(createServiceRoleClient)
    expect(client).toHaveBeenCalledTimes(1)

    const storage = client.mock.results[0].value.storage
    expect(storage.from).toHaveBeenCalledWith("activity-images")

    const createSignedUrlMock = storage.from.mock.results[0].value.createSignedUrl
    expect(createSignedUrlMock).toHaveBeenCalledWith(path, 60 * 60)

    expect(signed).toContain("signed")
    expect(signed).toContain(path)
  })

  it("动态媒体与作者头像均使用签名 URL，非 Supabase 链接保持不变", async () => {
    const item = {
      id: "act-1",
      authorId: "user-1",
      content: "hello",
      imageUrls: ["activities/user-1/photo.png", "https://example.com/keep.png"],
      isPinned: false,
      likesCount: 0,
      commentsCount: 0,
      viewsCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: {
        id: "user-1",
        name: "Tester",
        email: "tester@example.com",
        avatarUrl: "avatars/user-1/avatar.png",
        role: Role.USER,
        status: UserStatus.ACTIVE,
      },
    }

    const signedItem = await signActivityListItem(item)

    expect(signedItem.imageUrls[0]).toContain("signed/activities/user-1/photo.png")
    expect(signedItem.imageUrls[1]).toBe("https://example.com/keep.png")
    expect(signedItem.author.avatarUrl).toContain("signed/avatars/user-1/avatar.png")
  })
})
