/**
 * Realtime Likes Hook
 * 实时订阅点赞变更
 */

import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase"
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js"
import { logger } from "@/lib/utils/logger"

interface Like {
  id: string
  authorId: string
  postId: string | null
  activityId: string | null
  createdAt: string
}

interface UseRealtimeLikesOptions {
  targetType: "post" | "activity"
  targetId: string
  enabled?: boolean
  onLike?: (like: Like) => void
  onUnlike?: (likeId: string) => void
}

/**
 * 订阅点赞实时更新
 *
 * @example
 * ```tsx
 * const { likesCount } = useRealtimeLikes({
 *   targetType: 'post',
 *   targetId: postId,
 *   onLike: () => setLikesCount(prev => prev + 1),
 *   onUnlike: () => setLikesCount(prev => prev - 1),
 * })
 * ```
 */
export function useRealtimeLikes({
  targetType,
  targetId,
  enabled = true,
  onLike,
  onUnlike,
}: UseRealtimeLikesOptions) {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // 使用 ref 存储回调，避免它们触发 effect 重新执行
  const onLikeRef = useRef(onLike)
  const onUnlikeRef = useRef(onUnlike)

  useEffect(() => {
    onLikeRef.current = onLike
    onUnlikeRef.current = onUnlike
  }, [onLike, onUnlike])

  useEffect(() => {
    if (!enabled || !targetId) {
      return
    }

    const supabase = createClient()
    const channelName = `likes:${targetType}:${targetId}`
    const filterField = targetType === "post" ? "postId" : "activityId"

    logger.info("订阅点赞实时更新", {
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
          table: "likes",
          filter: `${filterField}=eq.${targetId}`,
        },
        (payload: RealtimePostgresChangesPayload<Like>) => {
          const newLike = (payload.new ?? null) as Like | null
          const oldLike = (payload.old ?? null) as Like | null

          logger.debug("收到点赞变更", {
            event: payload.eventType,
            likeId: newLike?.id || oldLike?.id,
          })

          try {
            if (payload.eventType === "INSERT" && newLike) {
              onLikeRef.current?.(newLike)
            } else if (payload.eventType === "DELETE" && oldLike?.id) {
              onUnlikeRef.current?.(oldLike.id)
            }
          } catch (err) {
            logger.error("处理点赞变更失败", { event: payload.eventType }, err)
            setError(err instanceof Error ? err : new Error("Unknown error"))
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setIsSubscribed(true)
          logger.info("点赞订阅成功", { channelName })
        } else if (status === "CHANNEL_ERROR") {
          setIsSubscribed(false)
          setError(new Error("Failed to subscribe to likes"))
          logger.error("点赞订阅失败", { channelName, status })
        }
      })

    return () => {
      logger.info("取消订阅点赞", { channelName })
      supabase.removeChannel(channel)
      setIsSubscribed(false)
    }
  }, [targetType, targetId, enabled])

  return {
    isSubscribed,
    error,
  }
}
