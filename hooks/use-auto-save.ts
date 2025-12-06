"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useDebounce } from "@/hooks/use-debounce"

export interface UseAutoSaveOptions<T> {
  /** 自动保存数据 */
  data: T
  /** 保存函数 */
  onSave: (data: T) => Promise<void>
  /** 延迟时间（毫秒），默认 2000ms */
  delay?: number
  /** 是否启用自动保存，默认 true */
  enabled?: boolean
  /** 忽略的字段列表（这些字段变化时不触发自动保存） */
  ignoreKeys?: (keyof T)[]
}

export interface UseAutoSaveReturn {
  /** 是否正在保存 */
  isSaving: boolean
  /** 手动触发保存 */
  triggerSave: () => Promise<void>
  /** 最后保存时间 */
  lastSavedAt: Date | null
}

/**
 * 自动保存 Hook
 *
 * 用于实现表单数据的自动保存功能
 * 支持防抖延迟、手动保存、忽略特定字段等特性
 */
export function useAutoSave<T extends Record<string, any>>({
  data,
  onSave,
  delay = 2000,
  enabled = true,
  ignoreKeys = [],
}: UseAutoSaveOptions<T>): UseAutoSaveReturn {
  const isSavingRef = useRef(false)
  const lastSavedAtRef = useRef<Date | null>(null)
  const lastSavedDataRef = useRef<T | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)

  // 创建过滤后的数据（忽略指定字段）
  const filteredData = useCallback(() => {
    if (ignoreKeys.length === 0) return data

    const filtered = { ...data }
    ignoreKeys.forEach((key) => {
      delete filtered[key]
    })
    return filtered
  }, [data, ignoreKeys])

  // 防抖处理
  const debouncedData = useDebounce(filteredData(), delay)

  // 手动触发保存
  const triggerSave = useCallback(async () => {
    if (isSavingRef.current) return

    try {
      isSavingRef.current = true
      setIsSaving(true)
      await onSave(data)
      const savedAt = new Date()
      lastSavedAtRef.current = savedAt
      setLastSavedAt(savedAt)
      lastSavedDataRef.current = { ...data }
    } catch (error) {
      console.error("自动保存失败:", error)
      throw error
    } finally {
      isSavingRef.current = false
      setIsSaving(false)
    }
  }, [data, onSave])

  // 检查数据是否有变化
  const hasDataChanged = useCallback(() => {
    if (!lastSavedDataRef.current) return true

    const currentFiltered = filteredData()
    const lastSavedFiltered = { ...lastSavedDataRef.current }
    ignoreKeys.forEach((key) => {
      delete lastSavedFiltered[key]
    })

    return JSON.stringify(currentFiltered) !== JSON.stringify(lastSavedFiltered)
  }, [filteredData, ignoreKeys])

  // 自动保存效果
  useEffect(() => {
    if (!enabled || !hasDataChanged()) {
      return
    }

    triggerSave().catch(() => {
      // 错误已在 triggerSave 中处理
    })
  }, [debouncedData, enabled, hasDataChanged, triggerSave])

  return {
    isSaving,
    triggerSave,
    lastSavedAt,
  }
}
