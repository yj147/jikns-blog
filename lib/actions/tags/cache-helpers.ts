/**
 * 标签模块缓存失效辅助函数
 * 统一管理缓存失效逻辑，避免在每个 mutation 中重复
 */

import { revalidatePath, revalidateTag } from "next/cache"

/**
 * 失效所有标签相关的缓存
 * 用于创建、更新、删除标签后
 */
export function revalidateTagCaches() {
  revalidatePath("/admin/tags")
  revalidatePath("/tags")
  revalidateTag("tags:list")
  revalidateTag("tags:detail")
}

/**
 * 失效特定标签的详情页缓存
 * @param slug - 标签的 slug
 */
export function revalidateTagDetail(slug: string) {
  if (slug && typeof slug === "string" && slug.trim().length > 0) {
    revalidatePath(`/tags/${slug}`)
  }
}

/**
 * 失效多个标签详情页缓存
 * @param slugs - 标签 slug 数组
 */
export function revalidateTagDetails(slugs: string[]) {
  slugs.forEach((slug) => revalidateTagDetail(slug))
}
