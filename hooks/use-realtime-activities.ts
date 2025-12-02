/**
 * Realtime Activities Hook
 * 实时订阅动态变更
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase"
import { createRetryScheduler } from "@/lib/realtime/retry"
import { ensureSessionReady, useNetworkStatus, useOnlineCallback } from "@/lib/realtime/connection"
import type { RealtimeChannel, RealtimePostgresChangesPayload, SupabaseClient } from "@supabase/supabase-js"
import { logger } from "@/lib/utils/logger"
import type { Database } from "@/types/database"
import type { Activity, ActivityWithAuthor } from "@/types/activity"

interface UseRealtimeActivitiesOptions {
  enabled?: boolean
  onInsert?: (activity: ActivityWithAuthor) => void
  onUpdate?: (activity: ActivityWithAuthor) => void
  onDelete?: (activityId: string) => void
  pollInterval?: number
  pollFetcher?: () => Promise<void>
}

type ConnectionState = "realtime" | "polling" | "disconnected" | "error"

const DEFAULT_POLL_INTERVAL = 10000

/**
 * 订阅动态实时更新
 *
 * @example
 * ```tsx
 * const { isSubscribed } = useRealtimeActivities({
 *   onInsert: (activity) => {
 *     setActivities(prev => [activity, ...prev])
 *   },
 *   onDelete: (id) => {
 *     setActivities(prev => prev.filter(a => a.id !== id))
 *   },
 * })
 * ```
 */
export function useRealtimeActivities({
  enabled = true,
  onInsert,
  onUpdate,
  onDelete,
  pollInterval = DEFAULT_POLL_INTERVAL,
  pollFetcher,
}: UseRealtimeActivitiesOptions = {}) {
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
    mountedRef.current = true

    if (!enabled) {
      clearChannel()
      stopPolling(true)
      return
    }

    if (!isOnline) {
      return
    }

    let canceled = false

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
      if (!supabase || typeof (supabase as any).channel !== "function") {
        logger.warn("当前环境不支持 Realtime，启用轮询")
        startPolling()
        return
      }

      const channelName = "activities:all"
      const sessionReady = await ensureSessionReady(supabase, channelName, false)
      if (canceled || !mountedRef.current) return

      if (!sessionReady) {
        setIsSubscribed(false)
        setError((prev) => prev ?? new Error("Supabase session not ready"))
        triggerRetry()
        return
      }

      setError(null)

      logger.info("订阅动态实时更新", { channelName })

      const channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "activities",
          },
          async (payload: RealtimePostgresChangesPayload<Activity>) => {
            const newActivity = (payload.new ?? null) as Activity | null
            const oldActivity = (payload.old ?? null) as Activity | null

            logger.debug("收到动态变更", {
              event: payload.eventType,
              activityId: newActivity?.id || oldActivity?.id,
            })

            try {
              const fetchFullActivity = async (id: string) => {
                const { data, error: fetchError } = await supabase
                  .from("activities")
                  .select("*, author:users(id,name,avatarUrl,role,status)")
                  .eq("id", id)
                  .single()

                if (fetchError) {
                  logger.warn("查询完整动态失败，使用原始 payload", { id, error: fetchError })
                }

                return data as ActivityWithAuthor | null
              }

              const withAuthorFallback = (activity: Activity): ActivityWithAuthor => ({
                ...activity,
                author: {
                  id: activity.authorId,
                  name: null,
                  avatarUrl: null,
                  role: "USER",
                },
              })

              if (payload.eventType === "INSERT" && newActivity) {
                if (!newActivity.deletedAt) {
                  const hydrated =
                    (await fetchFullActivity(newActivity.id)) ?? withAuthorFallback(newActivity)
                  onInsertRef.current?.(hydrated)
                }
              } else if (payload.eventType === "UPDATE" && newActivity) {
                if (newActivity.deletedAt && newActivity.id) {
                  onDeleteRef.current?.(newActivity.id)
                } else {
                  const hydrated =
                    (await fetchFullActivity(newActivity.id)) ?? withAuthorFallback(newActivity)
                  onUpdateRef.current?.(hydrated)
                }
              } else if (payload.eventType === "DELETE" && oldActivity?.id) {
                onDeleteRef.current?.(oldActivity.id)
              }
            } catch (err) {
              logger.error("处理动态变更失败", { event: payload.eventType }, err)
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
            logger.info("动态订阅成功", { channelName })
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            setIsSubscribed(false)
            setError(new Error("Failed to subscribe to activities"))
            logger.warn("动态订阅失败，尝试重试", { channelName, status })
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
  }, [clearChannel, enabled, isOnline, retryToken, startPolling, stopPolling, triggerRetry])

  useEffect(() => {
    if (isPollingFallback && pollTimerRef.current) {
      stopPolling()
      startPolling()
    }
  }, [pollInterval, isPollingFallback, startPolling, stopPolling])

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
