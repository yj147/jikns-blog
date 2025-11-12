/**
 * 工具函数库基础功能测试
 */

import { describe, it, expect } from "vitest"

// 测试基础分页功能
import {
  createOffsetPagination,
  calculateOffset,
  validatePaginationOptions,
} from "../../lib/utils/pagination"

// 测试基础 slug 功能
import { createSlug, validateSlug } from "../../lib/utils/slug"

// 测试基础日期功能
import { formatDateChinese, isValidDate } from "../../lib/utils/date"

// 测试基础 API 错误功能
import { ApiErrorType, createApiError } from "../../lib/utils/api-errors"

describe("工具函数库基础功能", () => {
  describe("分页功能", () => {
    it("应该创建分页参数", () => {
      const pagination = createOffsetPagination({ page: 2, pageSize: 10 })
      expect(pagination.page).toBe(2)
      expect(pagination.pageSize).toBe(10)
    })

    it("应该计算偏移量", () => {
      expect(calculateOffset(1, 10)).toBe(0)
      expect(calculateOffset(2, 10)).toBe(10)
    })

    it("应该验证分页参数", () => {
      const valid = validatePaginationOptions({ page: 1, pageSize: 20 })
      expect(valid.isValid).toBe(true)

      const invalid = validatePaginationOptions({ page: -1 })
      expect(invalid.isValid).toBe(false)
    })
  })

  describe("Slug 功能", () => {
    it("应该生成基本 slug", () => {
      expect(createSlug("Hello World")).toBe("hello-world")
      expect(createSlug("Test-String")).toBe("test-string")
    })

    it("应该验证 slug", () => {
      expect(validateSlug("valid-slug").isValid).toBe(true)
      expect(validateSlug("invalid slug").isValid).toBe(false)
    })
  })

  describe("日期功能", () => {
    it("应该格式化日期", () => {
      const date = new Date("2024-01-01")
      const formatted = formatDateChinese(date, { format: "medium" })
      expect(formatted).toContain("2024")
    })

    it("应该验证日期", () => {
      expect(isValidDate(new Date())).toBe(true)
      expect(isValidDate(new Date("invalid"))).toBe(false)
    })
  })

  describe("API 错误功能", () => {
    it("应该创建 API 错误", () => {
      const error = createApiError(ApiErrorType.NOT_FOUND, "未找到")
      expect(error.type).toBe(ApiErrorType.NOT_FOUND)
      expect(error.statusCode).toBe(404)
      expect(error.message).toBe("未找到")
    })
  })
})
