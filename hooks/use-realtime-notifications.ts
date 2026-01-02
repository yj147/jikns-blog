/**
 * Realtime Notifications Hook
 * 实时订阅通知插入事件
 */

import { useCallback, useEffect, useRef, useState } from "react"
import type { RealtimePostgresChangesPayload, SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { fetchJson } from "@/lib/api/fetch-json"
import { logger } from "@/lib/utils/logger"
import type { NotificationListPayload, NotificationView } from "@/components/notifications/types"
import { createRetryScheduler } from "@/lib/realtime/retry"
import { ensureSessionReady, useNetworkStatus, useOnlineCallback } from "@/lib/realtime/connection"

interface NotificationRow {
  id: string
  recipientId: string
  actorId: string
  type: NotificationView["type"]
  activityId: string | null
  postId: string | null
  commentId: string | null
  readAt: string | null
  createdAt: string
}

function buildTargetUrl(payload: {
  type: NotificationView["type"]
  post?: { slug?: string | null; id?: string | null } | null
  postId?: string | null
  comment?: { postId?: string | null; activityId?: string | null } | null
  activityId?: string | null
  actorId: string
  actor?: { id?: string | null } | null
}): string | null {
  const postSlugOrId = payload.post?.slug ?? payload.postId ?? payload.comment?.postId ?? null
  const activityId = payload.activityId ?? payload.comment?.activityId ?? null

  if (payload.type === "FOLLOW") {
    const actorId = payload.actor?.id ?? payload.actorId
    return actorId ? `/profile/${actorId}` : null
  }

  if (payload.type === "COMMENT") {
    if (activityId) {
      return `/feed?highlight=${activityId}`
    }
    return postSlugOrId ? `/blog/${postSlugOrId}#comments` : null
  }

  if (payload.type === "LIKE") {
    if (activityId) {
      return `/feed?highlight=${activityId}`
    }
    return postSlugOrId ? `/blog/${postSlugOrId}` : null
  }

  return null
}

interface UseRealtimeNotificationsOptions {
  userId?: string
  enabled?: boolean
  onInsert?: (notification: NotificationView) => void
  supabase?: SupabaseClient<Database> | null
  pollInterval?: number
}

const MAX_RETRY = 3
const DEFAULT_POLL_INTERVAL = 30000
const DELIVERED_CACHE_LIMIT = 400

/**
 * 订阅通知的 INSERT 事件，仅监听当前用户
 */
export function useRealtimeNotifications({
  userId,
  enabled = true,
  onInsert,
  supabase: supabaseFromProps,
  pollInterval = DEFAULT_POLL_INTERVAL,
}: UseRealtimeNotificationsOptions) {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [isPollingFallback, setIsPollingFallback] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const onInsertRef = useRef(onInsert)
  const supabaseClientRef = useRef<SupabaseClient<Database> | null>(null)
  const [retryToken, setRetryToken] = useState(0)
  const retrySchedulerRef = useRef(createRetryScheduler({ maxRetry: MAX_RETRY }))
  const isOnline = useNetworkStatus()
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const deliveredIdsRef = useRef<Set<string>>(new Set())
  const deliveredQueueRef = useRef<string[]>([])
  const mountedRef = useRef(true)
  const refreshInFlightRef = useRef(false)
  const isPollingRef = useRef(false)

  const rememberDelivered = useCallback((id: string) => {
    if (deliveredIdsRef.current.has(id)) return
    deliveredIdsRef.current.add(id)
    deliveredQueueRef.current.push(id)
    if (deliveredQueueRef.current.length > DELIVERED_CACHE_LIMIT) {
      const oldest = deliveredQueueRef.current.shift()
      if (oldest) {
        deliveredIdsRef.current.delete(oldest)
      }
    }
  }, [])

  const clearDelivered = useCallback(() => {
    deliveredIdsRef.current.clear()
    deliveredQueueRef.current = []
  }, [])

  useOnlineCallback(() => {
    retrySchedulerRef.current.reset()
    setIsSubscribed(false)
    clearDelivered()
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
    isPollingRef.current = false
    setIsPollingFallback(false)
    setRetryToken((prev) => prev + 1)
  })

  useEffect(() => {
    onInsertRef.current = onInsert
  }, [onInsert])

  useEffect(() => {
    if (supabaseFromProps) {
      supabaseClientRef.current = supabaseFromProps
    }
  }, [supabaseFromProps])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const stopPolling = useCallback((skipStateUpdate = false) => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
    isPollingRef.current = false
    if (!skipStateUpdate) {
      setIsPollingFallback(false)
    }
  }, [])

  const pollNotifications = useCallback(async () => {
    if (!enabled || !userId || !isOnline || refreshInFlightRef.current) return
    refreshInFlightRef.current = true
    setIsRefreshing(true)
    try {
      const response = await fetchJson<{ success: boolean; data: NotificationListPayload }>(
        "/api/notifications",
        { params: { limit: 20 } }
      )
      const items = response?.data?.items ?? []
      for (const item of [...items].reverse()) {
        if (deliveredIdsRef.current.has(item.id)) continue
        rememberDelivered(item.id)
        onInsertRef.current?.({
          ...item,
          targetUrl:
            item.targetUrl ??
            buildTargetUrl({
              type: item.type,
              post: item.post,
              comment: item.comment
                ? { postId: item.comment.postId ?? undefined, activityId: item.comment.activityId }
                : null,
              activityId: item.activityId ?? undefined,
              actorId: item.actorId ?? item.actor?.id ?? "",
              actor: item.actor ?? undefined,
              postId: item.post?.id ?? item.post?.postId,
            }),
        })
      }
    } catch (err) {
      logger.warn("通知轮询失败", { error: err })
      if (mountedRef.current) {
        setError((prev) => prev ?? (err instanceof Error ? err : new Error("Failed to poll")))
      }
    } finally {
      if (mountedRef.current) {
        setIsRefreshing(false)
      }
      refreshInFlightRef.current = false
    }
  }, [enabled, isOnline, rememberDelivered, userId])

  const refresh = useCallback(async () => {
    await pollNotifications()
  }, [pollNotifications])

  const startPolling = useCallback(() => {
    if (pollTimerRef.current || !isOnline) {
      isPollingRef.current = Boolean(pollTimerRef.current)
      setIsPollingFallback(isPollingRef.current)
      return
    }

    isPollingRef.current = true
    setIsPollingFallback(true)
    void pollNotifications()
    pollTimerRef.current = setInterval(() => {
      void pollNotifications()
    }, pollInterval)
  }, [isOnline, pollInterval, pollNotifications])

  useEffect(() => {
    if (!enabled || !userId) {
      retrySchedulerRef.current.reset()
      stopPolling()
      clearDelivered()
      return
    }

    if (!isOnline) {
      retrySchedulerRef.current.clear()
      setIsSubscribed(false)
      stopPolling()
      clearDelivered()
      return
    }

    let supabase: SupabaseClient<Database> | null = supabaseClientRef.current
    let channel: ReturnType<SupabaseClient<Database>["channel"]> | null = null
    let isActive = true
    const channelName = `notifications:user-${userId}`
    const retryScheduler = retrySchedulerRef.current

    const scheduleRetry = () => {
      if (!isActive) return
      if (!isOnline) {
        retryScheduler.reset()
        return
      }
      const delay = retryScheduler.schedule(() => {
        if (!isActive) return
        setRetryToken((prev) => prev + 1)
      })
      if (delay === null) {
        logger.warn("通知订阅重试已达上限，启动轮询降级", {
          channelName,
          attempts: retryScheduler.attempts,
        })
        startPolling()
      }
    }

    const pollOnceIfFallback = () => {
      if (isPollingRef.current && !pollTimerRef.current) {
        startPolling()
      }
    }

    const fetchSignedNotification = async (id: string): Promise<NotificationView | null> => {
      try {
        const response = await fetchJson<{ success: boolean; data: NotificationListPayload }>(
          "/api/notifications",
          {
            params: { ids: id, limit: 1 },
          }
        )

        const item = response?.data?.items?.find((notification) => notification.id === id)
        return item ?? response?.data?.items?.[0] ?? null
      } catch (err) {
        logger.warn("通过 API 获取通知失败，回退到 Supabase 查询", {
          channelName,
          notificationId: id,
          error: err,
        })
        return null
      }
    }

    const setupSubscription = async () => {
      if (!supabase) {
        try {
          const { createClient } = await import("@/lib/supabase")
          supabase = createClient()
          supabaseClientRef.current = supabase
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error"
          logger.error("创建 Supabase 客户端失败，禁用通知实时更新", { message })
          setError(err instanceof Error ? err : new Error(message))
          return
        }
      }

      if (!supabase) {
        return
      }

      if (typeof (supabase as any)?.channel !== "function") {
        logger.warn("Supabase 客户端缺少 channel 方法，跳过通知实时订阅")
        setError(new Error("Realtime unavailable in current environment"))
        return
      }

      const sessionReady = await ensureSessionReady(supabase, channelName, true)
      if (!isActive) return

      if (!sessionReady) {
        setIsSubscribed(false)
        setError((prev) => prev ?? new Error("Supabase session not ready"))
        scheduleRetry()
        return
      }

      logger.info("订阅通知实时更新", { channelName })
      const client = supabase

      const hydrateNotification = async (id: string): Promise<NotificationView | null> => {
        const signedFromApi = await fetchSignedNotification(id)
        if (signedFromApi) return signedFromApi

        const { data, error: fetchError } = await client
          .from("notifications")
          .select(
            `
            id,
            type,
            readAt,
            createdAt,
            recipientId,
            actorId,
            activityId,
            postId,
            commentId,
            actor:users!notifications_actorId_fkey(id,name,avatarUrl,email),
            post:posts!notifications_postId_fkey(id,title,slug),
            comment:comments!notifications_commentId_fkey(id,content,postId,activityId)
          `
          )
          .eq("id", id)
          .single()

        if (fetchError) {
          logger.warn("查询完整通知失败，使用原始 payload", { id, error: fetchError })
        }

        if (!data) return null

        const notification = data as unknown as NotificationView & {
          postId?: string | null
          commentId?: string | null
        }

        return {
          ...notification,
          activityId:
            (notification as any).activityId ??
            notification.comment?.activityId ??
            notification.post?.activityId ??
            null,
          targetUrl:
            notification.targetUrl ??
            buildTargetUrl({
              type: notification.type,
              post: notification.post ?? (notification.postId ? { id: notification.postId } : null),
              postId: notification.postId,
              comment: notification.comment,
              activityId: (notification as any).activityId ?? notification.comment?.activityId,
              actorId: notification.actorId ?? notification.actor?.id ?? "",
              actor: notification.actor,
            }),
        }
      }

      const withFallback = (payload: NotificationRow): NotificationView => ({
        id: payload.id,
        type: payload.type,
        readAt: payload.readAt ?? null,
        createdAt: payload.createdAt,
        recipientId: payload.recipientId,
        actorId: payload.actorId,
        activityId: payload.activityId ?? null,
        actor: {
          id: payload.actorId,
          name: null,
          avatarUrl: null,
          email: null,
        },
        post: payload.postId ? { id: payload.postId, title: null, slug: null } : null,
        comment: payload.commentId
          ? {
              id: payload.commentId,
              content: null,
              postId: payload.postId ?? null,
              activityId: payload.activityId ?? null,
            }
          : null,
        targetUrl: buildTargetUrl({
          type: payload.type,
          postId: payload.postId,
          comment: payload.commentId
            ? { postId: payload.postId, activityId: payload.activityId ?? null }
            : null,
          activityId: payload.activityId ?? null,
          actorId: payload.actorId,
          actor: { id: payload.actorId },
        }),
      })

      const handleNotificationChange = async (
        incoming: NotificationRow | null,
        source: "broadcast" | "postgres_changes"
      ) => {
        if (!incoming) return

        const normalized: NotificationRow = {
          ...incoming,
          createdAt:
            typeof incoming.createdAt === "string"
              ? incoming.createdAt
              : new Date(incoming.createdAt).toISOString(),
          readAt: incoming.readAt ?? null,
        }

        logger.debug("收到新通知", { notificationId: normalized.id, source })

        try {
          const hydrated = (await hydrateNotification(normalized.id)) ?? withFallback(normalized)
          rememberDelivered(hydrated.id)
          onInsertRef.current?.(hydrated)
        } catch (err) {
          logger.error("处理通知变更失败", { notificationId: normalized.id }, err)
          setError(err instanceof Error ? err : new Error("Unknown error"))
        }
      }

      const notificationChannel = client.channel(channelName)

      notificationChannel.on("broadcast", { event: "INSERT" }, async (payload) => {
        const data = (payload as { payload?: NotificationRow | null })?.payload ?? null
        await handleNotificationChange(data, "broadcast")
      })

      notificationChannel.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipientId=eq.${userId}`,
        },
        async (payload: RealtimePostgresChangesPayload<NotificationRow>) => {
          await handleNotificationChange(
            (payload.new ?? null) as NotificationRow | null,
            "postgres_changes"
          )
        }
      )

      notificationChannel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setIsSubscribed(true)
          retryScheduler.reset()
          stopPolling()
          setIsPollingFallback(false)
          logger.info("通知订阅成功", { channelName })
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          if (!isActive) {
            return
          }
          setIsSubscribed(false)
          setError(new Error("Failed to subscribe to notifications"))
          void client.auth
            .getSession()
            .then(({ data, error: sessionError }) => {
              if (sessionError) {
                logger.warn("获取 Supabase 会话用于订阅中断日志失败", {
                  channelName,
                  status,
                  attempts: retryScheduler.attempts,
                  error: sessionError,
                })
              }
              logger.error("通知订阅中断", {
                channelName,
                status,
                attempts: retryScheduler.attempts,
                sessionUserId: data.session?.user?.id ?? "unknown",
              })
            })
            .catch((err) =>
              logger.error(
                "通知订阅中断（获取会话异常）",
                { channelName, status, attempts: retryScheduler.attempts },
                err
              )
            )
          scheduleRetry()
          pollOnceIfFallback()
        }
      })

      channel = notificationChannel
    }

    void setupSubscription()

    return () => {
      isActive = false
      retryScheduler.reset()
      if (channel && supabase) {
        logger.info("取消订阅通知", { channelName })
        supabase.removeChannel(channel)
      }
      stopPolling(true)
      clearDelivered()
      setIsSubscribed(false)
    }
  }, [userId, enabled, isOnline, retryToken, startPolling, stopPolling, rememberDelivered])

  return {
    isSubscribed,
    error,
    isPollingFallback,
    isRefreshing,
    refresh,
    connectionState: isSubscribed
      ? "realtime"
      : isPollingFallback
        ? "polling"
        : error
          ? "error"
          : "disconnected",
  }
}
