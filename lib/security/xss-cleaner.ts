/**
 * XSS 清理增强 - Phase 4 安全增强
 * 提供更高级的XSS防护、内容验证和输入清理功能
 */

import type {
  SanitizeOptions,
  ContentValidationRule,
  SecurityValidationResult,
  XSSConfig,
} from "./types"
import { logger } from "../utils/logger"

/**
 * 高级XSS清理器
 */
export class AdvancedXSSCleaner {
  private static readonly DEFAULT_CONFIG: XSSConfig = {
    allowedTags: [
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
      "span",
      "div",
    ],
    allowedAttributes: ["href", "title", "target", "class", "id"],
    forbiddenTags: [
      "script",
      "object",
      "embed",
      "iframe",
      "form",
      "input",
      "button",
      "textarea",
      "select",
      "option",
      "meta",
      "link",
      "style",
    ],
    forbiddenAttributes: [
      "onload",
      "onerror",
      "onclick",
      "onmouseover",
      "onmouseout",
      "onchange",
      "onsubmit",
      "onfocus",
      "onblur",
      "onkeyup",
      "onkeydown",
      "onkeypress",
      "onabort",
      "oncanplay",
      "oncanplaythrough",
    ],
    maxInputLength: 50000,
    strictMode: process.env.NODE_ENV === "production",
  }

  /**
   * 深度HTML清理
   */
  static deepSanitizeHTML(input: string, options?: Partial<SanitizeOptions>): string {
    const opts: SanitizeOptions = {
      allowHtml: true,
      removeScripts: true,
      removeStyles: true,
      removeLinks: false,
      maxLength: this.DEFAULT_CONFIG.maxInputLength,
      ...options,
    }

    let cleaned = input

    try {
      // 1. 长度检查
      if (opts.maxLength && cleaned.length > opts.maxLength) {
        logger.warn("输入内容超过最大长度限制", {
          module: "AdvancedXSSCleaner",
          actualLength: cleaned.length,
          maxLength: opts.maxLength,
        })
        cleaned = cleaned.substring(0, opts.maxLength) + "..."
      }

      // 2. 移除危险的脚本标签
      if (opts.removeScripts) {
        cleaned = this.removeScriptTags(cleaned)
      }

      // 3. 移除样式相关内容
      if (opts.removeStyles) {
        cleaned = this.removeStyleContent(cleaned)
      }

      // 4. 移除链接（如果需要）
      if (opts.removeLinks) {
        cleaned = this.removeLinks(cleaned)
      }

      // 5. 清理事件处理器
      cleaned = this.removeEventHandlers(cleaned)

      // 6. 清理危险属性
      cleaned = this.removeDangerousAttributes(cleaned)

      // 7. 清理危险协议
      cleaned = this.sanitizeProtocols(cleaned)

      // 8. 应用自定义过滤器
      if (opts.customFilters) {
        for (const filter of opts.customFilters) {
          cleaned = filter(cleaned)
        }
      }

      // 9. 最终验证
      const validation = this.validateCleanedContent(cleaned)
      if (!validation.isValid) {
        logger.warn("清理后的内容仍包含危险元素", {
          module: "AdvancedXSSCleaner",
          error: validation.errorMessage,
        })
        return this.fallbackSanitization(input)
      }

      return cleaned
    } catch (error) {
      logger.error("XSS 清理过程出错", { module: "AdvancedXSSCleaner" }, error)
      return this.fallbackSanitization(input)
    }
  }

  /**
   * 移除脚本标签
   */
  private static removeScriptTags(input: string): string {
    // 移除标准script标签
    let cleaned = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")

    // 移除自闭合script标签
    cleaned = cleaned.replace(/<script\b[^>]*\/>/gi, "")

    // 移除内联脚本
    cleaned = cleaned.replace(/javascript:/gi, "blocked:")
    cleaned = cleaned.replace(/vbscript:/gi, "blocked:")

    // 移除data URL中的脚本
    cleaned = cleaned.replace(/data:[^;]*;[^,]*,.*?(?=["'>\s])/gi, (match) => {
      if (match.toLowerCase().includes("script")) {
        return "data:text/plain;base64,"
      }
      return match
    })

    return cleaned
  }

  /**
   * 移除样式内容
   */
  private static removeStyleContent(input: string): string {
    let cleaned = input

    // 移除style标签
    cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")

    // 移除内联样式中的危险内容
    cleaned = cleaned.replace(/style\s*=\s*["'][^"']*["']/gi, (match) => {
      const styleContent = match.toLowerCase()
      const dangerousPatterns = [
        "expression",
        "javascript:",
        "vbscript:",
        "mocha:",
        "livescript:",
        "@import",
        "binding:",
        "behavior:",
      ]

      if (dangerousPatterns.some((pattern) => styleContent.includes(pattern))) {
        return "" // 移除整个style属性
      }
      return match
    })

    return cleaned
  }

  /**
   * 移除链接
   */
  private static removeLinks(input: string): string {
    return input.replace(/<a\b[^>]*>.*?<\/a>/gi, (match) => {
      return match.replace(/<\/?a[^>]*>/gi, "")
    })
  }

  /**
   * 移除事件处理器
   */
  private static removeEventHandlers(input: string): string {
    const eventPatterns = [/\son\w+\s*=\s*["'][^"']*["']/gi, /\son\w+\s*=\s*[^>\s]+/gi]

    let cleaned = input
    for (const pattern of eventPatterns) {
      cleaned = cleaned.replace(pattern, "")
    }

    return cleaned
  }

  /**
   * 移除危险属性
   */
  private static removeDangerousAttributes(input: string): string {
    const dangerousAttrs = this.DEFAULT_CONFIG.forbiddenAttributes
    let cleaned = input

    for (const attr of dangerousAttrs) {
      const pattern = new RegExp(`\\s${attr}\\s*=\\s*["'][^"']*["']`, "gi")
      cleaned = cleaned.replace(pattern, "")
    }

    return cleaned
  }

  /**
   * 清理协议
   */
  private static sanitizeProtocols(input: string): string {
    const dangerousProtocols = [
      "javascript:",
      "vbscript:",
      "mocha:",
      "livescript:",
      "data:text/html",
      "data:application/",
    ]

    let cleaned = input
    for (const protocol of dangerousProtocols) {
      const pattern = new RegExp(protocol, "gi")
      cleaned = cleaned.replace(pattern, "blocked:")
    }

    return cleaned
  }

  /**
   * 验证清理后的内容
   */
  private static validateCleanedContent(content: string): SecurityValidationResult {
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /vbscript:/i,
      /on\w+\s*=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
      /expression\s*\(/i,
    ]

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(content)) {
        return {
          isValid: false,
          errorCode: "DANGEROUS_CONTENT_DETECTED",
          errorMessage: `检测到危险模式: ${pattern.toString()}`,
        }
      }
    }

    return { isValid: true }
  }

  /**
   * 回退清理方案
   */
  private static fallbackSanitization(input: string): string {
    // 极端情况下的简单清理
    return input
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;")
      .replace(/\//g, "&#x2F;")
  }
}

/**
 * 内容验证器
 */
export class ContentValidator {
  private static readonly validationRules: ContentValidationRule[] = [
    {
      name: "script_injection",
      validate: (input: string) =>
        !/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/i.test(input),
      errorMessage: "检测到脚本注入尝试",
      severity: "critical",
    },
    {
      name: "event_handler_injection",
      validate: (input: string) => !/on\w+\s*=/i.test(input),
      errorMessage: "检测到事件处理器注入",
      severity: "high",
    },
    {
      name: "javascript_protocol",
      validate: (input: string) => !/javascript:/i.test(input),
      errorMessage: "检测到JavaScript协议",
      severity: "high",
    },
    {
      name: "iframe_injection",
      validate: (input: string) => !/<iframe/i.test(input),
      errorMessage: "检测到iframe注入",
      severity: "high",
    },
    {
      name: "form_injection",
      validate: (input: string) => !/<form/i.test(input),
      errorMessage: "检测到表单注入",
      severity: "medium",
    },
    {
      name: "css_expression",
      validate: (input: string) => !/expression\s*\(/i.test(input),
      errorMessage: "检测到CSS表达式注入",
      severity: "medium",
    },
  ]

  /**
   * 验证内容安全性
   */
  static validateContent(content: string): SecurityValidationResult {
    const violations: Array<{ rule: string; severity: string; message: string }> = []

    for (const rule of this.validationRules) {
      if (!rule.validate(content)) {
        violations.push({
          rule: rule.name,
          severity: rule.severity,
          message: rule.errorMessage,
        })
      }
    }

    if (violations.length === 0) {
      return { isValid: true }
    }

    // 检查是否有严重违规
    const hasCriticalViolation = violations.some((v) => v.severity === "critical")

    return {
      isValid: false,
      errorCode: hasCriticalViolation ? "CRITICAL_SECURITY_VIOLATION" : "SECURITY_VIOLATION",
      errorMessage: violations.map((v) => v.message).join("; "),
      data: { violations },
    }
  }

  /**
   * 添加自定义验证规则
   */
  static addValidationRule(rule: ContentValidationRule): void {
    this.validationRules.push(rule)
  }

  /**
   * 批量验证多个内容
   */
  static validateMultipleContent(contents: string[]): SecurityValidationResult[] {
    return contents.map((content) => this.validateContent(content))
  }
}

/**
 * 输入清理器
 */
export class InputSanitizer {
  /**
   * 清理用户输入
   */
  static sanitizeUserInput(
    input: unknown,
    type: "text" | "html" | "email" | "url" | "number" = "text"
  ): string | null {
    if (typeof input !== "string") {
      return null
    }

    try {
      switch (type) {
        case "text":
          return this.sanitizeText(input)

        case "html":
          return AdvancedXSSCleaner.deepSanitizeHTML(input)

        case "email":
          return this.sanitizeEmail(input)

        case "url":
          return this.sanitizeURL(input)

        case "number":
          return this.sanitizeNumber(input)

        default:
          return this.sanitizeText(input)
      }
    } catch (error) {
      logger.error("输入清理错误", { module: "InputSanitizer", type }, error)
      return null
    }
  }

  /**
   * 清理纯文本
   */
  private static sanitizeText(input: string): string {
    return input
      .trim()
      .replace(/[\x00-\x1F\x7F]/g, "") // 移除控制字符
      .replace(/\s+/g, " ") // 规范化空白字符
      .substring(0, 1000) // 限制长度
  }

  /**
   * 清理邮箱
   */
  private static sanitizeEmail(input: string): string | null {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const cleaned = input.trim().toLowerCase()

    if (!emailPattern.test(cleaned)) {
      return null
    }

    return cleaned
  }

  /**
   * 清理URL
   */
  private static sanitizeURL(input: string): string | null {
    try {
      const url = new URL(input.trim())

      // 只允许特定协议
      const allowedProtocols = ["http:", "https:", "mailto:"]
      if (!allowedProtocols.includes(url.protocol)) {
        return null
      }

      return url.toString()
    } catch {
      return null
    }
  }

  /**
   * 清理数字
   */
  private static sanitizeNumber(input: string): string | null {
    const cleaned = input.trim().replace(/[^\d.-]/g, "")
    const num = parseFloat(cleaned)

    if (isNaN(num)) {
      return null
    }

    return num.toString()
  }

  /**
   * 批量清理输入
   */
  static sanitizeMultipleInputs(
    inputs: Array<{ value: unknown; type?: "text" | "html" | "email" | "url" | "number" }>
  ): Array<string | null> {
    return inputs.map(({ value, type = "text" }) => this.sanitizeUserInput(value, type))
  }

  /**
   * 清理对象中的所有字符串属性
   */
  static sanitizeObject<T extends Record<string, unknown>>(
    obj: T,
    rules: Record<keyof T, "text" | "html" | "email" | "url" | "number"> = {} as any
  ): Partial<T> {
    const sanitized: Partial<T> = {}

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "string") {
        const type = rules[key as keyof T] || "text"
        const cleaned = this.sanitizeUserInput(value, type)
        if (cleaned !== null) {
          ;(sanitized as any)[key] = cleaned
        }
      } else {
        ;(sanitized as any)[key] = value
      }
    }

    return sanitized
  }
}

/**
 * 兼容层：提供简单的文本清理函数
 */
export function cleanXSS(input: string): string {
  if (typeof input !== "string") {
    return ""
  }
  return InputSanitizer.sanitizeUserInput(input, "text") ?? ""
}
