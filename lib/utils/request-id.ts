/**
 * 请求 ID 生成工具
 * 统一的请求 ID 生成实现，消除重复代码
 *
 * Linus 原则：单一事实来源 (Single Source of Truth)
 * 之前在三个地方重复实现，现在统一到这里
 */

/**
 * 生成唯一的请求 ID（CUID 风格）
 *
 * Edge Runtime 友好：仅依赖 Web Crypto，无需 Node 内置模块。
 * 输出格式：以 "c" 开头，后跟 24 个 [a-z0-9] 字符，匹配常见 CUID 校验规则。
 */
export function generateRequestId(): string {
  const fallback = () => {
    const randomPart = Math.random().toString(36).slice(2).padEnd(24, "0").slice(0, 24)
    return `c${randomPart}`
  }

  if (typeof crypto === "undefined") {
    return fallback()
  }

  // 优先使用 randomUUID，并截断为 24 个字符保证固定长度
  if (typeof crypto.randomUUID === "function") {
    const uuid = crypto.randomUUID().replace(/-/g, "")
    return `c${uuid.slice(0, 24)}`
  }

  if (typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(24)
    crypto.getRandomValues(bytes)
    const randomPart = Array.from(bytes, (byte) => (byte % 36).toString(36)).join("")
    return `c${randomPart.slice(0, 24)}`
  }

  return fallback()
}
