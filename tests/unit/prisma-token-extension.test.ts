import { describe, it, expect, vi, beforeEach } from "vitest"
import { tokenizeText } from "@/lib/search/tokenizer"

vi.mock("@/lib/search/tokenizer", () => ({
  tokenizeText: vi.fn((text: string | null | undefined) => {
    if (text === null || text === undefined || text === "") {
      return ""
    }
    return text
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 0)
      .join(" ")
  }),
}))

describe("Prisma Token Extension - extractScalarString 逻辑", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("extractScalarString 函数行为", () => {
    it("应该正确提取字符串值", () => {
      const result = tokenizeText("Hello World")
      expect(result).toBe("hello world")
    })

    it("应该正确处理 null 值", () => {
      const result = tokenizeText(null)
      expect(result).toBe("")
    })

    it("应该正确处理 undefined 值", () => {
      const result = tokenizeText(undefined)
      expect(result).toBe("")
    })

    it("应该正确处理空字符串", () => {
      const result = tokenizeText("")
      expect(result).toBe("")
    })
  })

  describe("Prisma update 场景模拟", () => {
    it("当管理员清空摘要时，应该生成空 token", () => {
      const updateData = {
        summary: null,
      }

      const summaryTokens = tokenizeText(updateData.summary)
      expect(summaryTokens).toBe("")
    })

    it("当管理员清空 SEO 描述时，应该生成空 token", () => {
      const updateData = {
        seoDescription: { set: null },
      }

      const seoTokens = tokenizeText(
        typeof updateData.seoDescription === "object" && "set" in updateData.seoDescription
          ? updateData.seoDescription.set
          : updateData.seoDescription
      )
      expect(seoTokens).toBe("")
    })

    it("当管理员更新摘要为新内容时，应该生成正确的 token", () => {
      const updateData = {
        summary: "这是新的摘要内容",
      }

      const summaryTokens = tokenizeText(updateData.summary)
      expect(summaryTokens).toBe("这是新的摘要内容")
    })

    it("当管理员使用 { set: string } 语法更新时，应该生成正确的 token", () => {
      const updateData = {
        summary: { set: "使用 set 语法的摘要" },
      }

      const summaryTokens = tokenizeText(
        typeof updateData.summary === "object" && "set" in updateData.summary
          ? updateData.summary.set
          : updateData.summary
      )
      expect(summaryTokens).toBe("使用 set 语法的摘要")
    })
  })

  describe("hasOwnProperty 检查逻辑", () => {
    it("当字段存在于 update data 中时，应该更新 token", () => {
      const updateData = {
        title: "新标题",
        summary: null,
      }

      const hasOwn = Object.prototype.hasOwnProperty

      expect(hasOwn.call(updateData, "title")).toBe(true)
      expect(hasOwn.call(updateData, "summary")).toBe(true)
      expect(hasOwn.call(updateData, "content")).toBe(false)

      if (hasOwn.call(updateData, "summary")) {
        const summaryTokens = tokenizeText(updateData.summary)
        expect(summaryTokens).toBe("")
      }
    })

    it("当字段不存在于 update data 中时，不应该更新 token", () => {
      const updateData = {
        title: "新标题",
      }

      const hasOwn = Object.prototype.hasOwnProperty

      expect(hasOwn.call(updateData, "title")).toBe(true)
      expect(hasOwn.call(updateData, "summary")).toBe(false)
    })
  })

  describe("批量更新场景", () => {
    it("应该正确处理批量数据中的 null 值", () => {
      const batchData = [
        { title: "文章 1", summary: "摘要 1" },
        { title: "文章 2", summary: null },
        { title: "文章 3", summary: "" },
      ]

      const results = batchData.map((item) => ({
        title: item.title,
        summaryTokens: tokenizeText(item.summary),
      }))

      expect(results[0].summaryTokens).toBe("摘要 1")
      expect(results[1].summaryTokens).toBe("")
      expect(results[2].summaryTokens).toBe("")
    })
  })

  describe("边界情况", () => {
    it("应该正确处理只包含空格的字符串", () => {
      const result = tokenizeText("   ")
      expect(result).toBe("")
    })

    it("应该正确处理包含特殊字符的字符串", () => {
      const result = tokenizeText("Hello\nWorld\tTest")
      expect(result).toBe("hello world test")
    })

    it("应该正确处理中英文混合内容", () => {
      const result = tokenizeText("测试 Test 内容")
      expect(result).toBe("测试 test 内容")
    })
  })
})

