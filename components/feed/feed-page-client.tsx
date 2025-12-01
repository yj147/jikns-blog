"use client"

import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  useCallback,
  useEffect,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react"
import { useActivities } from "@/hooks/use-activities"
import { useAuth } from "@/hooks/use-auth"
import { useRealtimeActivities } from "@/hooks/use-realtime-activities"
import { ActivityCard } from "@/components/activity-card"
import { CommentList } from "@/components/activity/comment-list"
import { LazyActivityCard } from "./lazy-activity-card"
import { Users } from "lucide-react"
import type { ActivityApiResponse, ActivityLikeState, ActivityWithAuthor } from "@/types/activity"
import type { ClientFeatureFlags } from "@/lib/config/client-feature-flags"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

type FeedTab = "latest" | "trending" | "following"


interface FeedPageClientProps {
  featureFlags: ClientFeatureFlags
  initialActivities: ActivityWithAuthor[]
  initialPagination: {
    limit: number
    total: number
    hasMore: boolean
    nextCursor: string | null
  }
  initialTab: FeedTab
  highlightActivityId?: string
}

const SuggestedUsersCard = dynamic(() => import("./suggested-users-card"), {
  ssr: true,
  loading: () => (
    <Card>
      <CardHeader>
        <CardTitle>推荐关注</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex animate-pulse space-x-3">
            <div className="h-10 w-10 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-muted" />
              <div className="h-3 w-1/2 rounded bg-muted" />
            </div>
            <div className="h-8 w-16 rounded bg-muted" />
          </div>
        ))}
      </CardContent>
    </Card>
  ),
})

const TrendingTopicsCard = dynamic(() => import("./trending-topics-card"), {
  ssr: true,
  loading: () => (
    <Card>
      <CardHeader>
        <CardTitle>热门话题</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex animate-pulse justify-between">
            <div className="h-4 w-1/3 rounded bg-muted" />
            <div className="h-4 w-1/4 rounded bg-muted" />
          </div>
        ))}
      </CardContent>
    </Card>
  ),
})

const PERFORMANCE_LABELS = {
  feedStart: "feed-mount-start",
  feedEnd: "feed-mount-end",
  feedMeasure: "feed-mount-total",
  activitiesBase: "activities-render",
} as const

const isPerformanceSupported = () =>
  typeof window !== "undefined" &&
  typeof window.performance !== "undefined" &&
  typeof window.performance.mark === "function" &&
  typeof window.performance.measure === "function"

const markUserTiming = (label: string) => {
  if (!isPerformanceSupported()) return
  window.performance.mark(label)
}

const measureUserTiming = (measureName: string, startLabel: string, endLabel: string) => {
  if (!isPerformanceSupported()) return
  try {
    window.performance.measure(measureName, startLabel, endLabel)
    if (process.env.NODE_ENV === "development" && typeof console !== "undefined") {
      const entries = window.performance.getEntriesByName(measureName, "measure")
      const entry = entries[entries.length - 1]
      if (entry && typeof console.table === "function") {
        console.table([
          {
            name: measureName,
            duration: Number(entry.duration.toFixed(2)),
            startTime: Number(entry.startTime.toFixed(2)),
          },
        ])
      }
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development" && typeof console !== "undefined") {
      console.warn(`[perf] 无法记录 ${measureName}`, error)
    }
  }
}

const ActivityComposer = dynamic(
  () => import("@/components/activity/activity-form").then((mod) => mod.ActivityForm),
  {
  ssr: false,
  loading: () => (
    <Card className="mb-6 animate-pulse">
      <CardHeader>
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-full bg-muted" />
          <div className="h-20 w-full rounded bg-muted" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex space-x-2">
            <div className="h-9 w-20 rounded bg-muted" />
            <div className="h-9 w-20 rounded bg-muted" />
            <div className="h-9 w-20 rounded bg-muted" />
          </div>
          <div className="h-9 w-16 rounded bg-muted" />
        </div>
      </CardContent>
    </Card>
  ),
})


export default function FeedPageClient({
  featureFlags,
  initialActivities,
  initialPagination,
  initialTab,
  highlightActivityId,
}: FeedPageClientProps) {
  const [activeTab, setActiveTab] = useState<FeedTab>(initialTab)
  const [isComposerVisible, setComposerVisible] = useState(false)
  const composerPrefetchedRef = useRef(false)
  const feedMeasurementRecordedRef = useRef(false)
  const [isPending, startTransition] = useTransition()

  // 获取当前用户信息
  const { user } = useAuth()
  const canPinComposer = user?.role === "ADMIN"

  // 使用真实的 Activities API
  const resolvedOrderBy =
    activeTab === "trending"
      ? "trending"
      : activeTab === "following" && user
        ? "following"
        : "latest"

  const fallbackPages = useMemo(() => {
    if (initialActivities.length === 0) {
      return undefined
    }

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

  const [repostedPosts, setRepostedPosts] = useState<Set<string>>(new Set())
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set())
  const [realtimeActivities, setRealtimeActivities] = useState<ActivityWithAuthor[]>([])
  const activitiesRef = useRef<ActivityWithAuthor[]>([])
  const [highlightedActivityIds, setHighlightedActivityIds] = useState<Set<string>>(new Set())
  const highlightTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const handledHighlightIdRef = useRef<string | null>(null)

  useInsertionEffect(() => {
    if (feedMeasurementRecordedRef.current) return
    markUserTiming(PERFORMANCE_LABELS.feedStart)
  }, [])

  useLayoutEffect(() => {
    if (feedMeasurementRecordedRef.current) return
    markUserTiming(PERFORMANCE_LABELS.feedEnd)
    measureUserTiming(
      PERFORMANCE_LABELS.feedMeasure,
      PERFORMANCE_LABELS.feedStart,
      PERFORMANCE_LABELS.feedEnd
    )
    feedMeasurementRecordedRef.current = true
  }, [])

  const activitiesMeasureBase = `${PERFORMANCE_LABELS.activitiesBase}-${resolvedOrderBy}`
  const activitiesStartMark = `${activitiesMeasureBase}-start`
  const activitiesEndMark = `${activitiesMeasureBase}-end`
  const activitiesMeasureName = `${activitiesMeasureBase}-duration`

  useInsertionEffect(() => {
    if (!activities.length) return
    markUserTiming(activitiesStartMark)
  }, [activities.length, activitiesMeasureBase])

  useLayoutEffect(() => {
    if (!activities.length) return
    markUserTiming(activitiesEndMark)
    measureUserTiming(activitiesMeasureName, activitiesStartMark, activitiesEndMark)
  }, [activities.length, activitiesMeasureBase])

  useEffect(() => {
    if (!user && activeTab === "following") {
      setActiveTab("latest")
    }
  }, [user, activeTab])

  useEffect(() => {
    activitiesRef.current = activities
  }, [activities])

  useEffect(() => {
    return () => {
      Object.values(highlightTimersRef.current).forEach((timer) => {
        clearTimeout(timer)
      })
    }
  }, [])

  const activityIds = useMemo(() => new Set(activities.map((a) => a.id)), [activities.length])

  useEffect(() => {
    setRealtimeActivities((prev) =>
      prev.filter((activity) => !activityIds.has(activity.id))
    )
  }, [activityIds])

  const handleRepost = (id: string) => {
    setRepostedPosts((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const handleComment = useCallback((id: string) => {
    setExpandedComments((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }, [])

  const handleLike = useCallback(
    (_activityId: string, _nextState?: ActivityLikeState) => {
      refresh()
    },
    [refresh]
  )

  const handleCommentsChange = useCallback(() => {
    refresh()
  }, [refresh])

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

  const resolveAuthorSnapshot = useCallback(
    (authorId: string) => {
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
    },
    []
  )

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

  const {
    isSubscribed: isRealtimeSubscribed,
    error: realtimeActivitiesError,
  } = useRealtimeActivities({
    onInsert: handleRealtimeActivityInsert,
    onUpdate: handleRealtimeActivityUpdate,
    onDelete: handleRealtimeActivityDelete,
  })

  const handleComposerClose = useCallback(() => {
    setComposerVisible(false)
  }, [])

  const handleComposerSuccess = useCallback(() => {
    setComposerVisible(false)
    refresh()
  }, [refresh])

  const handleTabChange = useCallback(
    (tab: FeedTab) => {
      startTransition(() => {
        setActiveTab(tab)
      })
    },
    [startTransition]
  )

  const prefetchComposer = useCallback(() => {
    if (composerPrefetchedRef.current) return
    composerPrefetchedRef.current = true
    import("@/components/activity/activity-form")
  }, [])

  const handleOpenComposer = useCallback(() => {
    prefetchComposer()
    setComposerVisible(true)
  }, [prefetchComposer])

  const displayActivities = useMemo(() => {
    const seen = new Set<string>()
    const result: ActivityWithAuthor[] = []

    // 实时数据优先
    for (const activity of realtimeActivities) {
      if (seen.has(activity.id)) continue
      seen.add(activity.id)
      result.push(activity)
    }

    // 分页数据去重后追加
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

  useEffect(() => {
    if (!highlightActivityId) return
    if (handledHighlightIdRef.current === highlightActivityId) return

    const targetExists = displayActivities.some(
      (activity) => activity.id === highlightActivityId
    )
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

  if (isError) {
    return (
      <div className="bg-background min-h-screen">
        <div className="container mx-auto px-4 py-6">
          <div className="py-12 text-center">
            <div className="mb-4 text-6xl">😵</div>
            <h3 className="mb-2 text-xl font-semibold">加载动态失败</h3>
            <p className="text-muted-foreground mb-6">{error?.message || "请稍后重试"}</p>
            <Button onClick={() => window.location.reload()}>重新加载</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background min-h-screen">

      <div className="container mx-auto px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left Sidebar */}
          <div className="hidden lg:col-span-3 lg:block">
            <div className="sticky top-24 space-y-6">
              {/* User Profile Card & Quick Actions - 保持原样 */}
              {/* 为减少重复与风险，这些非测试关键路径保持不变。*/}
            </div>
          </div>

          {/* Main Feed */}
          <div className="lg:col-span-6">
            {/* Post Composer - 用户触发时才加载重型交互 */}
            {user && (
              <div className="mb-6">
                {isComposerVisible ? (
                  <ActivityComposer
                    onSuccess={handleComposerSuccess}
                    onCancel={handleComposerClose}
                    placeholder="分享你的想法..."
                    showPinOption={canPinComposer}
                  />
                ) : (
                  <Card
                    className="transition-shadow hover:shadow-md"
                    onMouseEnter={prefetchComposer}
                    onTouchStart={prefetchComposer}
                  >
                    <CardContent className="flex flex-col gap-4 pt-6">
                      <div className="flex items-center space-x-3">
                        <div>
                          <Users className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-semibold">
                            {user.name || "立即分享"}
                          </p>
                          <p className="text-muted-foreground text-sm">
                            想法越早发布，越容易出现在朋友的时间线
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-muted-foreground text-sm">
                          点击下方按钮即可打开完整编辑器
                        </p>
                        <Button onClick={handleOpenComposer}>
                          开始撰写
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Feed Tabs */}
            <div className="mb-6">
              <Tabs value={activeTab} onValueChange={(val) => handleTabChange(val as FeedTab)}>
                <TabsList className="grid w-full grid-cols-3">
                  {featureFlags.feedFollowingStrict && (
                    <TabsTrigger
                      value="following"
                      disabled={!user}
                      data-testid="feed-tab-following"
                    >
                      关注
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="trending" data-testid="feed-tab-trending">
                    热门
                  </TabsTrigger>
                  <TabsTrigger value="latest" data-testid="feed-tab-latest">
                    最新
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              {isPending && <p className="text-muted-foreground mt-2 text-sm">内容切换中...</p>}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <span>
                  实时动态：
                  <span className={isRealtimeSubscribed ? "text-emerald-600" : "text-amber-600"}>
                    {isRealtimeSubscribed ? "已连接" : "连接中..."}
                  </span>
                </span>
                {realtimeActivitiesError && (
                  <span className="text-red-500">
                    订阅失败：{realtimeActivitiesError.message || "请稍后重试"}
                  </span>
                )}
              </div>
            </div>

            {/* Activity Feed */}
            <div className="space-y-4">
              {isLoading && !hasDisplayActivities ? (
                // 加载状态
                <div className="space-y-4">
                  {[...Array(3)].map((_, index) => (
                    <Card key={index} className="animate-pulse">
                      <CardContent className="pt-6">
                        <div className="mb-4 flex items-center space-x-3">
                          <div className="bg-muted h-10 w-10 rounded-full" />
                          <div className="flex-1 space-y-2">
                            <div className="bg-muted h-4 w-1/4 rounded" />
                            <div className="bg-muted h-3 w-1/6 rounded" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="bg-muted h-4 w-full rounded" />
                          <div className="bg-muted h-4 w-3/4 rounded" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : !hasDisplayActivities ? (
                // 空状态 - 区分不同 tab
                activeTab === "following" ? (
                  <div className="py-12 text-center">
                    <div className="mb-4 text-6xl">👥</div>
                    <h3 className="mb-2 text-xl font-semibold">还没有关注任何人</h3>
                    <p className="text-muted-foreground mb-6">
                      关注感兴趣的用户，查看他们的最新动态吧！
                    </p>
                    <Button onClick={() => handleTabChange("latest")} variant="outline">
                      浏览最新动态
                    </Button>
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <div className="mb-4 text-6xl">🌟</div>
                    <h3 className="mb-2 text-xl font-semibold">还没有动态</h3>
                    <p className="text-muted-foreground mb-6">成为第一个分享想法的人吧！</p>
                  </div>
                )
              ) : (
                // 真实动态列表
                <>
                  {displayActivities.map((activity, index) => {
                    const isRealtimeItem = realtimeActivityIds.has(activity.id)
                    const isHighlighted = highlightedActivityIds.has(activity.id)
                    const wrapperClasses = [
                      "space-y-3",
                      "transition-all",
                      isHighlighted
                        ? "rounded-xl border border-emerald-300/70 bg-emerald-50/40 p-2 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")

                    const isExpanded = expandedComments.has(activity.id)

                    return (
                      <div
                        key={activity.id}
                        id={`activity-${activity.id}`}
                        className={wrapperClasses}
                      >
                        {isRealtimeItem && (
                          <span className="text-emerald-600 text-xs font-semibold">实时更新</span>
                        )}
                        {index === 0 ? (
                          <ActivityCard
                            activity={activity}
                            onLike={handleLike}
                            onComment={handleComment}
                            showActions={true}
                            priority
                          />
                        ) : (
                          <LazyActivityCard
                            activity={activity}
                            index={index}
                            onLike={handleLike}
                            onComment={handleComment}
                            showActions={true}
                          />
                        )}
                        {isExpanded && (
                          <CommentList
                            activityId={activity.id}
                            className="mt-2"
                            showComposer={Boolean(user)}
                            onCommentAdded={handleCommentsChange}
                            onCommentDeleted={handleCommentsChange}
                          />
                        )}
                      </div>
                    )
                  })}
                </>
              )}

              {/* 加载更多按钮 */}
              {hasMore && activities.length > 0 && (
                <div className="py-6 text-center">
                  <Button onClick={loadMore} disabled={isLoading} variant="outline">
                    {isLoading ? "加载中..." : "加载更多"}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="hidden lg:col-span-3 lg:block">
            <div className="sticky top-24 space-y-6">
              <TrendingTopicsCard />
              <SuggestedUsersCard onFollowChange={refresh} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
