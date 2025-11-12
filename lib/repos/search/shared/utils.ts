/**
 * 搜索模块共享工具函数
 * Phase 11 / M2 / T2.1 - 代码组织优化
 */

/**
 * 归一化分页限制参数
 * @param value - 用户提供的限制值
 * @param fallback - 默认值
 * @returns 归一化后的限制值
 */
export const normalizeLimit = (value: number | undefined, fallback: number): number =>
  Number.isFinite(value) && (value as number) > 0 ? Math.trunc(value as number) : fallback

/**
 * 归一化分页偏移参数
 * @param value - 用户提供的偏移值
 * @returns 归一化后的偏移值
 */
export const normalizeOffset = (value: number | undefined): number =>
  Number.isFinite(value) && (value as number) >= 0 ? Math.trunc(value as number) : 0

/**
 * 转义 ILIKE 模式中的特殊字符，并构造包裹%的模式
 */
export const buildILikePattern = (value: string): string => {
  const escaped = value.replace(/[%_\\]/g, (match) => `\\${match}`)
  return `%${escaped}%`
}
