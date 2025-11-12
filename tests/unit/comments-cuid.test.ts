/**
 * 评论系统 CUID 支持测试
 * 验证评论 DTO 正确处理 CUID 格式的 ID
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  CreateCommentDto,
  ListCommentsDto,
  flexibleIdSchema,
  cuidSchema,
  validateCreateComment,
  validateListComments,
  safeParseCreateComment,
  safeParseListComments,
} from "@/lib/dto/comments.dto"

describe("Comments DTO CUID Support", () => {
  // 测试用的 CUID 和 UUID
  const validCuid = "cmfle0d6m0007jxub2lat5s9b"
  const validUuid = "123e4567-e89b-12d3-a456-426614174000"
  const invalidId = "invalid-id-format"

  describe("ID Schema Validation", () => {
    it("应该接受有效的 CUID", () => {
      const result = cuidSchema.safeParse(validCuid)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe(validCuid)
      }
    })

    it("应该拒绝无效的 CUID", () => {
      const invalidCuids = [
        "dmfle0d6m0007jxub2lat5s9b", // 不是以 'c' 开头
        "c", // 太短
        "c1234567890123456789012345", // 太长
        "C1234567890123456789012345", // 大写
        validUuid, // UUID 不是 CUID
      ]

      invalidCuids.forEach((id) => {
        const result = cuidSchema.safeParse(id)
        expect(result.success).toBe(false)
      })
    })

    it("flexibleIdSchema 应该同时接受 CUID 和 UUID", () => {
      const cuidResult = flexibleIdSchema.safeParse(validCuid)
      expect(cuidResult.success).toBe(true)

      const uuidResult = flexibleIdSchema.safeParse(validUuid)
      expect(uuidResult.success).toBe(true)
    })

    it("flexibleIdSchema 应该拒绝无效格式", () => {
      const result = flexibleIdSchema.safeParse(invalidId)
      expect(result.success).toBe(false)
    })
  })

  describe("CreateCommentDto with CUID", () => {
    it("应该接受使用 CUID 的创建评论请求", () => {
      const data = {
        content: "这是一条测试评论",
        targetType: "post",
        targetId: validCuid,
        parentId: validCuid,
      }

      const result = CreateCommentDto.safeParse(data)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.targetId).toBe(validCuid)
        expect(result.data.parentId).toBe(validCuid)
      }
    })

    it("应该接受混合使用 CUID 和 UUID 的请求", () => {
      const data = {
        content: "混合ID测试",
        targetType: "activity",
        targetId: validCuid,
        parentId: validUuid, // UUID
      }

      const result = CreateCommentDto.safeParse(data)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.targetId).toBe(validCuid)
        expect(result.data.parentId).toBe(validUuid)
      }
    })

    it("应该拒绝无效的 ID 格式", () => {
      const data = {
        content: "测试评论",
        targetType: "post",
        targetId: invalidId,
      }

      const result = CreateCommentDto.safeParse(data)
      expect(result.success).toBe(false)
    })

    it("validateCreateComment 函数应该正确处理 CUID", () => {
      const data = {
        content: "测试评论",
        targetType: "post" as const,
        targetId: validCuid,
      }

      const result = validateCreateComment(data)
      expect(result.targetId).toBe(validCuid)
    })

    it("safeParseCreateComment 函数应该返回正确的结果", () => {
      const validData = {
        content: "测试评论",
        targetType: "post" as const,
        targetId: validCuid,
      }

      const validResult = safeParseCreateComment(validData)
      expect(validResult.success).toBe(true)

      const invalidData = {
        content: "测试评论",
        targetType: "post" as const,
        targetId: invalidId,
      }

      const invalidResult = safeParseCreateComment(invalidData)
      expect(invalidResult.success).toBe(false)
    })
  })

  describe("ListCommentsDto with CUID", () => {
    it("应该接受使用 CUID 的查询参数", () => {
      const data = {
        targetType: "post",
        targetId: validCuid,
        parentId: validCuid,
        limit: 20,
      }

      const result = ListCommentsDto.safeParse(data)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.targetId).toBe(validCuid)
        expect(result.data.parentId).toBe(validCuid)
      }
    })

    it("应该接受省略可选字段的查询", () => {
      const data = {
        targetType: "activity",
        targetId: validCuid,
      }

      const result = ListCommentsDto.safeParse(data)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.targetId).toBe(validCuid)
        expect(result.data.limit).toBe(20) // 默认值
      }
    })

    it("应该处理分页游标", () => {
      const data = {
        targetType: "post",
        targetId: validCuid,
        cursor: validCuid, // 游标通常也是 CUID
        limit: 10,
      }

      const result = ListCommentsDto.safeParse(data)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.cursor).toBe(validCuid)
      }
    })

    it("validateListComments 函数应该正确处理 CUID", () => {
      const data = {
        targetType: "post" as const,
        targetId: validCuid,
      }

      const result = validateListComments(data)
      expect(result.targetId).toBe(validCuid)
      expect(result.limit).toBe(20)
    })
  })

  describe("Edge Cases", () => {
    it("应该正确处理 null 和 undefined", () => {
      const data = {
        content: "测试评论",
        targetType: "post",
        targetId: validCuid,
        parentId: null,
      }

      const result = CreateCommentDto.safeParse(data)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.parentId).toBeNull()
      }
    })

    it("应该验证内容长度限制", () => {
      const longContent = "a".repeat(1001) // 超过1000字符
      const data = {
        content: longContent,
        targetType: "post",
        targetId: validCuid,
      }

      const result = CreateCommentDto.safeParse(data)
      expect(result.success).toBe(false)
    })

    it("应该验证目标类型枚举", () => {
      const data = {
        content: "测试评论",
        targetType: "invalid" as any,
        targetId: validCuid,
      }

      const result = CreateCommentDto.safeParse(data)
      expect(result.success).toBe(false)
    })
  })

  describe("Real-world Scenarios", () => {
    it("应该处理实际的 Prisma 生成的 CUID", () => {
      // 这些是实际可能从 Prisma 生成的 CUID
      const realCuids = [
        "clh3x2d1m0000jxub9yz5a1b2",
        "clh3x2d1m0001jxub7yz5a1b3",
        "clh3x2d1m0002jxub8yz5a1b4",
      ]

      realCuids.forEach((cuid) => {
        const data = {
          content: "真实场景测试",
          targetType: "post" as const,
          targetId: cuid,
        }

        const result = CreateCommentDto.safeParse(data)
        expect(result.success).toBe(true)
      })
    })

    it("应该处理从 URL 查询参数解析的数据", () => {
      // 模拟从 URLSearchParams 获取的数据
      const params = new URLSearchParams({
        targetType: "post",
        targetId: validCuid,
        parentId: "",
        limit: "10",
      })

      const data = {
        targetType: params.get("targetType"),
        targetId: params.get("targetId") || "",
        parentId: params.get("parentId") || null,
        limit: parseInt(params.get("limit") || "20"),
      }

      const result = ListCommentsDto.safeParse(data)
      expect(result.success).toBe(true)
    })
  })
})
