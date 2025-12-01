import { describe, it, expect } from "vitest"
import { calculateReadingMinutes } from "@/lib/utils/reading-time"

describe("calculateReadingMinutes", () => {
  it("返回 1 分钟用于 300 个中文字符", () => {
    const content = "测".repeat(300)
    expect(calculateReadingMinutes(content)).toBe(1)
  })

  it("返回 1 分钟用于 300 个英文单词", () => {
    const content = `${"word ".repeat(300).trim()}`
    expect(calculateReadingMinutes(content)).toBe(1)
  })

  it("处理中英混合文本", () => {
    const chinesePart = "好".repeat(150) // 150 个中文字符
    const englishPart = "word ".repeat(200).trim() // 200 个英文单词
    const mixed = `${chinesePart} ${englishPart}`

    // 150 + 200 = 350 单位，350 / 300 = 1.166... -> 2 分钟
    expect(calculateReadingMinutes(mixed)).toBe(2)
  })

  it("空字符串或 null 返回最小 1 分钟", () => {
    expect(calculateReadingMinutes(" ")).toBe(1)
    expect(calculateReadingMinutes(null)).toBe(1)
  })

  it("忽略 HTML 标签", () => {
    const htmlOnly = '<div><img src="x" alt="desc" /></div>'
    expect(calculateReadingMinutes(htmlOnly)).toBe(1)

    const htmlWithText = '<p>你好 <strong>world</strong></p>'
    expect(calculateReadingMinutes(htmlWithText)).toBe(1)
  })

  it("支持数字长度输入", () => {
    expect(calculateReadingMinutes(450)).toBe(2)
  })

  it("无中英文字符时返回 1", () => {
    expect(calculateReadingMinutes("12345 !!!")).toBe(1)
  })
})
