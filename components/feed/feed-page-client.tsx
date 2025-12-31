"use client"

import dynamic from "next/dynamic"
import { useCallback, useState } from "react"
import { Button } from "@/components/ui/button"
import { FeedHeader } from "@/components/feed/feed-header"
import { FeedList } from "@/components/feed/feed-list"
import TrendingTopicsCard from "@/components/feed/trending-topics-card"
import { useFeedState, type FeedTab } from "@/components/feed/hooks/use-feed-state"
import { useAuth } from "@/hooks/use-auth"
import type { ClientFeatureFlags } from "@/lib/config/client-feature-flags"
import type { ActivityWithAuthor } from "@/types/activity"

interface FeedPageClientProps {
  featureFlags: ClientFeatureFlags
  initialActivities: ActivityWithAuthor[]
  initialPagination: {
    limit: number
    total: number | null
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
      <div className="bg-muted h-4 w-1/3 animate-pulse rounded" />
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="bg-muted h-10 w-10 animate-pulse rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="bg-muted h-3 w-1/2 animate-pulse rounded" />
              <div className="bg-muted h-2 w-1/3 animate-pulse rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  ),
})

const ActivityEditDialog = dynamic(
  () => import("@/components/activity/activity-edit-dialog").then((mod) => mod.ActivityEditDialog),
  { ssr: false }
)

const ActivityDeleteDialog = dynamic(
  () =>
    import("@/components/activity/activity-delete-dialog").then((mod) => mod.ActivityDeleteDialog),
  { ssr: false }
)

const ActivityComposer = dynamic(
  () => import("@/components/activity/activity-form").then((mod) => mod.ActivityForm),
  {
    ssr: false,
    loading: () => (
      <div className="flex animate-pulse gap-4 p-4">
        <div className="bg-muted h-10 w-10 rounded-full" />
        <div className="bg-muted h-24 flex-1 rounded-xl" />
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
  const { user, session } = useAuth()
  const canPinComposer = user?.role === "ADMIN"
  const isAuthenticated = Boolean(session?.user)

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
    isAuthenticated,
  })

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
      <div className="bg-background flex min-h-screen flex-col items-center justify-center p-8">
        <h3 className="mb-2 text-lg font-semibold">加载失败</h3>
        <p className="text-muted-foreground mb-4">{error?.message || "请稍后重试"}</p>
        <Button onClick={() => window.location.reload()}>重新加载</Button>
      </div>
    )
  }

  return (
    <div className="bg-background min-h-screen">
      <div className="mx-auto flex max-w-[1000px] justify-center gap-0 lg:gap-8">
        {/* 主内容区 - 固定宽度，移动端无边框 */}
        <div className="lg:border-border w-full max-w-[600px] lg:border-x">
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
            <div className="bg-destructive/10 text-destructive mx-4 mt-4 flex items-center justify-center rounded-md px-4 py-2 text-xs">
              实时连接断开，尝试重连中...
            </div>
          )}

          {user && (
            <div className="border-border border-b px-4 py-4">
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
            <div className="bg-muted/30 overflow-hidden rounded-xl">
              <h3 className="px-4 pb-2 pt-4 text-lg font-bold">热门话题</h3>
              <TrendingTopicsCard />
            </div>

            {isAuthenticated ? (
              <div className="bg-muted/30 overflow-hidden rounded-xl">
                <h3 className="px-4 pb-2 pt-4 text-lg font-bold">推荐关注</h3>
                <SuggestedUsersCard onFollowChange={refresh} />
              </div>
            ) : null}

            <div className="text-muted-foreground px-4 text-xs">
              <p>&copy; 2025 现代博客平台</p>
            </div>
          </div>
        </div>
      </div>

      {/* 编辑对话框 */}
      {editingActivity ? (
        <ActivityEditDialog
          activity={editingActivity}
          open={true}
          onOpenChange={(open) => !open && setEditingActivity(null)}
          onSuccess={handleEditSuccess}
        />
      ) : null}

      {/* 删除确认对话框 */}
      {deletingActivity ? (
        <ActivityDeleteDialog
          activity={deletingActivity}
          open={true}
          onOpenChange={(open) => !open && setDeletingActivity(null)}
          onSuccess={handleDeleteSuccess}
        />
      ) : null}
    </div>
  )
}
