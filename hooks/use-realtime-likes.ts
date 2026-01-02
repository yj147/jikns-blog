/**
 * Realtime Likes Hook
 * 实时订阅点赞变更，具备重试、网络感知和轮询降级
 */

import { useCallback, useEffect, useRef, useState } from "react"
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
  SupabaseClient,
} from "@supabase/supabase-js"
import {
  createRetryScheduler,
  ensureSessionReady,
  useNetworkStatus,
  useOnlineCallback,
} from "@/lib/realtime"
import type { Database } from "@/types/database"
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
  pollInterval?: number
  pollFetcher?: () => Promise<void>
}

const DEFAULT_POLL_INTERVAL = 10000

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
  pollInterval = DEFAULT_POLL_INTERVAL,
  pollFetcher,
}: UseRealtimeLikesOptions) {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isPollingFallback, setIsPollingFallback] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const isOnline = useNetworkStatus()

  // 使用 ref 存储回调，避免它们触发 effect 重新执行
  const onLikeRef = useRef(onLike)
  const onUnlikeRef = useRef(onUnlike)
  const pollFetcherRef = useRef(pollFetcher)
  const supabaseRef = useRef<SupabaseClient<Database> | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef = useRef(false)
  const retrySchedulerRef = useRef(
    createRetryScheduler({
      maxRetry: 3,
      baseDelay: 1000,
      backoffFactor: 2,
    })
  )
  const [reconnectToken, setReconnectToken] = useState(0)

  useEffect(() => {
    onLikeRef.current = onLike
    onUnlikeRef.current = onUnlike
  }, [onLike, onUnlike])

  useEffect(() => {
    pollFetcherRef.current = pollFetcher
  }, [pollFetcher])

  useOnlineCallback(() => {
    retrySchedulerRef.current.reset()
    setReconnectToken((token) => token + 1)
  })

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
    if (mountedRef.current) {
      setIsPollingFallback(false)
    }
  }, [])

  const startPolling = useCallback(() => {
    if (!mountedRef.current) return
    if (!pollFetcherRef.current) {
      logger.warn("缺少轮询函数，无法启动点赞轮询降级")
      setIsPollingFallback(false)
      return
    }
    if (pollTimerRef.current) return

    setIsSubscribed(false)
    setIsPollingFallback(true)

    const safePoll = async () => {
      try {
        await pollFetcherRef.current?.()
      } catch (err) {
        logger.error("点赞轮询失败", err)
      }
    }

    void safePoll()
    pollTimerRef.current = setInterval(
      () => {
        if (!mountedRef.current || !isOnline) return
        void safePoll()
      },
      Math.max(1000, pollInterval)
    )
  }, [isOnline, pollInterval])

  const teardownChannel = useCallback(() => {
    if (channelRef.current && supabaseRef.current) {
      supabaseRef.current.removeChannel(channelRef.current)
    }
    channelRef.current = null
  }, [])

  useEffect(() => {
    mountedRef.current = true
    const retryScheduler = retrySchedulerRef.current

    retryScheduler.reset()
    stopPolling()
    setIsSubscribed(false)

    if (!enabled || !targetId) {
      setError(null)
      return () => {
        mountedRef.current = false
        retryScheduler.clear()
        stopPolling()
        teardownChannel()
      }
    }

    if (!isOnline) {
      setIsSubscribed(false)
      setError(null)
      teardownChannel()
      return () => {
        mountedRef.current = false
        retryScheduler.clear()
        stopPolling()
        teardownChannel()
      }
    }

    let cancelled = false

    const setupRealtime = async () => {
      if (cancelled || !mountedRef.current) return

      if (!supabaseRef.current) {
        try {
          const { createClient } = await import("@/lib/supabase")
          supabaseRef.current = createClient()
        } catch (err) {
          const normalized = err instanceof Error ? err : new Error("创建 Supabase 客户端失败")
          logger.error("创建 Supabase 客户端失败，启用点赞轮询降级", {
            message: normalized.message,
          })
          setError(normalized)
          startPolling()
          return
        }
      }

      const supabase = supabaseRef.current
      if (!supabase || typeof (supabase as any)?.channel !== "function") {
        logger.warn("当前环境不支持 Realtime，跳过点赞订阅并启用轮询")
        setError(new Error("Realtime unavailable in current environment"))
        startPolling()
        return
      }

      const channelName = `likes:${targetType}:${targetId}`
      const filterField = targetType === "post" ? "postId" : "activityId"

      const sessionReady = await ensureSessionReady(supabase, channelName, true)
      if (!mountedRef.current || cancelled) return

      if (!sessionReady) {
        setIsSubscribed(false)
        const delay = retryScheduler.schedule(() => {
          if (!mountedRef.current || cancelled) return
          void setupRealtime()
        })

        if (delay === null) {
          startPolling()
        }
        return
      }

      teardownChannel()

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
          if (cancelled || !mountedRef.current) return

          if (status === "SUBSCRIBED") {
            retryScheduler.reset()
            stopPolling()
            setError(null)
            setIsSubscribed(true)
            logger.info("点赞订阅成功", { channelName })
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            setIsSubscribed(false)
            setError(new Error("Failed to subscribe to likes"))
            logger.warn("点赞订阅中断，调度重试", { channelName, status })

            const delay = retryScheduler.schedule(() => {
              if (!mountedRef.current || cancelled) return
              void setupRealtime()
            })

            if (delay === null) {
              startPolling()
            }
          }
        })

      channelRef.current = channel
    }

    void setupRealtime()

    return () => {
      cancelled = true
      mountedRef.current = false
      retryScheduler.clear()
      stopPolling()
      teardownChannel()
    }
  }, [
    enabled,
    isOnline,
    pollInterval,
    reconnectToken,
    startPolling,
    stopPolling,
    targetId,
    targetType,
    teardownChannel,
  ])

  const connectionState: "realtime" | "polling" | "disconnected" | "error" = isSubscribed
    ? "realtime"
    : isPollingFallback
      ? "polling"
      : error
        ? "error"
        : "disconnected"

  return {
    isSubscribed,
    error,
    connectionState,
    isPollingFallback,
  }
}
