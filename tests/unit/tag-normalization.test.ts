import { describe, expect, it } from "vitest"
import { sanitizeTagName } from "@/lib/validation/tag"
import { normalizeTagNames } from "@/lib/repos/tag-repo"

describe("tag sanitization utilities", () => {
  describe("sanitizeTagName", () => {
    it("should trim and accept valid tag names", () => {
      const result = sanitizeTagName("  Next.js 技术 ")
      expect(result).toBe("Next.js 技术")
    })

    it("should reject empty or whitespace strings", () => {
      expect(sanitizeTagName("")).toBeNull()
      expect(sanitizeTagName("   ")).toBeNull()
    })

    it("should reject names exceeding length limit", () => {
      const longName = "a".repeat(51)
      expect(sanitizeTagName(longName)).toBeNull()
    })

    it("should reject names with unsupported characters", () => {
      expect(sanitizeTagName("invalid@tag")).toBeNull()
    })
  })

  describe("normalizeTagNames", () => {
    it("should deduplicate and sanitize tag inputs", () => {
      const result = normalizeTagNames(["  Next.js ", "next.js", "React  ", "🔥invalid"], 5)
      expect(result).toHaveLength(2)
      expect(result.map((tag) => tag.name)).toEqual(["Next.js", "React"])
    })

    it("should honor maxTags limit after sanitization", () => {
      const inputs = ["tag1", "tag2", "tag3", "tag4"].map((name) => `${name} `)
      const result = normalizeTagNames(inputs, 2)
      expect(result).toHaveLength(2)
    })

    it("should filter out entries that fail sanitization", () => {
      const result = normalizeTagNames(["valid", "", "  ", "@bad", "#another"], 10)
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe("valid")
    })
  })
})
