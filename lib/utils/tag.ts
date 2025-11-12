/**
 * 标签工具函数
 * 专门提供在客户端/服务端通用的标签规范化逻辑
 */

function generateRandomSlug(): string {
  const randomSuffix =
    typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function"
      ? globalThis.crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `tag-${randomSuffix}`
}

/**
 * 将标签名称转换为 URL 友好的 slug
 * 支持中文、英文、数字，并将连续的非合法字符压缩为单个连字符
 */
export function normalizeTagSlug(raw: string): string {
  const trimmed = raw.trim().toLowerCase()
  if (!trimmed) {
    return generateRandomSlug()
  }

  const strict = trimmed
    .replace(/[^a-z0-9\u4e00-\u9fa5]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")

  if (strict) {
    return strict
  }

  const relaxed = trimmed
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")

  if (relaxed) {
    return relaxed
  }

  return generateRandomSlug()
}
