"use client"

import dynamic from "next/dynamic"
import { useCallback, useInsertionEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { FeedHeader } from "@/components/feed/feed-header"
import { FeedList } from "@/components/feed/feed-list"
import { ActivityEditDialog } from "@/components/activity/activity-edit-dialog"
import { ActivityDeleteDialog } from "@/components/activity/activity-delete-dialog"
import { useFeedState, type FeedTab } from "@/components/feed/hooks/use-feed-state"
import { useAuth } from "@/hooks/use-auth"
import type { ClientFeatureFlags } from "@/lib/config/client-feature-flags"
import type { ActivityWithAuthor } from "@/types/activity"

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

const SuggestedUsersCard = dynamic(() => import("@/components/feed/suggested-users-card"), {
  ssr: true,
  loading: () => (
    <div className="space-y-4 p-4">
      <div className="h-4 w-1/3 rounded bg-muted animate-pulse" />
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
              <div className="h-2 w-1/3 bg-muted rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  ),
})

const TrendingTopicsCard = dynamic(() => import("@/components/feed/trending-topics-card"), {
  ssr: true,
  loading: () => (
    <div className="space-y-4 p-4">
      <div className="h-4 w-1/3 rounded bg-muted animate-pulse" />
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-8 bg-muted rounded animate-pulse" />
        ))}
      </div>
    </div>
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
  } catch (error) {
    // ignore
  }
}

const ActivityComposer = dynamic(
  () => import("@/components/activity/activity-form").then((mod) => mod.ActivityForm),
  {
    ssr: false,
    loading: () => (
      <div className="flex gap-4 p-4 animate-pulse">
        <div className="h-10 w-10 rounded-full bg-muted" />
        <div className="flex-1 h-24 bg-muted rounded-xl" />
      </div>
    ),
  }
)

export default function FeedPageClient({
  featureFlags,
  initialActivities,
  initialPagination,
  initialTab,
  highlightActivityId,
}: FeedPageClientProps) {
  const { user } = useAuth()
  const canPinComposer = user?.role === "ADMIN"
  const feedMeasurementRecordedRef = useRef(false)

  // 编辑/删除对话框状态
  const [editingActivity, setEditingActivity] = useState<ActivityWithAuthor | null>(null)
  const [deletingActivity, setDeletingActivity] = useState<ActivityWithAuthor | null>(null)

  const {
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
    isRealtimeSubscribed,
    loadMore,
    realtimeActivityIds,
    realtimeActivitiesError,
    refresh,
    resolvedOrderBy,
    error,
  } = useFeedState({
    initialActivities,
    initialPagination,
    initialTab,
    highlightActivityId,
    user,
  })

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

  const activitiesMeasureBase = useMemo(
    () => `${PERFORMANCE_LABELS.activitiesBase}-${resolvedOrderBy}`,
    [resolvedOrderBy]
  )
  const activitiesStartMark = `${activitiesMeasureBase}-start`
  const activitiesEndMark = `${activitiesMeasureBase}-end`
  const activitiesMeasureName = `${activitiesMeasureBase}-duration`

  useInsertionEffect(() => {
    if (!activities.length) return
    markUserTiming(activitiesStartMark)
  }, [activities.length, activitiesStartMark])

  useLayoutEffect(() => {
    if (!activities.length) return
    markUserTiming(activitiesEndMark)
    measureUserTiming(activitiesMeasureName, activitiesStartMark, activitiesEndMark)
  }, [activities.length, activitiesEndMark, activitiesMeasureName, activitiesStartMark])

  // 编辑/删除回调
  const handleEdit = useCallback((activity: ActivityWithAuthor) => {
    setEditingActivity(activity)
  }, [])

  const handleDelete = useCallback((activity: ActivityWithAuthor) => {
    setDeletingActivity(activity)
  }, [])

  const handleEditSuccess = useCallback(() => {
    setEditingActivity(null)
    refresh()
  }, [refresh])

  const handleDeleteSuccess = useCallback(() => {
    setDeletingActivity(null)
    refresh()
  }, [refresh])

  if (isError) {
    return (
      <div className="bg-background min-h-screen flex flex-col items-center justify-center p-8">
        <h3 className="text-lg font-semibold mb-2">加载失败</h3>
        <p className="text-muted-foreground mb-4">{error?.message || "请稍后重试"}</p>
        <Button onClick={() => window.location.reload()}>重新加载</Button>
      </div>
    )
  }

  return (
    <div className="bg-background min-h-screen">
      <div className="mx-auto flex max-w-[1000px] justify-center gap-0 lg:gap-8">
        {/* 主内容区 - 固定宽度，移动端无边框 */}
        <div className="w-full max-w-[600px] lg:border-x lg:border-border">
          <FeedHeader
            activeTab={activeTab}
            featureFlags={featureFlags}
            isRealtimeSubscribed={isRealtimeSubscribed}
            isLoading={isLoading}
            onRefresh={refresh}
            onTabChange={handleTabChange}
            user={user}
          />

          {realtimeActivitiesError && (
            <div className="mx-4 mt-4 rounded-md bg-destructive/10 px-4 py-2 text-xs text-destructive flex items-center justify-center">
              实时连接断开，尝试重连中...
            </div>
          )}

          {user && (
            <div className="border-b border-border px-4 py-4">
              <ActivityComposer
                onSuccess={() => refresh()}
                placeholder="有什么新鲜事？"
                showPinOption={canPinComposer}
              />
            </div>
          )}

          <FeedList
            activities={displayActivities}
            activeTab={activeTab}
            highlightedActivityIds={highlightedActivityIds}
            realtimeActivityIds={realtimeActivityIds}
            hasDisplayActivities={hasDisplayActivities}
            hasMore={hasMore}
            isLoading={isLoading}
            onLoadMore={loadMore}
            onLike={handleLike}
            onCommentsChange={handleCommentsChange}
            onEdit={handleEdit}
            onDelete={handleDelete}
            user={user}
            baseActivitiesCount={activities.length}
          />
        </div>

        {/* 侧边栏 - 固定宽度 */}
        <div className="hidden w-[350px] shrink-0 lg:block">
          <div className="sticky top-20 space-y-4 py-4">
            <div className="rounded-xl bg-muted/30 overflow-hidden">
              <h3 className="font-bold px-4 pt-4 pb-2 text-lg">热门话题</h3>
              <TrendingTopicsCard />
            </div>

            <div className="rounded-xl bg-muted/30 overflow-hidden">
              <h3 className="font-bold px-4 pt-4 pb-2 text-lg">推荐关注</h3>
              <SuggestedUsersCard onFollowChange={refresh} />
            </div>

            <div className="px-4 text-xs text-muted-foreground">
              <p>&copy; 2025 现代博客平台</p>
            </div>
          </div>
        </div>
      </div>

      {/* 编辑对话框 */}
      <ActivityEditDialog
        activity={editingActivity}
        open={!!editingActivity}
        onOpenChange={(open) => !open && setEditingActivity(null)}
        onSuccess={handleEditSuccess}
      />

      {/* 删除确认对话框 */}
      <ActivityDeleteDialog
        activity={deletingActivity}
        open={!!deletingActivity}
        onOpenChange={(open) => !open && setDeletingActivity(null)}
        onSuccess={handleDeleteSuccess}
      />
    </div>
  )
}
