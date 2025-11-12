/**
 * 请求 ID 生成工具
 * 统一的请求 ID 生成实现，消除重复代码
 *
 * Linus 原则：单一事实来源 (Single Source of Truth)
 * 之前在三个地方重复实现，现在统一到这里
 */

/**
 * 生成唯一的请求 ID
 *
 * 优先使用 Web Crypto API 的 randomUUID() 生成标准 UUID v4
 * 如果不可用（如某些旧环境），则使用时间戳 + 随机数的 fallback 方案
 *
 * @returns 请求 ID 字符串
 * @example
 * // 标准 UUID v4 格式
 * "550e8400-e29b-41d4-a716-446655440000"
 *
 * // Fallback 格式
 * "req_1704067200000_a1b2c3d4e"
 */
export function generateRequestId(): string {
  // 优先使用标准 UUID v4
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  // Fallback: 时间戳 + 随机数
  const timestamp = Date.now()
  const randomSuffix = Math.random().toString(36).slice(2, 11)
  return `req_${timestamp}_${randomSuffix}`
}
