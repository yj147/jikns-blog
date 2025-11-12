/**
 * 智能 Slug 生成器 - 支持中文自动翻译成英文
 */

import { logger } from "./logger"

const translate = require("@vitalets/google-translate-api")

/**
 * 检测文本是否包含中文字符
 */
function containsChinese(text: string): boolean {
  return /[\u4e00-\u9fa5]/.test(text)
}

/**
 * 将文本翻译成英文（如果包含中文）
 */
async function translateToEnglish(text: string): Promise<string> {
  try {
    // 如果不包含中文，直接返回原文
    if (!containsChinese(text)) {
      return text
    }

    // 使用 Google 翻译 API 进行翻译
    const result = await translate(text, { to: "en" })
    return result.text
  } catch (error) {
    logger.warn("翻译失败，使用原文", {
      module: "slug-translator",
      error: error instanceof Error ? error.message : String(error),
    })
    // 翻译失败时返回原文
    return text
  }
}

/**
 * 生成英文 slug
 */
function generateEnglishSlug(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      // 移除特殊字符，保留字母、数字、空格和连字符
      .replace(/[^\w\s-]/g, "")
      // 将多个空格替换为单个连字符
      .replace(/\s+/g, "-")
      // 将多个连字符替换为单个连字符
      .replace(/-+/g, "-")
      // 移除开头和结尾的连字符
      .replace(/^-+|-+$/g, "")
  )
}

/**
 * 智能生成 slug - 自动将中文翻译成英文
 * @param text 原始文本（可以是中文、英文或混合）
 * @param maxLength 最大长度（默认 60）
 * @returns 英文 slug
 */
export async function createSmartSlug(text: string, maxLength: number = 60): Promise<string> {
  // 翻译成英文（如果需要）
  const englishText = await translateToEnglish(text)

  // 生成 slug
  let slug = generateEnglishSlug(englishText)

  // 限制长度（在单词边界处截断）
  if (slug.length > maxLength) {
    slug = slug.substring(0, maxLength)
    // 在最后一个完整单词处截断
    const lastDash = slug.lastIndexOf("-")
    if (lastDash > 0) {
      slug = slug.substring(0, lastDash)
    }
  }

  return slug
}

/**
 * 创建唯一的智能 slug（带去重逻辑）
 */
export async function createUniqueSmartSlug(
  text: string,
  checkExists: (slug: string) => Promise<boolean>,
  maxLength: number = 60
): Promise<string> {
  const baseSlug = await createSmartSlug(text, maxLength)

  if (!baseSlug) {
    throw new Error("无法生成有效的 slug")
  }

  let slug = baseSlug
  let counter = 1

  // 检查是否存在，如果存在则添加数字后缀
  while (await checkExists(slug)) {
    counter++
    const suffix = `-${counter}`
    const maxBaseLength = maxLength - suffix.length

    if (baseSlug.length > maxBaseLength) {
      slug = baseSlug.substring(0, maxBaseLength) + suffix
    } else {
      slug = baseSlug + suffix
    }
  }

  return slug
}

/**
 * 批量生成唯一的智能 slug
 */
export async function createUniqueSmartSlugs(
  texts: string[],
  checkExists: (slug: string) => Promise<boolean>,
  maxLength: number = 60
): Promise<string[]> {
  const results: string[] = []
  const usedSlugs = new Set<string>()

  for (const text of texts) {
    const baseSlug = await createSmartSlug(text, maxLength)

    if (!baseSlug) {
      results.push("")
      continue
    }

    let slug = baseSlug
    let counter = 1

    // 检查本地集合和数据库
    while (usedSlugs.has(slug) || (await checkExists(slug))) {
      counter++
      const suffix = `-${counter}`
      const maxBaseLength = maxLength - suffix.length

      if (baseSlug.length > maxBaseLength) {
        slug = baseSlug.substring(0, maxBaseLength) + suffix
      } else {
        slug = baseSlug + suffix
      }
    }

    usedSlugs.add(slug)
    results.push(slug)
  }

  return results
}
