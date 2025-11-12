import { describe, expect, it } from "vitest"
import { activityCreateSchema } from "@/types/activity"

describe("activityCreateSchema imageUrls 安全验证", () => {
  it("允许HTTPS图片URL", () => {
    const result = activityCreateSchema.safeParse({
      content: "测试动态",
      imageUrls: ["https://cdn.example.com/image.jpg"],
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.imageUrls?.[0]).toBe("https://cdn.example.com/image.jpg")
    }
  })

  it("拒绝HTTP图片URL", () => {
    const result = activityCreateSchema.safeParse({
      content: "测试动态",
      imageUrls: ["http://insecure.example.com/image.jpg"],
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("图片URL必须使用HTTPS地址")
    }
  })

  it("拒绝javascript scheme，防止XSS", () => {
    const result = activityCreateSchema.safeParse({
      content: "测试动态",
      imageUrls: ["javascript:alert(1)"],
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("图片URL必须使用HTTPS地址")
    }
  })
})
