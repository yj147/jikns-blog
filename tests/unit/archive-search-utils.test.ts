import { describe, expect, it } from "vitest"

import { buildHighlightSegments, buildSearchPreview } from "@/lib/utils/archive-search"

describe("buildHighlightSegments", () => {
  it("正确标记匹配片段并保持原始大小写", () => {
    const result = buildHighlightSegments("Next.js Archive Search", "archive")
    expect(result).toEqual([
      { text: "Next.js ", match: false },
      { text: "Archive", match: true },
      { text: " Search", match: false },
    ])
  })

  it("允许大小写不敏感匹配", () => {
    const result = buildHighlightSegments("归档搜索功能", "搜索")
    expect(result).toEqual([
      { text: "归档", match: false },
      { text: "搜索", match: true },
      { text: "功能", match: false },
    ])
  })

  it("处理带有特殊字符的查询", () => {
    const result = buildHighlightSegments("使用 React.useMemo 优化", "React.use")
    expect(result.map((item) => item.text)).toEqual(["使用 ", "React.use", "Memo 优化"])
  })

  it("空查询返回原文或空数组", () => {
    expect(buildHighlightSegments("text", "")).toEqual([{ text: "text", match: false }])
    expect(buildHighlightSegments("", "test")).toEqual([])
  })
})

describe("buildSearchPreview", () => {
  it("在匹配位置附近截取文本窗口", () => {
    const preview = buildSearchPreview("这是一个用于搜索预览的长文本片段", "搜索", 10)
    expect(preview.startsWith("…")).toBe(true)
    expect(preview.endsWith("…")).toBe(true)
    expect(preview.includes("搜索")).toBe(true)
  })

  it("缺少匹配时返回开头片段", () => {
    const preview = buildSearchPreview("短内容", "不存在", 4)
    expect(preview).toBe("短内容")
  })

  it("空文本返回空字符串", () => {
    expect(buildSearchPreview(null, "test")).toBe("")
  })
})
