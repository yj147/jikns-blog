"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useActivities } from "@/hooks/use-activities"
import { useRealtimeActivities } from "@/hooks/use-realtime-activities"
import type { User as DatabaseUser } from "@/lib/generated/prisma"
import type { ActivityApiResponse, ActivityLikeState, ActivityWithAuthor } from "@/types/activity"

export type FeedTab = "latest" | "trending" | "following"

interface UseFeedStateOptions {
  initialActivities: ActivityWithAuthor[]
  initialPagination: {
    limit: number
    total: number | null
    hasMore: boolean
    nextCursor: string | null
  }
  initialTab: FeedTab
  highlightActivityId?: string
  user: DatabaseUser | null
  isAuthenticated?: boolean
}

export function useFeedState({
  initialActivities,
  initialPagination,
  initialTab,
  highlightActivityId,
  user,
  isAuthenticated,
}: UseFeedStateOptions) {
  const [activeTab, setActiveTab] = useState<FeedTab>(initialTab)
  const [isPending, startTransition] = useTransition()
  const [realtimeActivities, setRealtimeActivities] = useState<ActivityWithAuthor[]>([])
  const activitiesRef = useRef<ActivityWithAuthor[]>([])
  const highlightTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const handledHighlightIdRef = useRef<string | null>(null)
  const [highlightedActivityIds, setHighlightedActivityIds] = useState<Set<string>>(new Set())

  const resolvedIsAuthenticated = isAuthenticated ?? Boolean(user)

  const resolvedOrderBy = useMemo(
    () =>
      activeTab === "trending"
        ? "trending"
        : activeTab === "following" && resolvedIsAuthenticated
          ? "following"
          : "latest",
    [activeTab, resolvedIsAuthenticated]
  )

  const fallbackPages = useMemo(() => {
    return [
      {
        success: true,
        data: initialActivities,
        meta: {
          timestamp: new Date().toISOString(),
          pagination: {
            page: 1,
            limit: initialPagination.limit,
            total: initialPagination.total,
            hasMore: initialPagination.hasMore,
            nextCursor: initialPagination.nextCursor ?? null,
          },
        },
      } satisfies ActivityApiResponse<ActivityWithAuthor[]>,
    ]
  }, [initialActivities, initialPagination])

  const { activities, isLoading, isError, error, hasMore, loadMore, refresh } = useActivities(
    {
      orderBy: resolvedOrderBy,
      limit: initialPagination.limit,
    },
    {
      initialPages: activeTab === initialTab ? fallbackPages : undefined,
    }
  )

  useEffect(() => {
    if (!resolvedIsAuthenticated && activeTab === "following") {
      setActiveTab("latest")
    }
  }, [resolvedIsAuthenticated, activeTab])

  useEffect(() => {
    activitiesRef.current = activities
  }, [activities])

  // 当 activities 变化时，清理已存在于主列表中的实时活动
  // 使用 activities.length 作为依赖，避免每次渲染都触发
  const activitiesLengthRef = useRef(activities.length)
  useEffect(() => {
    if (activitiesLengthRef.current !== activities.length) {
      activitiesLengthRef.current = activities.length
      const activityIds = new Set(activities.map((activity) => activity.id))
      setRealtimeActivities((prev) => {
        const filtered = prev.filter((activity) => !activityIds.has(activity.id))
        return filtered.length === prev.length ? prev : filtered
      })
    }
  }, [activities])

  const handleTabChange = useCallback(
    (tab: FeedTab) => {
      startTransition(() => {
        setActiveTab(tab)
      })
    },
    [startTransition]
  )

  const triggerHighlight = useCallback((activityId: string) => {
    setHighlightedActivityIds((prev) => {
      if (prev.has(activityId)) {
        return prev
      }
      const next = new Set(prev)
      next.add(activityId)
      return next
    })

    if (highlightTimersRef.current[activityId]) {
      clearTimeout(highlightTimersRef.current[activityId])
    }

    highlightTimersRef.current[activityId] = setTimeout(() => {
      setHighlightedActivityIds((prev) => {
        if (!prev.has(activityId)) {
          return prev
        }
        const next = new Set(prev)
        next.delete(activityId)
        return next
      })
      delete highlightTimersRef.current[activityId]
    }, 4000)
  }, [])

  const clearHighlight = useCallback((activityId: string) => {
    setHighlightedActivityIds((prev) => {
      if (!prev.has(activityId)) {
        return prev
      }
      const next = new Set(prev)
      next.delete(activityId)
      return next
    })

    if (highlightTimersRef.current[activityId]) {
      clearTimeout(highlightTimersRef.current[activityId])
      delete highlightTimersRef.current[activityId]
    }
  }, [])

  useEffect(() => {
    const timers = highlightTimersRef.current
    return () => {
      Object.values(timers).forEach((timer) => clearTimeout(timer))
    }
  }, [])

  const resolveAuthorSnapshot = useCallback((authorId: string) => {
    const existing = activitiesRef.current.find((activity) => activity.author?.id === authorId)
    if (existing?.author) {
      return existing.author
    }

    return {
      id: authorId,
      name: null,
      avatarUrl: null,
      role: "USER" as const,
    }
  }, [])

  const handleRealtimeActivityInsert = useCallback(
    (activity: any) => {
      if (activity.deletedAt) {
        return
      }

      const normalized: ActivityWithAuthor = {
        ...activity,
        imageUrls: activity.imageUrls ?? [],
        likesCount: activity.likesCount ?? 0,
        commentsCount: activity.commentsCount ?? 0,
        viewsCount: activity.viewsCount ?? 0,
        author: activity.author ?? resolveAuthorSnapshot(activity.authorId),
      }

      setRealtimeActivities((prev) => {
        if (prev.some((item) => item.id === normalized.id)) {
          return prev
        }
        if (activitiesRef.current.some((item) => item.id === normalized.id)) {
          return prev
        }
        return [normalized, ...prev].slice(0, 10)
      })

      triggerHighlight(normalized.id)
    },
    [resolveAuthorSnapshot, triggerHighlight]
  )

  const handleRealtimeActivityDelete = useCallback(
    (activityId: string) => {
      setRealtimeActivities((prev) => prev.filter((activity) => activity.id !== activityId))
      clearHighlight(activityId)

      if (activitiesRef.current.some((activity) => activity.id === activityId)) {
        refresh()
      }
    },
    [clearHighlight, refresh]
  )

  const handleRealtimeActivityUpdate = useCallback(
    (activity: any) => {
      if (activity.deletedAt) {
        handleRealtimeActivityDelete(activity.id)
        return
      }

      setRealtimeActivities((prev) => {
        const index = prev.findIndex((item) => item.id === activity.id)
        if (index === -1) {
          return prev
        }

        const previous = prev[index]
        const next = [...prev]
        next[index] = {
          ...previous,
          ...activity,
          imageUrls: activity.imageUrls ?? previous.imageUrls,
          likesCount:
            typeof activity.likesCount === "number" ? activity.likesCount : previous.likesCount,
          commentsCount:
            typeof activity.commentsCount === "number"
              ? activity.commentsCount
              : previous.commentsCount,
          viewsCount:
            typeof activity.viewsCount === "number" ? activity.viewsCount : previous.viewsCount,
          author: previous.author ?? resolveAuthorSnapshot(activity.authorId),
        }
        return next
      })

      if (activitiesRef.current.some((item) => item.id === activity.id)) {
        refresh()
      }
    },
    [handleRealtimeActivityDelete, refresh, resolveAuthorSnapshot]
  )

  const { isSubscribed: isRealtimeSubscribed, error: realtimeActivitiesError } =
    useRealtimeActivities({
      onInsert: handleRealtimeActivityInsert,
      onUpdate: handleRealtimeActivityUpdate,
      onDelete: handleRealtimeActivityDelete,
    })

  const displayActivities = useMemo(() => {
    const seen = new Set<string>()
    const result: ActivityWithAuthor[] = []

    for (const activity of realtimeActivities) {
      if (seen.has(activity.id)) continue
      seen.add(activity.id)
      result.push(activity)
    }

    for (const activity of activities) {
      if (seen.has(activity.id)) continue
      seen.add(activity.id)
      result.push(activity)
    }

    return result
  }, [realtimeActivities, activities])

  const realtimeActivityIds = useMemo(
    () => new Set(realtimeActivities.map((activity) => activity.id)),
    [realtimeActivities]
  )

  const hasDisplayActivities = displayActivities.length > 0

  const handleLike = useCallback(
    (_activityId: string, _nextState?: ActivityLikeState) => {
      refresh()
    },
    [refresh]
  )

  const handleCommentsChange = useCallback(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!highlightActivityId) return
    if (handledHighlightIdRef.current === highlightActivityId) return

    const targetExists = displayActivities.some((activity) => activity.id === highlightActivityId)
    if (!targetExists) return

    handledHighlightIdRef.current = highlightActivityId
    triggerHighlight(highlightActivityId)

    const scrollToTarget = () => {
      const element = document.getElementById(`activity-${highlightActivityId}`)
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" })
      }
    }

    scrollToTarget()
    const fallbackTimer = window.setTimeout(scrollToTarget, 150)

    return () => {
      window.clearTimeout(fallbackTimer)
    }
  }, [displayActivities, highlightActivityId, triggerHighlight])

  return {
    activeTab,
    activities,
    displayActivities,
    handleCommentsChange,
    handleLike,
    handleTabChange,
    hasDisplayActivities,
    hasMore,
    highlightedActivityIds,
    isError,
    isLoading,
    isPending,
    isRealtimeSubscribed,
    loadMore,
    realtimeActivityIds,
    realtimeActivitiesError,
    refresh,
    resolvedOrderBy,
    error,
  }
}
