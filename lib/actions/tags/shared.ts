/**
 * 标签模块共享函数
 * 包含 server actions 和纯函数
 */

import { requireAdmin } from "@/lib/permissions"
import { enforceTagRateLimitForUser } from "@/lib/rate-limit/tag-limits"

// 重新导出错误映射函数（这些是纯函数）
export { mapTagRateLimitError, mapTagAuthError, handleTagMutationError } from "./error-mappers"

/**
 * 管理员标签操作统一守卫
 * Server Action
 */
export async function enforceTagMutationGuards() {
  "use server"
  const admin = await requireAdmin()
  await enforceTagRateLimitForUser("mutation", admin.id)
  return admin
}
