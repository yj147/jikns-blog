/**
 * 内容清洗和安全处理工具函数
 * 防止 XSS 攻击，处理用户输入内容
 */

import DOMPurify from "isomorphic-dompurify"

export interface ContentSanitizeOptions {
  allowedTags?: string[]
  allowedAttributes?: Record<string, string[]>
  stripTags?: boolean
  maxLength?: number
  allowMarkdown?: boolean
  allowLinks?: boolean
  allowImages?: boolean
}

export interface TextProcessingOptions {
  removeExtraSpaces?: boolean
  trimLines?: boolean
  normalizeLineBreaks?: boolean
  maxLineLength?: number
}

/**
 * 默认允许的 HTML 标签（安全的）
 */
const DEFAULT_ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "u",
  "s",
  "code",
  "pre",
  "blockquote",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "a",
  "img",
]

/**
 * 默认允许的属性
 */
const DEFAULT_ALLOWED_ATTRIBUTES = {
  a: ["href", "title", "target"],
  img: ["src", "alt", "title", "width", "height"],
  blockquote: ["cite"],
  code: ["class"],
  pre: ["class"],
}

/**
 * 清洗 HTML 内容，防止 XSS 攻击
 */
export function sanitizeHtml(content: string, options: ContentSanitizeOptions = {}): string {
  if (!content || typeof content !== "string") {
    return ""
  }

  const {
    allowedTags = DEFAULT_ALLOWED_TAGS,
    allowedAttributes = DEFAULT_ALLOWED_ATTRIBUTES,
    stripTags = false,
    maxLength,
    allowLinks = true,
    allowImages = true,
  } = options

  const config: any = {
    ALLOWED_TAGS: stripTags ? [] : allowedTags,
    ALLOWED_ATTR: allowedAttributes,
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_DOM_IMPORT: false,
    FORBID_SCRIPT: true,
    FORBID_TAGS: ["script", "object", "embed", "style", "form", "input", "button"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur", "style"],
  }

  // 如果不允许链接，移除 a 标签
  if (!allowLinks) {
    config.ALLOWED_TAGS = config.ALLOWED_TAGS.filter((tag: string) => tag !== "a")
    delete config.ALLOWED_ATTR["a"]
  }

  // 如果不允许图片，移除 img 标签
  if (!allowImages) {
    config.ALLOWED_TAGS = config.ALLOWED_TAGS.filter((tag: string) => tag !== "img")
    delete config.ALLOWED_ATTR["img"]
  }

  const sanitized = DOMPurify.sanitize(content, config)

  // 转换为字符串并限制长度
  let result = sanitized.toString()
  if (maxLength && result.length > maxLength) {
    result = truncateHtml(result, maxLength)
  }

  return result
}

/**
 * 清洗纯文本内容
 */
export function sanitizeText(content: string, options: ContentSanitizeOptions = {}): string {
  if (!content || typeof content !== "string") {
    return ""
  }

  const { maxLength } = options

  // 移除所有 HTML 标签
  let cleaned = content.replace(/<[^>]*>/g, "")

  // HTML 实体解码
  cleaned = decodeHtmlEntities(cleaned)

  // 处理文本
  cleaned = processText(cleaned, {
    removeExtraSpaces: true,
    trimLines: true,
    normalizeLineBreaks: true,
  })

  // 限制长度
  if (maxLength && cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength)

    // 在单词边界截断
    const lastSpace = cleaned.lastIndexOf(" ")
    if (lastSpace > 0 && lastSpace > maxLength - 10) {
      cleaned = cleaned.substring(0, lastSpace)
    }

    cleaned += "..."
  }

  return cleaned.trim()
}

/**
 * 处理文本内容
 */
export function processText(text: string, options: TextProcessingOptions = {}): string {
  if (!text || typeof text !== "string") {
    return ""
  }

  const {
    removeExtraSpaces = true,
    trimLines = true,
    normalizeLineBreaks = true,
    maxLineLength,
  } = options

  let processed = text

  // 标准化换行符
  if (normalizeLineBreaks) {
    processed = processed.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  }

  // 移除每行首尾空白
  if (trimLines) {
    processed = processed
      .split("\n")
      .map((line) => line.trim())
      .join("\n")
  }

  // 移除多余空格
  if (removeExtraSpaces) {
    processed = processed
      .replace(/[ \t]+/g, " ") // 合并连续空格和制表符
      .replace(/\n\s*\n/g, "\n\n") // 合并多个空行为两个
      .replace(/^\s+|\s+$/g, "") // 移除首尾空白
  }

  // 限制行长度
  if (maxLineLength && maxLineLength > 0) {
    processed = processed
      .split("\n")
      .map((line) => {
        if (line.length <= maxLineLength) {
          return line
        }

        // 对于很长的字符串（如连续字符），强制分割
        if (!line.includes(" ")) {
          const chunks = []
          for (let i = 0; i < line.length; i += maxLineLength) {
            chunks.push(line.substring(i, i + maxLineLength))
          }
          return chunks.join("\n")
        }

        // 在单词边界换行
        const words = line.split(" ")
        const lines: string[] = []
        let currentLine = ""

        for (const word of words) {
          const testLine = currentLine + (currentLine ? " " : "") + word
          if (testLine.length <= maxLineLength) {
            currentLine = testLine
          } else {
            if (currentLine) {
              lines.push(currentLine)
            }
            // 如果单个单词超过限制，也需要分割
            if (word.length > maxLineLength) {
              for (let i = 0; i < word.length; i += maxLineLength) {
                lines.push(word.substring(i, i + maxLineLength))
              }
              currentLine = ""
            } else {
              currentLine = word
            }
          }
        }

        if (currentLine) {
          lines.push(currentLine)
        }

        return lines.join("\n")
      })
      .join("\n")
  }

  return processed
}

/**
 * 解码 HTML 实体
 */
export function decodeHtmlEntities(text: string): string {
  if (!text || typeof text !== "string") {
    return ""
  }

  const entityMap: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#x27;": "'",
    "&#x2F;": "/",
    "&#x60;": "`",
    "&#x3D;": "=",
  }

  return text.replace(/&[a-zA-Z0-9#]+;/g, (entity) => {
    return entityMap[entity] || entity
  })
}

/**
 * 编码 HTML 实体
 */
export function encodeHtmlEntities(text: string): string {
  if (!text || typeof text !== "string") {
    return ""
  }

  const entityMap: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
    "/": "&#x2F;",
    "`": "&#x60;",
    "=": "&#x3D;",
  }

  return text.replace(/[&<>"'`=\/]/g, (char) => {
    return entityMap[char] || char
  })
}

/**
 * 截断 HTML 内容（保持标签完整性）
 */
export function truncateHtml(html: string, maxLength: number): string {
  if (!html || html.length <= maxLength) {
    return html
  }

  // 简单的标签栈
  const tagStack: string[] = []
  let output = ""
  let currentLength = 0
  let i = 0

  while (i < html.length && currentLength < maxLength) {
    if (html[i] === "<") {
      // 处理标签
      const tagEnd = html.indexOf(">", i)
      if (tagEnd === -1) break

      const tagContent = html.substring(i + 1, tagEnd)
      const isClosingTag = tagContent.startsWith("/")
      const tagName = isClosingTag ? tagContent.substring(1) : tagContent.split(" ")[0]

      if (isClosingTag) {
        // 闭合标签
        const lastTag = tagStack.pop()
        if (lastTag === tagName) {
          output += html.substring(i, tagEnd + 1)
        }
      } else if (tagContent.endsWith("/") || ["br", "hr", "img", "input"].includes(tagName)) {
        // 自闭合标签
        output += html.substring(i, tagEnd + 1)
      } else {
        // 开放标签
        tagStack.push(tagName)
        output += html.substring(i, tagEnd + 1)
      }

      i = tagEnd + 1
    } else {
      // 普通字符
      output += html[i]
      currentLength++
      i++
    }
  }

  // 关闭未闭合的标签
  while (tagStack.length > 0) {
    const tagName = tagStack.pop()
    output += `</${tagName}>`
  }

  if (currentLength >= maxLength) {
    output += "..."
  }

  return output
}

/**
 * 提取纯文本（移除所有 HTML 标签）
 */
export function extractTextFromHtml(html: string): string {
  if (!html || typeof html !== "string") {
    return ""
  }

  // 移除所有 HTML 标签
  let text = html.replace(/<[^>]*>/g, "")

  // 解码 HTML 实体
  text = decodeHtmlEntities(text)

  // 清理空白字符
  text = processText(text, {
    removeExtraSpaces: true,
    trimLines: true,
    normalizeLineBreaks: true,
  })

  return text
}

/**
 * 验证内容安全性
 */
export function validateContentSecurity(content: string): {
  isSafe: boolean
  issues: string[]
} {
  const issues: string[] = []

  if (!content || typeof content !== "string") {
    return { isSafe: true, issues: [] }
  }

  // 检查潜在的脚本注入
  if (/<script/i.test(content)) {
    issues.push("检测到潜在的脚本标签")
  }

  // 检查事件处理器
  if (/on\w+\s*=/i.test(content)) {
    issues.push("检测到潜在的事件处理器")
  }

  // 检查 javascript: 协议
  if (/javascript:/i.test(content)) {
    issues.push("检测到 javascript: 协议")
  }

  // 检查 data: 协议（可能包含恶意内容）
  if (/data:(?!image\/)/i.test(content)) {
    issues.push("检测到可疑的 data: 协议")
  }

  // 检查样式注入
  if (/<style/i.test(content) || /expression\s*\(/i.test(content)) {
    issues.push("检测到潜在的样式注入")
  }

  return {
    isSafe: issues.length === 0,
    issues,
  }
}

/**
 * 生成内容摘要
 */
export function generateExcerpt(
  content: string,
  maxLength: number = 200,
  suffix: string = "..."
): string {
  if (!content || typeof content !== "string") {
    return ""
  }

  // 提取纯文本
  const text = extractTextFromHtml(content)

  if (text.length <= maxLength) {
    return text
  }

  // 在单词边界截断
  const truncated = text.substring(0, maxLength)
  const lastSpace = truncated.lastIndexOf(" ")

  const excerpt =
    lastSpace > 0 && lastSpace > maxLength - 20 ? truncated.substring(0, lastSpace) : truncated

  return excerpt + suffix
}

/**
 * 计算阅读时间（分钟）
 */
export function estimateReadingTime(content: string, wordsPerMinute: number = 200): number {
  if (!content || typeof content !== "string") {
    return 0
  }

  const text = extractTextFromHtml(content)

  // 中文按字符计算，英文按单词计算
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length
  const englishWords = text
    .replace(/[\u4e00-\u9fa5]/g, "")
    .split(/\s+/)
    .filter((word) => word.length > 0).length

  // 中文：每分钟250字符，英文：每分钟200单词
  const chineseTime = chineseChars / 250
  const englishTime = englishWords / wordsPerMinute

  return Math.ceil(Math.max(chineseTime + englishTime, 1))
}

/**
 * 检测内容语言
 */
export function detectContentLanguage(content: string): "zh" | "en" | "mixed" {
  if (!content || typeof content !== "string") {
    return "en"
  }

  const text = extractTextFromHtml(content)
  const totalChars = text.length

  if (totalChars === 0) {
    return "en"
  }

  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length
  const chineseRatio = chineseChars / totalChars

  if (chineseRatio > 0.8) {
    return "zh"
  } else if (chineseRatio < 0.1) {
    return "en"
  } else {
    return "mixed"
  }
}
