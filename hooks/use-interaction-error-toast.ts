/**
 * 交互错误处理 Toast Hook
 *
 * 统一处理点赞、收藏等交互功能的错误提示，避免重复代码。
 *
 * 修复说明：
 * - 从字符串匹配改为基于 FetchError.statusCode 的结构化判断
 * - 使用 TypeScript 类型守卫确保类型安全
 * - 避免误判（如消息中恰好包含 "401" 的其他错误）
 *
 * @example
 * ```tsx
 * const handleToggleError = useInteractionErrorToast("点赞")
 *
 * try {
 *   await toggleLike()
 * } catch (error) {
 *   handleToggleError(error)
 * }
 * ```
 */

"use client"

import { useCallback } from "react"
import { useToast } from "@/hooks/use-toast"
import { FetchError } from "@/lib/api/fetch-json"

/**
 * 创建交互错误处理函数
 *
 * @param targetLabel - 操作目标的标签（如"点赞"、"收藏"）
 * @returns 错误处理函数
 */
export function useInteractionErrorToast(targetLabel: string) {
  const { toast } = useToast()

  return useCallback(
    (error: unknown) => {
      // 处理 FetchError（结构化错误）
      if (error instanceof FetchError) {
        // 401 未认证
        if (error.statusCode === 401) {
          toast({
            title: "需要登录",
            description: `请先登录后再${targetLabel}`,
            variant: "destructive",
          })
          return
        }

        // 网络错误（status 0）
        if (error.statusCode === 0) {
          toast({
            title: "网络错误",
            description: "请检查网络连接后重试",
            variant: "destructive",
          })
          return
        }

        // 其他 HTTP 错误
        toast({
          title: `${targetLabel}失败`,
          description: error.message || `HTTP ${error.statusCode}`,
          variant: "destructive",
        })
        return
      }

      // 处理其他错误（非 FetchError）
      toast({
        title: `${targetLabel}失败`,
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      })
    },
    [targetLabel, toast]
  )
}
