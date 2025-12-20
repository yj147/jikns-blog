"use client"

import { useMemo, useCallback } from "react"
import { ActivityCard } from "@/components/activity-card"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"
import { Virtuoso } from "@/components/common/virtual-list"
import type { ActivityWithAuthor } from "@/types/activity"

interface ActivityErrorStateProps {
  isError: boolean
  message?: string
  onRetry: () => void
}

function ActivityErrorState({ isError, message, onRetry }: ActivityErrorStateProps) {
  if (!isError) return null

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-center space-x-2 text-red-500">
          <AlertCircle className="h-5 w-5" />
          <p>加载动态时出错：{message}</p>
        </div>
        <div className="mt-4 flex justify-center">
          <Button onClick={onRetry} variant="outline" size="sm">
            重试
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function ActivitySkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index}>
          <CardContent className="pt-6">
            <div className="flex space-x-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center space-x-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-16 w-full" />
                <div className="flex space-x-4">
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

interface ActivityEmptyStateProps {
  shouldShow: boolean
  hasActiveFilters: boolean
  searchQuery: string
  onClearAll: () => void
}

function ActivityEmptyState({
  shouldShow,
  hasActiveFilters,
  searchQuery,
  onClearAll,
}: ActivityEmptyStateProps) {
  if (!shouldShow) return null

  const hasConstraints = hasActiveFilters || !!searchQuery

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="py-8 text-center">
          <div className="text-muted-foreground mb-2 text-lg">
            {hasConstraints ? "没有找到匹配的动态" : "还没有动态"}
          </div>
          <p className="text-muted-foreground mb-4 text-sm">
            {hasConstraints ? "尝试调整搜索条件或清除过滤器" : "成为第一个发布动态的人吧！"}
          </p>
          {hasConstraints && (
            <Button onClick={onClearAll} variant="outline">
              清除所有过滤器
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

interface ActivityLoadMoreSectionProps {
  hasMore: boolean
  isLoading: boolean
  loadMore: () => void
}

function ActivityLoadMoreSection({ hasMore, isLoading, loadMore }: ActivityLoadMoreSectionProps) {
  if (!hasMore) return null

  return (
    <div className="py-2 text-center">
      <Button
        data-testid="activity-load-more-button"
        onClick={loadMore}
        disabled={isLoading}
        variant="outline"
        size="sm"
      >
        {isLoading ? "加载中..." : "加载更多"}
      </Button>
    </div>
  )
}

function ActivityCompletionNotice({ shouldShow }: { shouldShow: boolean }) {
  if (!shouldShow) return null

  return (
    <div className="py-4 text-center">
      <div className="text-muted-foreground text-sm">已加载全部动态</div>
    </div>
  )
}

export interface ActivityFeedViewProps {
  activities: ActivityWithAuthor[]
  isLoading: boolean
  isError: boolean
  error: Error | null
  hasMore: boolean
  loadMore: () => void
  searchQuery: string
  hasActiveFilters: boolean
  clearAllFilters: () => void
  onRetry: () => void
  onEdit?: (activity: ActivityWithAuthor) => void
  onDelete?: (activity: ActivityWithAuthor) => void
}

export function ActivityFeedView({
  activities,
  isLoading,
  isError,
  error,
  hasMore,
  loadMore,
  searchQuery,
  hasActiveFilters,
  clearAllFilters,
  onRetry,
  onEdit,
  onDelete,
}: ActivityFeedViewProps) {
  const shouldShowEmpty = useMemo(
    () => !isLoading && !isError && activities.length === 0,
    [activities.length, isError, isLoading]
  )
  const shouldShowCompletion = useMemo(
    () => !hasMore && activities.length > 0 && !isLoading,
    [activities.length, hasMore, isLoading]
  )

  const handleEndReached = useCallback(() => {
    if (hasMore && !isLoading) {
      loadMore()
    }
  }, [hasMore, isLoading, loadMore])

  const renderActivity = useCallback(
    (index: number, activity: ActivityWithAuthor) => (
      <div style={{ paddingBottom: index === activities.length - 1 ? 0 : 16 }}>
        <ActivityCard activity={activity} onEdit={onEdit} onDelete={onDelete} />
      </div>
    ),
    [activities.length, onDelete, onEdit]
  )

  return (
    <div className="space-y-4">
      <ActivityErrorState isError={isError} message={error?.message} onRetry={onRetry} />

      <Virtuoso
        data={activities}
        useWindowScroll
        itemContent={renderActivity}
        endReached={handleEndReached}
      />

      {isLoading && <ActivitySkeletonList />}

      <ActivityLoadMoreSection hasMore={hasMore} isLoading={isLoading} loadMore={loadMore} />

      <ActivityEmptyState
        shouldShow={shouldShowEmpty}
        hasActiveFilters={hasActiveFilters}
        searchQuery={searchQuery}
        onClearAll={clearAllFilters}
      />

      <ActivityCompletionNotice shouldShow={shouldShowCompletion} />
    </div>
  )
}
