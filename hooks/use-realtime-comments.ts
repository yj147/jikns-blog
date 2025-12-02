/**
 * Realtime Comments Hook
 * 实时订阅评论变更
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase"
import { createRetryScheduler } from "@/lib/realtime/retry"
import { ensureSessionReady, useNetworkStatus, useOnlineCallback } from "@/lib/realtime/connection"
import type { RealtimeChannel, RealtimePostgresChangesPayload, SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
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
  pollInterval?: number
  pollFetcher?: () => Promise<void>
}

type ConnectionState = "realtime" | "polling" | "disconnected" | "error"

const DEFAULT_POLL_INTERVAL = 10000

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
  pollInterval = DEFAULT_POLL_INTERVAL,
  pollFetcher,
}: UseRealtimeCommentsOptions) {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [isPollingFallback, setIsPollingFallback] = useState(false)
  const [retryToken, setRetryToken] = useState(0)

  const supabaseRef = useRef<SupabaseClient<Database> | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef = useRef(false)
  const retrySchedulerRef = useRef(createRetryScheduler())

  const onInsertRef = useRef(onInsert)
  const onUpdateRef = useRef(onUpdate)
  const onDeleteRef = useRef(onDelete)
  const pollFetcherRef = useRef<(() => Promise<void>) | null>(pollFetcher ?? null)

  const isOnline = useNetworkStatus()

  useEffect(() => {
    onInsertRef.current = onInsert
    onUpdateRef.current = onUpdate
    onDeleteRef.current = onDelete
    pollFetcherRef.current = pollFetcher ?? null
  }, [onInsert, onUpdate, onDelete, pollFetcher])

  const stopPolling = useCallback((skipStateUpdate = false) => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
    if (!skipStateUpdate) {
      setIsPollingFallback(false)
    }
  }, [])

  const startPolling = useCallback(() => {
    if (pollTimerRef.current || !isOnline) {
      setIsPollingFallback(Boolean(pollTimerRef.current))
      return
    }

    setIsPollingFallback(true)

    if (!pollFetcherRef.current) {
      return
    }

    void pollFetcherRef.current()
    pollTimerRef.current = setInterval(() => {
      void pollFetcherRef.current?.()
    }, pollInterval)
  }, [isOnline, pollInterval])

  const clearChannel = useCallback(() => {
    if (channelRef.current && supabaseRef.current) {
      supabaseRef.current.removeChannel(channelRef.current)
    }
    channelRef.current = null
    setIsSubscribed(false)
  }, [])

  useEffect(() => {
    if (!isOnline) {
      clearChannel()
      stopPolling()
    }
  }, [clearChannel, stopPolling, isOnline])

  const triggerRetry = useCallback(() => {
    const delay = retrySchedulerRef.current.schedule(() => {
      setRetryToken((prev) => prev + 1)
    })

    if (delay === null) {
      startPolling()
    }
  }, [startPolling])

  useOnlineCallback(() => {
    retrySchedulerRef.current.reset()
    setRetryToken((prev) => prev + 1)
    if (isPollingFallback) {
      stopPolling()
    }
  })

  useEffect(() => {
    if (!enabled || !targetId) {
      return
    }

    if (!isOnline) {
      return
    }

    mountedRef.current = true

    let canceled = false
    const channelName = `comments:${targetType}:${targetId}`

    const setupRealtime = async () => {
      clearChannel()

      try {
        if (!supabaseRef.current) {
          supabaseRef.current = createClient()
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error"
        logger.error("创建 Supabase 客户端失败，启用轮询降级", { message })
        setError(err instanceof Error ? err : new Error(message))
        startPolling()
        return
      }

      const supabase = supabaseRef.current
      if (!supabase || typeof (supabase as any)?.channel !== "function") {
        logger.warn("Supabase 客户端缺少 channel 方法，跳过评论实时订阅")
        startPolling()
        return
      }

      const sessionReady = await ensureSessionReady(supabase, channelName, false)
      if (canceled || !mountedRef.current) return

      if (!sessionReady) {
        setIsSubscribed(false)
        setError((prev) => prev ?? new Error("Supabase session not ready"))
        triggerRetry()
        return
      }

      setError(null)

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
                const { data, error: fetchError } = await supabase
                  .from("comments")
                  .select("*, author:users!comments_authorId_fkey(id,name,avatarUrl,role,status)")
                  .eq("id", id)
                  .single()

                if (fetchError) {
                  logger.warn("查询完整评论失败，使用原始 payload", { id, error: fetchError })
                }

                return data as RealtimeComment | null
              }

              if (payload.eventType === "INSERT" && newComment) {
                const hydrated = (await fetchFullComment(newComment.id)) ?? newComment
                onInsertRef.current?.(hydrated)
              } else if (payload.eventType === "UPDATE" && newComment) {
                const hydrated = (await fetchFullComment(newComment.id)) ?? newComment
                onUpdateRef.current?.(hydrated)
              } else if (payload.eventType === "DELETE" && oldComment?.id) {
                onDeleteRef.current?.(oldComment.id)
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
            setError(null)
            retrySchedulerRef.current.reset()
            stopPolling()
            logger.info("评论订阅成功", { channelName })
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            setIsSubscribed(false)
            setError(new Error("Failed to subscribe to comments"))
            logger.warn("评论订阅失败，尝试重试", { channelName, status })
            triggerRetry()
          }
        })

      channelRef.current = channel
    }

    void setupRealtime()

    return () => {
      canceled = true
      mountedRef.current = false
      clearChannel()
      stopPolling(true)
    }
  }, [
    clearChannel,
    enabled,
    isOnline,
    pollInterval,
    startPolling,
    stopPolling,
    targetId,
    targetType,
    triggerRetry,
    retryToken,
  ])

  useEffect(() => {
    if (isPollingFallback && pollTimerRef.current) {
      stopPolling()
      startPolling()
    }
  }, [isPollingFallback, pollInterval, startPolling, stopPolling])

  const connectionState: ConnectionState = isSubscribed
    ? "realtime"
    : isPollingFallback
      ? "polling"
      : error
        ? "error"
        : "disconnected"

  return {
    isSubscribed,
    error,
    isPollingFallback,
    connectionState,
  }
}
