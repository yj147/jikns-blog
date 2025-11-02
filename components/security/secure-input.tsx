/**
 * 安全输入组件
 * Phase 4.1 安全性增强 - 集成 XSS 防护的输入组件
 */

"use client"

import { useState, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { XSSProtection } from "@/lib/security"
import { AlertTriangle } from "lucide-react"

interface SecureInputProps {
  /**
   * 输入类型
   */
  type?: "text" | "email" | "password" | "textarea"
  /**
   * 输入值
   */
  value: string
  /**
   * 值变化回调
   */
  onChange: (value: string) => void
  /**
   * 占位符
   */
  placeholder?: string
  /**
   * 是否必填
   */
  required?: boolean
  /**
   * 是否启用 HTML 清理
   */
  sanitizeHTML?: boolean
  /**
   * 最大长度
   */
  maxLength?: number
  /**
   * 自定义类名
   */
  className?: string
  /**
   * 是否禁用
   */
  disabled?: boolean
  /**
   * 输入验证失败时的回调
   */
  onValidationError?: (error: string) => void
}

/**
 * 安全输入组件
 * 自动检测和防护 XSS 攻击
 */
export function SecureInput({
  type = "text",
  value,
  onChange,
  placeholder,
  required = false,
  sanitizeHTML = false,
  maxLength = 1000,
  className,
  disabled = false,
  onValidationError,
}: SecureInputProps) {
  const [validationError, setValidationError] = useState<string>("")
  const [isValidating, setIsValidating] = useState(false)

  /**
   * 处理输入变化
   */
  const handleChange = useCallback(
    (inputValue: string) => {
      setIsValidating(true)
      setValidationError("")

      try {
        // 1. 长度检查
        if (inputValue.length > maxLength) {
          throw new Error(`输入内容不能超过 ${maxLength} 个字符`)
        }

        // 2. XSS 检测和清理
        let cleanValue = inputValue

        if (sanitizeHTML || type === "textarea") {
          const sanitized = XSSProtection.validateAndSanitizeInput(inputValue)

          if (sanitized === null) {
            throw new Error("输入内容包含无效字符")
          }

          cleanValue = sanitized

          // 如果清理后的内容与原内容不同，说明有可疑内容被过滤
          if (cleanValue !== inputValue) {
            console.warn("输入内容被安全过滤")
          }
        }

        // 3. 基础验证
        if (type === "email") {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
          if (cleanValue && !emailRegex.test(cleanValue)) {
            throw new Error("请输入有效的邮箱地址")
          }
        }

        onChange(cleanValue)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "输入验证失败"
        setValidationError(errorMessage)
        onValidationError?.(errorMessage)
      } finally {
        setIsValidating(false)
      }
    },
    [onChange, maxLength, sanitizeHTML, type, onValidationError]
  )

  const inputProps = {
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      handleChange(e.target.value),
    placeholder,
    required,
    disabled: disabled || isValidating,
    className: `${className || ""} ${validationError ? "border-red-500" : ""}`,
    maxLength,
  }

  return (
    <div className="w-full">
      {type === "textarea" ? (
        <Textarea {...inputProps} rows={4} />
      ) : (
        <Input type={type} {...inputProps} />
      )}

      {/* 验证错误提示 */}
      {validationError && (
        <div className="mt-2 flex items-center gap-2 text-sm text-red-600">
          <AlertTriangle className="h-4 w-4" />
          <span>{validationError}</span>
        </div>
      )}

      {/* 验证状态指示器 */}
      {isValidating && <div className="mt-2 text-sm text-gray-500">正在验证输入内容...</div>}

      {/* 字符计数 */}
      <div className="mt-1 text-right text-xs text-gray-400">
        {value.length} / {maxLength}
      </div>
    </div>
  )
}

/**
 * 安全文本显示组件
 * 安全地显示用户生成的内容
 */
interface SecureTextProps {
  /**
   * 要显示的内容
   */
  content: string
  /**
   * 是否允许 HTML
   */
  allowHTML?: boolean
  /**
   * 自定义类名
   */
  className?: string
}

export function SecureText({ content, allowHTML = false, className }: SecureTextProps) {
  // 如果允许 HTML，使用 DOMPurify 清理
  const safeContent = allowHTML
    ? XSSProtection.sanitizeHTML(content)
    : XSSProtection.escapeHTML(content)

  if (allowHTML) {
    return <div className={className} dangerouslySetInnerHTML={{ __html: safeContent }} />
  }

  return <div className={className}>{safeContent}</div>
}
