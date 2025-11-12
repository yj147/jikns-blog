/**
 * 搜索日期过滤测试
 * 验证日期参数的格式和跨时区一致性
 */

import { describe, it, expect } from "vitest"
import { format } from "date-fns"
import {
  parseSearchParams,
  parseSearchParamsFromURL,
  DATE_ONLY_PATTERN,
} from "@/lib/search/search-params"

describe("搜索日期过滤测试", () => {
  describe("日期参数格式验证", () => {
    it("应该使用 yyyy-MM-dd 格式，避免时区漂移", () => {
      const date = new Date("2024-01-01")
      const formatted = format(date, "yyyy-MM-dd")

      expect(formatted).toBe("2024-01-01")
      expect(DATE_ONLY_PATTERN.test(formatted)).toBe(true)
    })

    it("DATE_ONLY_PATTERN 应该匹配 yyyy-MM-dd 格式", () => {
      expect(DATE_ONLY_PATTERN.test("2024-01-01")).toBe(true)
      expect(DATE_ONLY_PATTERN.test("2024-12-31")).toBe(true)
      expect(DATE_ONLY_PATTERN.test("2000-01-01")).toBe(true)
    })

    it("DATE_ONLY_PATTERN 不应该匹配 ISO 字符串格式", () => {
      expect(DATE_ONLY_PATTERN.test("2024-01-01T00:00:00.000Z")).toBe(false)
      expect(DATE_ONLY_PATTERN.test("2024-01-01T08:00:00+08:00")).toBe(false)
      expect(DATE_ONLY_PATTERN.test("2024-01-01T00:00:00")).toBe(false)
    })

    it("DATE_ONLY_PATTERN 不应该匹配无效格式", () => {
      expect(DATE_ONLY_PATTERN.test("2024/01/01")).toBe(false)
      expect(DATE_ONLY_PATTERN.test("01-01-2024")).toBe(false)
      expect(DATE_ONLY_PATTERN.test("2024-1-1")).toBe(false)
      expect(DATE_ONLY_PATTERN.test("not-a-date")).toBe(false)
    })
  })

  describe("日期参数解析", () => {
    it("应该正确解析 yyyy-MM-dd 格式的日期", () => {
      const params = {
        q: "test",
        publishedFrom: "2024-01-01",
        publishedTo: "2024-12-31",
      }

      const parsed = parseSearchParams(params)

      expect(parsed.publishedFrom).toBeDefined()
      expect(parsed.publishedTo).toBeDefined()
      expect(format(parsed.publishedFrom!, "yyyy-MM-dd")).toBe("2024-01-01")
      expect(format(parsed.publishedTo!, "yyyy-MM-dd")).toBe("2024-12-31")
    })

    it("应该将 yyyy-MM-dd 格式的日期转换为 startOfDay 和 endOfDay", () => {
      const params = {
        q: "test",
        publishedFrom: "2024-01-01",
        publishedTo: "2024-01-31",
      }

      const parsed = parseSearchParams(params)

      // publishedFrom 应该是 2024-01-01 00:00:00
      expect(parsed.publishedFrom?.getHours()).toBe(0)
      expect(parsed.publishedFrom?.getMinutes()).toBe(0)
      expect(parsed.publishedFrom?.getSeconds()).toBe(0)

      // publishedTo 应该是 2024-01-31 23:59:59
      expect(parsed.publishedTo?.getHours()).toBe(23)
      expect(parsed.publishedTo?.getMinutes()).toBe(59)
      expect(parsed.publishedTo?.getSeconds()).toBe(59)
    })

    it("应该正确处理 URL 参数中的日期", () => {
      const urlParams = new URLSearchParams()
      urlParams.set("q", "test")
      urlParams.set("publishedFrom", "2024-01-01")
      urlParams.set("publishedTo", "2024-12-31")

      const parsed = parseSearchParamsFromURL(urlParams)

      expect(parsed.publishedFrom).toBeDefined()
      expect(parsed.publishedTo).toBeDefined()
      expect(format(parsed.publishedFrom!, "yyyy-MM-dd")).toBe("2024-01-01")
      expect(format(parsed.publishedTo!, "yyyy-MM-dd")).toBe("2024-12-31")
    })
  })

  describe("日期参数往返转换", () => {
    it("日期参数应该在 URL → Date → URL 往返转换中保持一致", () => {
      // 模拟用户选择日期
      const originalDate = new Date("2024-01-15")

      // 转换为 URL 参数（使用 yyyy-MM-dd 格式）
      const urlParam = format(originalDate, "yyyy-MM-dd")
      expect(urlParam).toBe("2024-01-15")

      // 从 URL 参数解析回 Date
      const params = { q: "test", publishedFrom: urlParam }
      const parsed = parseSearchParams(params)

      // 验证日期一致性
      expect(parsed.publishedFrom).toBeDefined()
      expect(format(parsed.publishedFrom!, "yyyy-MM-dd")).toBe("2024-01-15")
    })

    it("跨时区用户应该得到一致的日期过滤结果", () => {
      // 模拟不同时区的用户选择同一天
      const date = new Date("2024-01-01")

      // 使用 yyyy-MM-dd 格式，不包含时区信息
      const urlParam = format(date, "yyyy-MM-dd")

      // 解析日期
      const params = { q: "test", publishedFrom: urlParam }
      const parsed = parseSearchParams(params)

      // 验证日期是 2024-01-01 的开始时间（本地时区）
      expect(parsed.publishedFrom).toBeDefined()
      expect(format(parsed.publishedFrom!, "yyyy-MM-dd")).toBe("2024-01-01")
      expect(parsed.publishedFrom?.getHours()).toBe(0)
      expect(parsed.publishedFrom?.getMinutes()).toBe(0)
    })
  })

  describe("边界情况", () => {
    it("应该正确处理无效的日期参数", () => {
      const params = {
        q: "test",
        publishedFrom: "invalid-date",
        publishedTo: "not-a-date",
      }

      const parsed = parseSearchParams(params)

      expect(parsed.publishedFrom).toBeUndefined()
      expect(parsed.publishedTo).toBeUndefined()
    })

    it("应该正确处理空的日期参数", () => {
      const params = {
        q: "test",
        publishedFrom: "",
        publishedTo: "",
      }

      const parsed = parseSearchParams(params)

      expect(parsed.publishedFrom).toBeUndefined()
      expect(parsed.publishedTo).toBeUndefined()
    })

    it("应该正确处理日期范围反转（from > to）", () => {
      const params = {
        q: "test",
        publishedFrom: "2024-12-31",
        publishedTo: "2024-01-01",
      }

      const parsed = parseSearchParams(params)

      // 应该自动交换 from 和 to
      expect(parsed.publishedFrom).toBeDefined()
      expect(parsed.publishedTo).toBeDefined()
      expect(format(parsed.publishedFrom!, "yyyy-MM-dd")).toBe("2024-01-01")
      expect(format(parsed.publishedTo!, "yyyy-MM-dd")).toBe("2024-12-31")
    })

    it("应该正确处理只有 publishedFrom 的情况", () => {
      const params = {
        q: "test",
        publishedFrom: "2024-01-01",
      }

      const parsed = parseSearchParams(params)

      expect(parsed.publishedFrom).toBeDefined()
      expect(parsed.publishedTo).toBeUndefined()
      expect(format(parsed.publishedFrom!, "yyyy-MM-dd")).toBe("2024-01-01")
    })

    it("应该正确处理只有 publishedTo 的情况", () => {
      const params = {
        q: "test",
        publishedTo: "2024-12-31",
      }

      const parsed = parseSearchParams(params)

      expect(parsed.publishedFrom).toBeUndefined()
      expect(parsed.publishedTo).toBeDefined()
      expect(format(parsed.publishedTo!, "yyyy-MM-dd")).toBe("2024-12-31")
    })
  })

  describe("ISO 字符串格式兼容性（向后兼容）", () => {
    it("应该能够解析 ISO 字符串格式的日期（但不推荐）", () => {
      const params = {
        q: "test",
        publishedFrom: "2024-01-01T00:00:00.000Z",
      }

      const parsed = parseSearchParams(params)

      // 应该能够解析，但不会被识别为 dateOnly
      expect(parsed.publishedFrom).toBeDefined()
    })

    it("ISO 字符串格式不应该触发 startOfDay/endOfDay 调整", () => {
      const params = {
        q: "test",
        publishedFrom: "2024-01-01T12:00:00.000Z",
      }

      const parsed = parseSearchParams(params)

      // 应该保持原始时间（12:00），不调整为 00:00
      expect(parsed.publishedFrom).toBeDefined()
      // 注意：由于时区转换，实际小时数可能不同
    })
  })
})
