import { describe, expect, it } from "vitest"

import {
  buildHighlightSegments,
  buildSearchPreview,
  escapeSearchQuery,
} from "@/lib/utils/archive-search"

describe("archive search utils", () => {
  it("escapeSearchQuery 会处理特殊字符", () => {
    expect(escapeSearchQuery("hello.*")).toBe("hello\\.\\*")
  })

  it("buildHighlightSegments 会返回匹配片段", () => {
    const segments = buildHighlightSegments("Next.js Archive Search", "archive")
    expect(segments).toHaveLength(3)
    expect(segments[1]).toEqual({ text: "Archive", match: true })
  })

  it("buildSearchPreview 在命中时返回窗口片段", () => {
    const preview = buildSearchPreview("这是一段包含归档搜索关键词的内容", "归档搜索", 8)
    expect(preview).toContain("归档搜索")
    expect(preview.length).toBeLessThanOrEqual(10)
  })

  it("buildSearchPreview 在无命中时返回开头截断", () => {
    const preview = buildSearchPreview("文章内容", "不存在", 4)
    expect(preview).toBe("文章内容")
  })
})
