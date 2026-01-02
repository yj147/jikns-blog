/**
 * Realtime Activities Hook
 * 实时订阅动态变更
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { createRetryScheduler } from "@/lib/realtime/retry"
import { ensureSessionReady, useNetworkStatus, useOnlineCallback } from "@/lib/realtime/connection"
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
  SupabaseClient,
} from "@supabase/supabase-js"
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
const HYDRATION_BATCH_DELAY = 30

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
  const hydrationQueueRef = useRef<
    Map<string, { activity: ActivityWithAuthor; event: "insert" | "update" }>
  >(new Map())
  const hydrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

    if (!pollFetcherRef.current) {
      const missingFetcherError = new Error("Polling fallback requires pollFetcher")
      logger.error("未提供 pollFetcher，无法启用轮询降级")
      setError((prev) => prev ?? missingFetcherError)
      setIsPollingFallback(false)
      return
    }

    setIsPollingFallback(true)

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

  const toActivityWithPayload = useCallback(
    (activity: Activity | null): ActivityWithAuthor | null => {
      if (!activity) return null

      const payloadAuthor = (activity as any)?.author as ActivityWithAuthor["author"] | undefined

      return {
        ...activity,
        author:
          payloadAuthor && payloadAuthor.id
            ? payloadAuthor
            : {
                id: activity.authorId,
                name: payloadAuthor?.name ?? null,
                avatarUrl: payloadAuthor?.avatarUrl ?? null,
                role: payloadAuthor?.role ?? "USER",
              },
      }
    },
    []
  )

  const needsAuthorHydration = useCallback((activity: ActivityWithAuthor | null) => {
    if (!activity) return false
    const author = activity.author
    if (!author) return true
    return author.name === null || author.avatarUrl === null
  }, [])

  const processHydrationQueue = useCallback(async () => {
    if (!hydrationQueueRef.current.size) {
      return
    }

    const supabase = supabaseRef.current
    const pending = Array.from(hydrationQueueRef.current.values())
    hydrationQueueRef.current.clear()

    if (!supabase) {
      pending.forEach(({ activity, event }) => {
        if (event === "insert") {
          onInsertRef.current?.(activity)
        } else {
          onUpdateRef.current?.(activity)
        }
      })
      return
    }

    const ids = pending.map((item) => item.activity.id)
    let fetchedMap = new Map<string, ActivityWithAuthor>()

    try {
      const { data, error: fetchError } = await supabase
        .from("activities")
        .select("*, author:users(id,name,avatarUrl,role,status)")
        .in("id", ids)

      if (fetchError) {
        logger.warn("批量查询活动失败，使用原始 payload", { ids, error: fetchError })
      }

      if (data?.length) {
        fetchedMap = new Map(
          (data as Array<{ id: string } & Record<string, unknown>>).map((item) => [
            item.id,
            item as unknown as ActivityWithAuthor,
          ])
        )
      }
    } catch (err) {
      logger.warn("批量查询活动异常，使用原始 payload", { ids, error: err })
    }

    pending.forEach(({ activity, event }) => {
      const hydrated = fetchedMap.get(activity.id)
      const merged: ActivityWithAuthor = hydrated
        ? {
            ...activity,
            ...hydrated,
            author: hydrated.author ?? activity.author,
          }
        : activity

      try {
        if (event === "insert") {
          onInsertRef.current?.(merged)
        } else {
          onUpdateRef.current?.(merged)
        }
      } catch (err) {
        logger.error("处理动态变更失败", { event }, err)
        setError(err instanceof Error ? err : new Error("Unknown error"))
      }
    })
  }, [])

  const enqueueHydration = useCallback(
    (activity: ActivityWithAuthor, event: "insert" | "update") => {
      if (!activity?.id) return
      hydrationQueueRef.current.set(activity.id, { activity, event })
      if (hydrationTimerRef.current) return

      hydrationTimerRef.current = setTimeout(() => {
        hydrationTimerRef.current = null
        void processHydrationQueue()
      }, HYDRATION_BATCH_DELAY)
    },
    [processHydrationQueue]
  )

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
          const { createClient } = await import("@/lib/supabase")
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
              if (payload.eventType === "INSERT" && newActivity) {
                if (!newActivity.deletedAt) {
                  const activityWithPayload = toActivityWithPayload(newActivity)
                  if (needsAuthorHydration(activityWithPayload)) {
                    enqueueHydration(activityWithPayload!, "insert")
                  } else if (activityWithPayload) {
                    onInsertRef.current?.(activityWithPayload)
                  }
                }
              } else if (payload.eventType === "UPDATE" && newActivity) {
                if (newActivity.deletedAt && newActivity.id) {
                  onDeleteRef.current?.(newActivity.id)
                } else {
                  const activityWithPayload = toActivityWithPayload(newActivity)
                  if (needsAuthorHydration(activityWithPayload)) {
                    enqueueHydration(activityWithPayload!, "update")
                  } else if (activityWithPayload) {
                    onUpdateRef.current?.(activityWithPayload)
                  }
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
      hydrationQueueRef.current.clear()
      if (hydrationTimerRef.current) {
        clearTimeout(hydrationTimerRef.current)
        hydrationTimerRef.current = null
      }
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
