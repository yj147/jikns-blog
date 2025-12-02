/**
 * Realtime Notifications Hook
 * 实时订阅通知插入事件
 */

import { useEffect, useRef, useState } from "react"
import type { RealtimePostgresChangesPayload, SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { createClient } from "@/lib/supabase"
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
}

const MAX_RETRY = 3

/**
 * 订阅通知的 INSERT 事件，仅监听当前用户
 */
export function useRealtimeNotifications({
  userId,
  enabled = true,
  onInsert,
  supabase: supabaseFromProps,
}: UseRealtimeNotificationsOptions) {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const onInsertRef = useRef(onInsert)
  const supabaseClientRef = useRef<SupabaseClient<Database> | null>(null)
  const [retryToken, setRetryToken] = useState(0)
  const retrySchedulerRef = useRef(createRetryScheduler({ maxRetry: MAX_RETRY }))
  const isOnline = useNetworkStatus()

  useOnlineCallback(() => {
    retrySchedulerRef.current.reset()
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
    if (!enabled || !userId) {
      retrySchedulerRef.current.reset()
      return
    }

    if (!isOnline) {
      retrySchedulerRef.current.clear()
      setIsSubscribed(false)
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
        logger.warn("通知订阅重试已达上限", { channelName, attempts: retryScheduler.attempts })
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
          const hydrated =
            (await hydrateNotification(normalized.id)) ?? withFallback(normalized)
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
      setIsSubscribed(false)
    }
  }, [userId, enabled, isOnline, retryToken])

  return {
    isSubscribed,
    error,
  }
}
