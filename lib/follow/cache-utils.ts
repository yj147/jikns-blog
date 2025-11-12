/**
 * 关注系统缓存工具函数
 *
 * 提供 SWR 缓存刷新相关的纯函数工具，包括：
 * - Key 指纹计算（用于去重）
 * - 缓存目标构建（合并默认匹配器和自定义 Key）
 *
 * 这些函数是纯函数，便于单元测试和复用
 */

import type { Key } from "swr"

/**
 * 规范化对象用于指纹计算
 * 递归处理对象和数组，确保相同内容的对象生成相同指纹
 */
const normaliseForFingerprint = (value: any): any => {
  if (Array.isArray(value)) {
    return value.map(normaliseForFingerprint)
  }
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, any>>((acc, key) => {
        acc[key] = normaliseForFingerprint(value[key])
        return acc
      }, {})
  }
  return value
}

/**
 * 为 SWR Key 生成唯一指纹
 *
 * 支持的 Key 类型：
 * - string, number, boolean, bigint: 直接序列化
 * - Array: 递归规范化后 JSON 序列化
 * - Object: 递归规范化后 JSON 序列化
 * - null/undefined: 返回 "null"
 *
 * @param key - SWR 缓存 Key
 * @returns 唯一指纹字符串，失败返回 null
 */
export const fingerprintKey = (key: Key): string | null => {
  if (key === null || key === undefined) {
    return "null"
  }
  if (typeof key === "string") {
    return `string:${key}`
  }
  if (typeof key === "number" || typeof key === "boolean" || typeof key === "bigint") {
    return `${typeof key}:${String(key)}`
  }
  if (Array.isArray(key)) {
    return `array:${JSON.stringify(normaliseForFingerprint(key))}`
  }
  if (typeof key === "object") {
    try {
      return `object:${JSON.stringify(normaliseForFingerprint(key))}`
    } catch {
      return null
    }
  }
  return null
}

/**
 * 构建去重后的缓存刷新目标列表
 *
 * 合并策略：
 * 1. 先添加默认匹配器（来自 DEFAULT_FOLLOW_MUTATE_MATCHERS）
 * 2. 再添加自定义匹配器（matcherOverrides）
 * 3. 最后添加具体 Key（cacheKeys），但跳过已被匹配器覆盖的 Key
 *
 * 去重逻辑：
 * - 匹配器通过引用去重（Set）
 * - Key 通过指纹去重（Set<string>）
 * - 如果 Key 已被某个匹配器覆盖，则跳过该 Key
 *
 * @param cacheKeys - 需要刷新的具体缓存 Key 列表
 * @param matcherOverrides - 自定义匹配器函数列表
 * @param defaultMatchers - 默认匹配器列表（通常来自 DEFAULT_FOLLOW_MUTATE_MATCHERS）
 * @returns 去重后的缓存刷新目标（匹配器 + Key）
 */
export const buildMutateTargets = (
  cacheKeys: Key[],
  matcherOverrides: ((key: Key) => boolean)[],
  defaultMatchers: Array<Key | ((key: Key) => boolean)>
): Array<Key | ((key: Key) => boolean)> => {
  const matcherSet = new Set<(key: Key) => boolean>()
  const matcherList: ((key: Key) => boolean)[] = []
  const keyFingerprints = new Set<string>()
  const uniqueKeys: Key[] = []

  const addMatcher = (matcher: (key: Key) => boolean) => {
    if (matcherSet.has(matcher)) return
    matcherSet.add(matcher)
    matcherList.push(matcher)
  }

  const isCoveredByMatcher = (key: Key) =>
    matcherList.some((matcher) => {
      try {
        return matcher(key)
      } catch {
        return false
      }
    })

  const addKey = (key: Key) => {
    const fingerprint = fingerprintKey(key)
    if (fingerprint && keyFingerprints.has(fingerprint)) {
      return
    }
    if (isCoveredByMatcher(key)) {
      return
    }
    if (fingerprint) {
      keyFingerprints.add(fingerprint)
    }
    uniqueKeys.push(key)
  }

  // 1. 添加默认匹配器和 Key
  for (const candidate of defaultMatchers) {
    if (typeof candidate === "function") {
      addMatcher(candidate as (key: Key) => boolean)
    } else {
      addKey(candidate)
    }
  }

  // 2. 添加自定义匹配器
  for (const matcher of matcherOverrides) {
    addMatcher(matcher)
  }

  // 3. 添加具体 Key（跳过已被匹配器覆盖的）
  for (const key of cacheKeys) {
    addKey(key)
  }

  return [...matcherList, ...uniqueKeys]
}
