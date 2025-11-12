/**
 * matchesPath 函数单元测试
 * 验证路径匹配逻辑的正确性
 */

import { describe, test, expect } from "vitest"

// 从 middleware.ts 提取的 matchesPath 函数
function matchesPath(pathname: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => {
    // 处理中间通配符 * 的情况
    if (pattern.includes("*/") && !pattern.endsWith("/*")) {
      // 将 * 转换为正则表达式 [^/]+（匹配除/外的任意字符）
      const regexPattern = pattern.replace(/\*/g, "[^/]+")
      const regex = new RegExp(`^${regexPattern}$`)
      return regex.test(pathname)
    }

    // 处理末尾通配符 /* 的情况
    if (pattern.endsWith("/*")) {
      const prefix = pattern.slice(0, -2) // 移除 /*
      return pathname.startsWith(prefix + "/") || pathname === prefix
    }

    // 精确匹配或前缀匹配
    return pathname === pattern || pathname.startsWith(pattern + "/")
  })
}

describe("matchesPath 路径匹配函数", () => {
  describe("精确匹配", () => {
    test("应该精确匹配完全相同的路径", () => {
      expect(matchesPath("/api/comments", ["/api/comments"])).toBe(true)
      expect(matchesPath("/api/posts", ["/api/posts"])).toBe(true)
    })

    test("精确匹配不应该匹配子路径", () => {
      expect(matchesPath("/api/comments/123", ["/api/comments"])).toBe(false)
      expect(matchesPath("/api/posts/slug/test", ["/api/posts"])).toBe(false)
    })

    test("精确匹配不应该匹配父路径", () => {
      expect(matchesPath("/api", ["/api/comments"])).toBe(false)
      expect(matchesPath("/", ["/api/posts"])).toBe(false)
    })
  })

  describe("前缀匹配（默认行为）", () => {
    test("应该匹配所有子路径", () => {
      expect(matchesPath("/api/admin/users", ["/api/admin"])).toBe(true)
      expect(matchesPath("/api/admin/posts/123", ["/api/admin"])).toBe(true)
      expect(matchesPath("/api/admin/deep/nested/path", ["/api/admin"])).toBe(true)
    })

    test("前缀匹配需要完整段匹配", () => {
      expect(matchesPath("/api/administrator", ["/api/admin"])).toBe(false)
      expect(matchesPath("/api/admin2", ["/api/admin"])).toBe(false)
    })
  })

  describe("末尾通配符 /*", () => {
    test("应该匹配所有子路径", () => {
      expect(matchesPath("/api/admin/users", ["/api/admin/*"])).toBe(true)
      expect(matchesPath("/api/admin/posts/123", ["/api/admin/*"])).toBe(true)
      expect(matchesPath("/api/admin/deep/nested", ["/api/admin/*"])).toBe(true)
    })

    test("应该匹配基础路径本身", () => {
      expect(matchesPath("/api/admin", ["/api/admin/*"])).toBe(true)
    })

    test("不应该匹配非子路径", () => {
      expect(matchesPath("/api/users", ["/api/admin/*"])).toBe(false)
      expect(matchesPath("/api", ["/api/admin/*"])).toBe(false)
    })
  })

  describe("中段通配符 *", () => {
    test("应该匹配单段ID路径", () => {
      expect(matchesPath("/api/activities/123/comments", ["/api/activities/*/comments"])).toBe(true)
      expect(matchesPath("/api/activities/abc-def/comments", ["/api/activities/*/comments"])).toBe(
        true
      )
      expect(
        matchesPath("/api/activities/uuid-123-456/comments", ["/api/activities/*/comments"])
      ).toBe(true)
    })

    test("不应该匹配多段路径", () => {
      expect(matchesPath("/api/activities/123/456/comments", ["/api/activities/*/comments"])).toBe(
        false
      )
      expect(matchesPath("/api/activities/a/b/c/comments", ["/api/activities/*/comments"])).toBe(
        false
      )
    })

    test("不应该匹配缺少段的路径", () => {
      expect(matchesPath("/api/activities/comments", ["/api/activities/*/comments"])).toBe(false)
      expect(matchesPath("/api/activities//comments", ["/api/activities/*/comments"])).toBe(false)
    })

    test("多个中段通配符", () => {
      expect(matchesPath("/api/posts/123/comments/456", ["/api/posts/*/comments/*"])).toBe(true)
      expect(matchesPath("/api/posts/abc/comments/def", ["/api/posts/*/comments/*"])).toBe(true)
      expect(matchesPath("/api/posts/123/comments/456/789", ["/api/posts/*/comments/*"])).toBe(
        false
      )
    })
  })

  describe("多模式匹配", () => {
    test("应该匹配任意一个模式", () => {
      const patterns = ["/api/comments", "/api/posts", "/api/activities/*/comments"]

      expect(matchesPath("/api/comments", patterns)).toBe(true)
      expect(matchesPath("/api/posts", patterns)).toBe(true)
      expect(matchesPath("/api/activities/123/comments", patterns)).toBe(true)
    })

    test("不匹配任何模式时返回false", () => {
      const patterns = ["/api/comments", "/api/posts"]

      expect(matchesPath("/api/users", patterns)).toBe(false)
      expect(matchesPath("/api/admin", patterns)).toBe(false)
    })
  })

  describe("边界情况", () => {
    test("空模式数组应该返回false", () => {
      expect(matchesPath("/api/comments", [])).toBe(false)
    })

    test("根路径匹配", () => {
      expect(matchesPath("/", ["/"])).toBe(true)
      expect(matchesPath("/api", ["/"])).toBe(true)
      expect(matchesPath("/anything", ["/"])).toBe(true)
    })

    test("处理特殊字符", () => {
      expect(matchesPath("/api/test-dash", ["/api/test-dash"])).toBe(true)
      expect(matchesPath("/api/test_underscore", ["/api/test_underscore"])).toBe(true)
      expect(matchesPath("/api/test.dot", ["/api/test.dot"])).toBe(true)
    })

    test("大小写敏感", () => {
      expect(matchesPath("/API/comments", ["/api/comments"])).toBe(false)
      expect(matchesPath("/api/Comments", ["/api/comments"])).toBe(false)
    })
  })

  describe("实际场景测试", () => {
    test("公开GET路径配置", () => {
      const publicGetOnly = ["/api/comments", "/api/activities/*/comments"]

      // 应该匹配
      expect(matchesPath("/api/comments", publicGetOnly)).toBe(true)
      expect(matchesPath("/api/activities/123/comments", publicGetOnly)).toBe(true)
      expect(matchesPath("/api/activities/post-456/comments", publicGetOnly)).toBe(true)

      // 不应该匹配
      expect(matchesPath("/api/posts", publicGetOnly)).toBe(false)
      expect(matchesPath("/api/activities/123/likes", publicGetOnly)).toBe(false)
    })

    test("管理员路径配置", () => {
      const adminPaths = ["/api/admin", "/admin"]

      // 应该匹配
      expect(matchesPath("/api/admin/users", adminPaths)).toBe(true)
      expect(matchesPath("/admin/dashboard", adminPaths)).toBe(true)
      expect(matchesPath("/api/admin/posts/edit/123", adminPaths)).toBe(true)

      // 不应该匹配
      expect(matchesPath("/api/users", adminPaths)).toBe(false)
      expect(matchesPath("/profile", adminPaths)).toBe(false)
    })
  })
})
