/**
 * Realtime Activities Hook
 * 实时订阅动态变更
 */

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js"
import { logger } from "@/lib/utils/logger"
import type { Activity, ActivityWithAuthor } from "@/types/activity"

interface UseRealtimeActivitiesOptions {
  enabled?: boolean
  onInsert?: (activity: ActivityWithAuthor) => void
  onUpdate?: (activity: ActivityWithAuthor) => void
  onDelete?: (activityId: string) => void
}

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
}: UseRealtimeActivitiesOptions = {}) {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!enabled) {
      return
    }

    const supabase = createClient()
    const channelName = "activities:all"

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
              const { data, error } = await supabase
                .from("activities")
                .select("*, author:users(id,name,avatarUrl,role,status)")
                .eq("id", id)
                .single()

              if (error) {
                logger.warn("查询完整动态失败，使用原始 payload", { id, error })
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
                onInsert?.(hydrated)
              }
            } else if (payload.eventType === "UPDATE" && newActivity) {
              if (newActivity.deletedAt && newActivity.id) {
                onDelete?.(newActivity.id)
              } else {
                const hydrated =
                  (await fetchFullActivity(newActivity.id)) ?? withAuthorFallback(newActivity)
                onUpdate?.(hydrated)
              }
            } else if (payload.eventType === "DELETE" && oldActivity?.id) {
              onDelete?.(oldActivity.id)
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
          logger.info("动态订阅成功", { channelName })
        } else if (status === "CHANNEL_ERROR") {
          setIsSubscribed(false)
          setError(new Error("Failed to subscribe to activities"))
          logger.error("动态订阅失败", { channelName, status })
        }
      })

    return () => {
      logger.info("取消订阅动态", { channelName })
      supabase.removeChannel(channel)
      setIsSubscribed(false)
    }
  }, [enabled, onInsert, onUpdate, onDelete])

  return {
    isSubscribed,
    error,
  }
}
