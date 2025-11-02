/**
 * 工具函数库单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// 分页工具测试
import {
  createCursorPagination,
  createOffsetPagination,
  calculateOffset,
  calculateTotalPages,
  generateCursor,
  parseCursor,
  createPaginationMeta,
  validatePaginationOptions,
  validateCursorPaginationOptions,
} from "../../lib/utils/pagination"

// Slug 工具测试
import {
  createSlug,
  createUniqueSlug,
  slugToTitle,
  validateSlug,
  createUniqueSlugs,
} from "../../lib/utils/slug"

// 日期工具测试
import {
  formatDateChinese,
  formatRelativeTime,
  getFriendlyTimeDescription,
  isToday,
  isYesterday,
  calculateAge,
  getTimestamp,
  formatDuration,
  isValidDate,
  parseDate,
} from "../../lib/utils/date"

// 内容工具测试
import {
  sanitizeText,
  processText,
  decodeHtmlEntities,
  encodeHtmlEntities,
  extractTextFromHtml,
  validateContentSecurity,
  generateExcerpt,
  estimateReadingTime,
  detectContentLanguage,
} from "../../lib/utils/content"

// API 错误工具测试
import {
  ApiErrorType,
  ErrorSeverity,
  createApiError,
  createValidationError,
  createSuccessResponse,
  handleUnknownError,
  generateRequestId,
} from "../../lib/utils/api-errors"

// 通用工具测试
import {
  delay,
  debounce,
  throttle,
  retry,
  safeJsonParse,
  deepClone,
  isEmpty,
  unique,
  groupBy,
  chunk,
  formatFileSize,
  isValidEmail,
  isValidUrl,
  highlightSearchKeywords,
} from "../../lib/utils/index"

describe("分页工具函数", () => {
  describe("createOffsetPagination", () => {
    it("应该创建默认分页参数", () => {
      const pagination = createOffsetPagination()
      expect(pagination).toEqual({ page: 1, pageSize: 20 })
    })

    it("应该限制最大页面大小", () => {
      const pagination = createOffsetPagination({ pageSize: 200 })
      expect(pagination.pageSize).toBe(100)
    })

    it("应该确保最小页码为1", () => {
      const pagination = createOffsetPagination({ page: 0 })
      expect(pagination.page).toBe(1)
    })
  })

  describe("calculateOffset", () => {
    it("应该正确计算偏移量", () => {
      expect(calculateOffset(1, 20)).toBe(0)
      expect(calculateOffset(2, 20)).toBe(20)
      expect(calculateOffset(3, 10)).toBe(20)
    })
  })

  describe("calculateTotalPages", () => {
    it("应该正确计算总页数", () => {
      expect(calculateTotalPages(100, 20)).toBe(5)
      expect(calculateTotalPages(101, 20)).toBe(6)
      expect(calculateTotalPages(0, 20)).toBe(0)
    })
  })

  describe("generateCursor 和 parseCursor", () => {
    it("应该生成和解析游标", () => {
      const cursor = generateCursor("123")
      const parsed = parseCursor(cursor)

      expect(parsed).toEqual({ id: "123", timestamp: undefined })
    })

    it("应该处理带时间戳的游标", () => {
      const timestamp = new Date()
      const cursor = generateCursor("123", timestamp)
      const parsed = parseCursor(cursor)

      expect(parsed?.id).toBe("123")
      expect(parsed?.timestamp?.getTime()).toBe(timestamp.getTime())
    })

    it("应该处理无效游标", () => {
      const parsed = parseCursor("invalid-cursor")
      expect(parsed).toBeNull()
    })
  })

  describe("validatePaginationOptions", () => {
    it("应该验证有效的分页选项", () => {
      const result = validatePaginationOptions({ page: 1, pageSize: 20 })
      expect(result.isValid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it("应该检测无效的页码", () => {
      const result = validatePaginationOptions({ page: 0 })
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain("页码必须是正整数")
    })

    it("应该检测无效的页面大小", () => {
      const result = validatePaginationOptions({ pageSize: 200 })
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain("页面大小必须是1-100之间的整数")
    })
  })
})

describe("Slug 工具函数", () => {
  describe("createSlug", () => {
    it("应该创建基本的 slug", () => {
      expect(createSlug("Hello World")).toBe("hello-world")
      expect(createSlug("JavaScript 开发教程")).toContain("javascript")
    })

    it("应该处理特殊字符", () => {
      expect(createSlug("Hello & World")).toBe("hello-and-world")
      expect(createSlug("React + TypeScript")).toBe("react-plus-typescript")
    })

    it("应该限制长度", () => {
      const longText = "a".repeat(100)
      const slug = createSlug(longText, { maxLength: 10 })
      expect(slug.length).toBeLessThanOrEqual(10)
    })

    it("应该处理中文内容", () => {
      const slug1 = createSlug("这是一个测试")
      const slug2 = createSlug("Vue 3 新特性介绍")

      expect(slug1).toContain("zhe")
      expect(slug1).toContain("shi")
      expect(slug2).toContain("vue")
      expect(slug2).toContain("3")
    })

    it("应该处理空输入", () => {
      expect(createSlug("")).toBe("")
      expect(createSlug(null as any)).toBe("")
      expect(createSlug(undefined as any)).toBe("")
    })
  })

  describe("validateSlug", () => {
    it("应该验证有效的 slug", () => {
      const result = validateSlug("valid-slug")
      expect(result.isValid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it("应该检测无效字符", () => {
      const result = validateSlug("invalid slug with spaces")
      expect(result.isValid).toBe(false)
    })

    it("应该检测首尾分隔符", () => {
      const result = validateSlug("-invalid-slug-")
      expect(result.isValid).toBe(false)
    })
  })

  describe("createUniqueSlug", () => {
    it("应该生成唯一的 slug", async () => {
      const checkExists = vi
        .fn()
        .mockResolvedValueOnce(true) // 第一次检查：存在
        .mockResolvedValueOnce(false) // 第二次检查：不存在

      const slug = await createUniqueSlug("test", checkExists)
      expect(slug).toBe("test-1")
      expect(checkExists).toHaveBeenCalledTimes(2)
    })
  })
})

describe("日期工具函数", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2024-08-26T12:00:00Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe("formatDateChinese", () => {
    it("应该格式化为中文日期", () => {
      const date = new Date("2024-08-26T12:00:00Z")

      expect(formatDateChinese(date, { format: "long" })).toBe("2024年8月26日")
      expect(formatDateChinese(date, { format: "medium" })).toBe("2024-08-26")
    })

    it("应该包含时间", () => {
      const date = new Date("2024-08-26T12:30:45Z")
      const result = formatDateChinese(date, {
        format: "long",
        includeTime: true,
        timezone: "UTC",
      })

      expect(result).toContain("12:30:45")
    })

    it("应该处理无效日期", () => {
      expect(formatDateChinese("invalid")).toBe("无效日期")
      expect(formatDateChinese(null as any)).toBe("无效日期")
    })
  })

  describe("formatRelativeTime", () => {
    it("应该格式化相对时间", () => {
      const baseDate = new Date("2024-08-26T12:00:00Z")

      // 测试过去时间
      expect(formatRelativeTime(new Date("2024-08-26T11:30:00Z"), baseDate)).toBe("30分钟前")
      expect(formatRelativeTime(new Date("2024-08-25T12:00:00Z"), baseDate)).toBe("1天前")

      // 测试刚刚
      expect(formatRelativeTime(new Date("2024-08-26T11:59:40Z"), baseDate)).toBe("刚刚")
    })

    it("应该格式化未来时间", () => {
      const baseDate = new Date("2024-08-26T12:00:00Z")
      expect(formatRelativeTime(new Date("2024-08-26T13:00:00Z"), baseDate)).toBe("1小时后")
    })
  })

  describe("isToday", () => {
    it("应该正确识别今天", () => {
      const today = new Date("2024-08-26T15:30:00Z")
      const yesterday = new Date("2024-08-25T15:30:00Z")

      expect(isToday(today)).toBe(true)
      expect(isToday(yesterday)).toBe(false)
    })
  })

  describe("calculateAge", () => {
    it("应该计算正确年龄", () => {
      // 当前时间: 2024-08-26
      expect(calculateAge(new Date("2000-08-26"))).toBe(24)
      expect(calculateAge(new Date("2000-08-27"))).toBe(23) // 生日还没到
      expect(calculateAge(new Date("2000-08-25"))).toBe(24) // 生日已过
    })

    it("应该处理无效日期", () => {
      expect(calculateAge("invalid")).toBe(0)
    })
  })

  describe("formatDuration", () => {
    it("应该格式化持续时间", () => {
      expect(formatDuration(1000)).toBe("1秒")
      expect(formatDuration(60000)).toBe("1分钟")
      expect(formatDuration(3600000)).toBe("1小时")
      expect(formatDuration(86400000)).toBe("1天")
      expect(formatDuration(90061000)).toBe("1天 1小时 1分钟 1秒")
    })

    it("应该处理负数", () => {
      expect(formatDuration(-1000)).toBe("0秒")
    })
  })

  describe("isValidDate", () => {
    it("应该验证有效日期", () => {
      expect(isValidDate(new Date())).toBe(true)
      expect(isValidDate(new Date("invalid"))).toBe(false)
      expect(isValidDate("not a date" as any)).toBe(false)
    })
  })

  describe("parseDate", () => {
    it("应该解析各种日期格式", () => {
      expect(parseDate("2024-08-26")).toBeInstanceOf(Date)
      expect(parseDate(1724678400000)).toBeInstanceOf(Date)
      expect(parseDate(new Date())).toBeInstanceOf(Date)

      expect(parseDate("invalid")).toBeNull()
      expect(parseDate("")).toBeNull()
    })
  })
})

describe("内容工具函数", () => {
  describe("sanitizeText", () => {
    it("应该清理文本内容", () => {
      const html = "<p>Hello <strong>World</strong>!</p>"
      expect(sanitizeText(html)).toBe("Hello World!")
    })

    it("应该限制长度", () => {
      const longText = "a".repeat(100)
      const result = sanitizeText(longText, { maxLength: 10 })
      expect(result.length).toBeLessThanOrEqual(13) // 包含 '...'
    })

    it("应该处理空输入", () => {
      expect(sanitizeText("")).toBe("")
      expect(sanitizeText(null as any)).toBe("")
    })
  })

  describe("processText", () => {
    it("应该处理文本格式", () => {
      const text = "  Hello    World  \n\n\n  Test  "
      const result = processText(text, {
        removeExtraSpaces: true,
        trimLines: true,
        normalizeLineBreaks: true,
      })

      expect(result).toBe("Hello World\n\nTest")
    })

    it("应该限制行长度", () => {
      const longLine = "a".repeat(100)
      const result = processText(longLine, { maxLineLength: 10 })

      // 应该被分割成多行
      expect(result.split("\n").length).toBeGreaterThan(1)
    })
  })

  describe("decodeHtmlEntities", () => {
    it("应该解码 HTML 实体", () => {
      expect(decodeHtmlEntities("&lt;div&gt;Hello&lt;/div&gt;")).toBe("<div>Hello</div>")
      expect(decodeHtmlEntities("&amp;nbsp;")).toBe("&nbsp;")
    })
  })

  describe("encodeHtmlEntities", () => {
    it("应该编码 HTML 实体", () => {
      expect(encodeHtmlEntities("<div>Hello</div>")).toBe("&lt;div&gt;Hello&lt;&#x2F;div&gt;")
      expect(encodeHtmlEntities("A & B")).toBe("A &amp; B")
    })
  })

  describe("extractTextFromHtml", () => {
    it("应该提取纯文本", () => {
      const html = "<p>Hello <strong>World</strong>!</p>"
      expect(extractTextFromHtml(html)).toBe("Hello World!")
    })

    it("应该处理复杂 HTML", () => {
      const html = "<div><p>段落1</p><ul><li>项目1</li><li>项目2</li></ul></div>"
      const text = extractTextFromHtml(html)
      expect(text).toContain("段落1")
      expect(text).toContain("项目1")
    })
  })

  describe("validateContentSecurity", () => {
    it("应该检测安全内容", () => {
      const result = validateContentSecurity("<p>Hello World</p>")
      expect(result.isSafe).toBe(true)
    })

    it("应该检测危险内容", () => {
      const dangerousContent = '<script>alert("xss")</script>'
      const result = validateContentSecurity(dangerousContent)
      expect(result.isSafe).toBe(false)
      expect(result.issues).toContain("检测到潜在的脚本标签")
    })

    it("应该检测事件处理器", () => {
      const result = validateContentSecurity('<div onclick="alert()">Click</div>')
      expect(result.isSafe).toBe(false)
      expect(result.issues).toContain("检测到潜在的事件处理器")
    })
  })

  describe("generateExcerpt", () => {
    it("应该生成摘要", () => {
      const content = "a".repeat(300)
      const excerpt = generateExcerpt(content, 100)
      expect(excerpt.length).toBeLessThanOrEqual(103) // 100 + '...'
    })

    it("应该在单词边界截断", () => {
      const content = "Hello world this is a long sentence"
      const excerpt = generateExcerpt(content, 15)
      expect(excerpt).toBe("Hello world...")
    })
  })

  describe("estimateReadingTime", () => {
    it("应该估算阅读时间", () => {
      const chineseText = "这是一个中文测试内容。".repeat(50) // 大约500字符
      const time = estimateReadingTime(chineseText)
      expect(time).toBeGreaterThan(0)
    })

    it("应该处理英文内容", () => {
      const englishText = "This is a test content ".repeat(100) // 大约400单词
      const time = estimateReadingTime(englishText, 200)
      expect(time).toBeGreaterThanOrEqual(2) // 至少2分钟
    })
  })

  describe("detectContentLanguage", () => {
    it("应该检测中文内容", () => {
      expect(detectContentLanguage("这是中文内容")).toBe("zh")
    })

    it("应该检测英文内容", () => {
      expect(detectContentLanguage("This is English content")).toBe("en")
    })

    it("应该检测混合内容", () => {
      expect(detectContentLanguage("This is 中英文 mixed content")).toBe("mixed")
    })
  })
})

describe("API 错误工具函数", () => {
  describe("createApiError", () => {
    it("应该创建 API 错误", () => {
      const error = createApiError(ApiErrorType.NOT_FOUND, "资源未找到")

      expect(error.type).toBe(ApiErrorType.NOT_FOUND)
      expect(error.message).toBe("资源未找到")
      expect(error.statusCode).toBe(404)
      expect(error.severity).toBe(ErrorSeverity.LOW)
    })

    it("应该包含时间戳", () => {
      const error = createApiError(ApiErrorType.INTERNAL_SERVER_ERROR, "服务器错误")
      expect(error.timestamp).toBeDefined()
      expect(new Date(error.timestamp)).toBeInstanceOf(Date)
    })
  })

  describe("createValidationError", () => {
    it("应该创建验证错误", () => {
      const error = createValidationError("email", "邮箱格式无效", "invalid-email")

      expect(error.field).toBe("email")
      expect(error.message).toBe("邮箱格式无效")
      expect(error.value).toBe("invalid-email")
    })
  })

  describe("createSuccessResponse", () => {
    it("应该创建成功响应", () => {
      const response = createSuccessResponse({ id: 1, name: "test" }, "操作成功")

      expect(response.success).toBe(true)
      expect(response.data).toEqual({ id: 1, name: "test" })
      expect(response.message).toBe("操作成功")
    })
  })

  describe("handleUnknownError", () => {
    it("应该处理标准错误", () => {
      const originalError = new Error("测试错误")
      const apiError = handleUnknownError(originalError)

      expect(apiError.type).toBe(ApiErrorType.INTERNAL_SERVER_ERROR)
      expect(apiError.message).toBe("测试错误")
    })

    it("应该处理字符串错误", () => {
      const apiError = handleUnknownError("字符串错误")
      expect(apiError.type).toBe(ApiErrorType.INTERNAL_SERVER_ERROR)
      expect(apiError.message).toBe("发生未知错误")
    })
  })

  describe("generateRequestId", () => {
    it("应该生成唯一的请求ID", () => {
      const id1 = generateRequestId()
      const id2 = generateRequestId()

      expect(id1).toBeDefined()
      expect(id2).toBeDefined()
      expect(id1).not.toBe(id2)
      expect(id1.startsWith("req_")).toBe(true)
    })
  })
})

describe("通用工具函数", () => {
  describe("delay", () => {
    it("应该延迟指定时间", async () => {
      const start = Date.now()
      await delay(100)
      const end = Date.now()

      expect(end - start).toBeGreaterThanOrEqual(90) // 允许一些误差
    })
  })

  describe("debounce", () => {
    it("应该防抖函数调用", async () => {
      const fn = vi.fn()
      const debouncedFn = debounce(fn, 100)

      debouncedFn()
      debouncedFn()
      debouncedFn()

      expect(fn).not.toHaveBeenCalled()

      await delay(150)
      expect(fn).toHaveBeenCalledTimes(1)
    })
  })

  describe("throttle", () => {
    it("应该节流函数调用", async () => {
      const fn = vi.fn()
      const throttledFn = throttle(fn, 100)

      throttledFn()
      throttledFn()
      throttledFn()

      expect(fn).toHaveBeenCalledTimes(1)

      await delay(150)
      throttledFn()
      expect(fn).toHaveBeenCalledTimes(2)
    })
  })

  describe("retry", () => {
    it("应该重试失败的函数", async () => {
      let attempts = 0
      const fn = vi.fn().mockImplementation(async () => {
        attempts++
        if (attempts < 3) {
          throw new Error("测试错误")
        }
        return "成功"
      })

      const result = await retry(fn, 3, 10)
      expect(result).toBe("成功")
      expect(fn).toHaveBeenCalledTimes(3)
    })

    it("应该在超过最大尝试次数后抛出错误", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("持续失败"))

      await expect(retry(fn, 2, 10)).rejects.toThrow("持续失败")
      expect(fn).toHaveBeenCalledTimes(2)
    })
  })

  describe("safeJsonParse", () => {
    it("应该安全解析 JSON", () => {
      expect(safeJsonParse('{"test": true}', {})).toEqual({ test: true })
      expect(safeJsonParse("invalid json", { fallback: true })).toEqual({ fallback: true })
    })
  })

  describe("deepClone", () => {
    it("应该深拷贝对象", () => {
      const original = {
        name: "test",
        nested: {
          value: 42,
          date: new Date("2024-01-01"),
        },
        array: [1, 2, { nested: "value" }],
      }

      const cloned = deepClone(original)

      expect(cloned).toEqual(original)
      expect(cloned).not.toBe(original)
      expect(cloned.nested).not.toBe(original.nested)
      expect(cloned.array).not.toBe(original.array)
      expect(cloned.array[2]).not.toBe(original.array[2])
    })

    it("应该处理特殊值", () => {
      expect(deepClone(null)).toBe(null)
      expect(deepClone(undefined)).toBe(undefined)
      expect(deepClone(42)).toBe(42)
      expect(deepClone("string")).toBe("string")
    })
  })

  describe("isEmpty", () => {
    it("应该检测空值", () => {
      expect(isEmpty(null)).toBe(true)
      expect(isEmpty(undefined)).toBe(true)
      expect(isEmpty("")).toBe(true)
      expect(isEmpty([])).toBe(true)
      expect(isEmpty({})).toBe(true)

      expect(isEmpty("test")).toBe(false)
      expect(isEmpty([1])).toBe(false)
      expect(isEmpty({ key: "value" })).toBe(false)
      expect(isEmpty(0)).toBe(false)
    })
  })

  describe("unique", () => {
    it("应该数组去重", () => {
      expect(unique([1, 2, 2, 3, 3, 4])).toEqual([1, 2, 3, 4])
    })

    it("应该根据键去重", () => {
      const array = [
        { id: 1, name: "a" },
        { id: 2, name: "b" },
        { id: 1, name: "c" },
      ]

      expect(unique(array, "id")).toHaveLength(2)
    })
  })

  describe("groupBy", () => {
    it("应该分组数组", () => {
      const array = [
        { type: "A", value: 1 },
        { type: "B", value: 2 },
        { type: "A", value: 3 },
      ]

      const grouped = groupBy(array, "type")
      expect(grouped.A).toHaveLength(2)
      expect(grouped.B).toHaveLength(1)
    })
  })

  describe("chunk", () => {
    it("应该分割数组", () => {
      const array = [1, 2, 3, 4, 5]
      const chunks = chunk(array, 2)

      expect(chunks).toEqual([[1, 2], [3, 4], [5]])
    })
  })

  describe("formatFileSize", () => {
    it("应该格式化文件大小", () => {
      expect(formatFileSize(1024)).toBe("1.0 KB")
      expect(formatFileSize(1024 * 1024)).toBe("1.0 MB")
      expect(formatFileSize(1024 * 1024 * 1024)).toBe("1.0 GB")
    })
  })

  describe("isValidEmail", () => {
    it("应该验证邮箱格式", () => {
      expect(isValidEmail("test@example.com")).toBe(true)
      expect(isValidEmail("user.name+tag@domain.co.uk")).toBe(true)

      expect(isValidEmail("invalid-email")).toBe(false)
      expect(isValidEmail("@domain.com")).toBe(false)
      expect(isValidEmail("test@")).toBe(false)
    })
  })

  describe("isValidUrl", () => {
    it("应该验证 URL 格式", () => {
      expect(isValidUrl("https://example.com")).toBe(true)
      expect(isValidUrl("http://localhost:3000")).toBe(true)
      expect(isValidUrl("ftp://files.example.com")).toBe(true)

      expect(isValidUrl("invalid-url")).toBe(false)
      expect(isValidUrl("://invalid")).toBe(false)
    })
  })

  describe("highlightSearchKeywords", () => {
    it("应该高亮搜索关键词", () => {
      const text = "Hello world, this is a test"
      const result = highlightSearchKeywords(text, ["world", "test"])

      expect(result).toContain('<mark class="highlight">world</mark>')
      expect(result).toContain('<mark class="highlight">test</mark>')
    })

    it("应该处理空关键词", () => {
      const text = "Hello world"
      const result = highlightSearchKeywords(text, [])

      expect(result).toBe(text)
    })

    it("应该忽略空关键词", () => {
      const text = "Hello world"
      const result = highlightSearchKeywords(text, ["", "  ", "world"])

      expect(result).toContain('<mark class="highlight">world</mark>')
    })
  })
})
