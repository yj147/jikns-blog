import { describe, expect, it } from "vitest"

import { activityUpdateSchema } from "@/types/activity"

describe("activityUpdateSchema", () => {
  it("允许更新内容及 HTTPS 图片地址", () => {
    const result = activityUpdateSchema.safeParse({
      content: "修改后的动态内容",
      imageUrls: ["https://cdn.example.com/image-1.jpg", "https://cdn.example.com/image-2.png"],
      isPinned: true,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.imageUrls).toHaveLength(2)
    }
  })

  it("支持清空图片列表", () => {
    const result = activityUpdateSchema.safeParse({
      content: "移除图片",
      imageUrls: [],
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.imageUrls).toEqual([])
    }
  })

  it("拒绝非 HTTPS 图片地址", () => {
    const result = activityUpdateSchema.safeParse({
      content: "无效图片",
      imageUrls: ["http://example.com/unsafe.jpg"],
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("HTTPS")
    }
  })
})
