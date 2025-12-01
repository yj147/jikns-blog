const TAG_REGEX = /<[^>]+>/g
const CHINESE_CHAR_REGEX = /[\u4e00-\u9fa5]/g
const ENGLISH_WORD_REGEX = /[A-Za-z]+(?:'[A-Za-z]+)?/g
const UNITS_PER_MINUTE = 300

/**
 * 计算阅读时间（支持中英文混合）。
 * 算法： (中文字符数 + 英文单词数) / 300，向上取整，最小值 1。
 */
export function calculateReadingMinutes(content?: string | number | null): number {
  if (content === null || content === undefined) {
    return 1
  }

  if (typeof content === "number") {
    return Math.max(1, Math.ceil(content / UNITS_PER_MINUTE))
  }

  const text = content.replace(TAG_REGEX, " ").trim()
  if (!text) {
    return 1
  }

  const chineseChars = text.match(CHINESE_CHAR_REGEX)?.length ?? 0
  const englishWords = text.match(ENGLISH_WORD_REGEX)?.length ?? 0
  const totalUnits = chineseChars + englishWords

  if (totalUnits === 0) {
    return 1
  }

  return Math.max(1, Math.ceil(totalUnits / UNITS_PER_MINUTE))
}
