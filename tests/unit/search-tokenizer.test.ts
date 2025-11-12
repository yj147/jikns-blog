import { describe, expect, it } from "vitest"
import { tokenizeText } from "@/lib/search/tokenizer"

describe("tokenizeText", () => {
  it("returns empty string for nullish input", () => {
    expect(tokenizeText(null)).toBe("")
    expect(tokenizeText(undefined)).toBe("")
  })

  it("splits Chinese sentences into multiple tokens", () => {
    const tokens = tokenizeText("这是一个中文搜索分词测试")
    expect(tokens.length).toBeGreaterThan(0)
    expect(tokens.split(" ").length).toBeGreaterThan(1)
  })

  it("handles mixed Chinese and English content", () => {
    const tokens = tokenizeText("Next.js 中文混合搜索")
    expect(tokens.split(" ").length).toBeGreaterThan(1)
    expect(tokens).toContain("Next")
  })
})
