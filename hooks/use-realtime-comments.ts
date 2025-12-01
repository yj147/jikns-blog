/**
 * Realtime Comments Hook
 * 实时订阅评论变更
 */

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js"
import type { CommentRealtimePayload, CommentTargetType } from "@/types/comments"
import { logger } from "@/lib/utils/logger"

type RealtimeComment = CommentRealtimePayload

interface UseRealtimeCommentsOptions {
  targetType: CommentTargetType
  targetId: string
  enabled?: boolean
  onInsert?: (comment: RealtimeComment) => void
  onUpdate?: (comment: RealtimeComment) => void
  onDelete?: (commentId: string) => void
}

/**
 * 订阅评论实时更新
 *
 * @example
 * ```tsx
 * const { comments, isSubscribed } = useRealtimeComments({
 *   targetType: 'post',
 *   targetId: postId,
 *   onInsert: (comment) => console.log('新评论:', comment),
 * })
 * ```
 */
export function useRealtimeComments({
  targetType,
  targetId,
  enabled = true,
  onInsert,
  onUpdate,
  onDelete,
}: UseRealtimeCommentsOptions) {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!enabled || !targetId) {
      return
    }

    let supabase: ReturnType<typeof createClient>
    try {
      supabase = createClient()
    } catch (err) {
      // 创建客户端失败直接降级为无实时模式，避免副作用导致组件崩溃
      const message = err instanceof Error ? err.message : "Unknown error"
      logger.error("创建 Supabase 客户端失败，禁用评论实时更新", { message })
      setError(err instanceof Error ? err : new Error(message))
      return
    }

    if (typeof (supabase as any)?.channel !== "function") {
      // 在测试或降级环境下缺少 Realtime 支持时，静默降级并保留评论基础功能
      logger.warn("Supabase 客户端缺少 channel 方法，跳过评论实时订阅")
      setError(new Error("Realtime unavailable in current environment"))
      return
    }

    const channelName = `comments:${targetType}:${targetId}`

    logger.info("订阅评论实时更新", {
      channelName,
      targetType,
      targetId,
    })

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
          filter: `${targetType}Id=eq.${targetId}`,
        },
        async (payload: RealtimePostgresChangesPayload<RealtimeComment>) => {
          const newComment = (payload.new ?? null) as RealtimeComment | null
          const oldComment = (payload.old ?? null) as RealtimeComment | null

          logger.debug("收到评论变更", {
            event: payload.eventType,
            commentId: newComment?.id || oldComment?.id,
          })

          try {
            const fetchFullComment = async (id: string) => {
              const { data, error } = await supabase
                .from("comments")
                .select("*, author:users!comments_authorId_fkey(id,name,avatarUrl,role,status)")
                .eq("id", id)
                .single()

              if (error) {
                logger.warn("查询完整评论失败，使用原始 payload", { id, error })
              }

              return data as RealtimeComment | null
            }

            if (payload.eventType === "INSERT" && newComment) {
              const hydrated = (await fetchFullComment(newComment.id)) ?? newComment
              onInsert?.(hydrated)
            } else if (payload.eventType === "UPDATE" && newComment) {
              const hydrated = (await fetchFullComment(newComment.id)) ?? newComment
              onUpdate?.(hydrated)
            } else if (payload.eventType === "DELETE" && oldComment?.id) {
              onDelete?.(oldComment.id)
            }
          } catch (err) {
            logger.error("处理评论变更失败", { event: payload.eventType }, err)
            setError(err instanceof Error ? err : new Error("Unknown error"))
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setIsSubscribed(true)
          logger.info("评论订阅成功", { channelName })
        } else if (status === "CHANNEL_ERROR") {
          setIsSubscribed(false)
          setError(new Error("Failed to subscribe to comments"))
          logger.error("评论订阅失败", { channelName, status })
        }
      })

    return () => {
      logger.info("取消订阅评论", { channelName })
      supabase.removeChannel(channel)
      setIsSubscribed(false)
    }
  }, [targetType, targetId, enabled, onInsert, onUpdate, onDelete])

  return {
    isSubscribed,
    error,
  }
}
