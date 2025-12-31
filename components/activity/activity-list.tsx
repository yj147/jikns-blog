"use client"

import dynamic from "next/dynamic"
import { useState, useCallback, useMemo, useEffect } from "react"
import { useAuth } from "@/app/providers/auth-provider"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ActivityFiltersDialog } from "@/components/activity/activity-filters-dialog"
import { ActivityForm } from "./activity-form"
import { ActivityToolbar, ActivityMetaSummary } from "@/components/activity/activity-toolbar"
import { ActivityFeedView } from "@/components/activity/activity-feed-view"
import { useActivities } from "@/hooks/use-activities"
import { useActivityFilters, MIN_SEARCH_LENGTH } from "@/hooks/use-activity-filters"
import { ActivityWithAuthor, ActivityOrderBy, ActivityQueryParams } from "@/types/activity"
import { cn } from "@/lib/utils"

const ActivityDeleteDialog = dynamic(
  () =>
    import("@/components/activity/activity-delete-dialog").then((mod) => mod.ActivityDeleteDialog),
  { ssr: false }
)

interface ActivityListProps {
  userId?: string
  orderBy?: ActivityOrderBy
  showComposer?: boolean
  showFilters?: boolean
  limit?: number
  onActivityUpdate?: (activity: ActivityWithAuthor) => void
  className?: string
}

interface ActivityListControllerOptions {
  userId?: string
  orderBy: ActivityOrderBy
  limit: number
}

interface ActivityEditorDialogProps {
  activity: ActivityWithAuthor | null
  onDismiss: () => void
  onSuccess: (activity: ActivityWithAuthor) => void
  canPin: boolean
}

function ActivityEditorDialog({
  activity,
  onDismiss,
  onSuccess,
  canPin,
}: ActivityEditorDialogProps) {
  if (!activity) return null

  return (
    <Dialog open={!!activity} onOpenChange={onDismiss}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>编辑动态</DialogTitle>
          <DialogDescription>修改你的动态内容</DialogDescription>
        </DialogHeader>
        <ActivityForm
          mode="edit"
          initialData={activity}
          onSuccess={onSuccess}
          onCancel={onDismiss}
          showPinOption={canPin}
        />
      </DialogContent>
    </Dialog>
  )
}

function useActivityListController({ userId, orderBy, limit }: ActivityListControllerOptions) {
  const { user } = useAuth()
  const filterState = useActivityFilters({ orderBy, userId })
  const { filters, updateOrder } = filterState

  const queryParams = useMemo<Partial<ActivityQueryParams>>(() => {
    const params: Partial<ActivityQueryParams> = {
      orderBy: filters.orderBy,
      authorId: filters.authorId,
      limit,
    }

    if (typeof filters.hasImages === "boolean") {
      params.hasImages = filters.hasImages
    }
    if (typeof filters.isPinned === "boolean") {
      params.isPinned = filters.isPinned
    }
    if (filters.searchTerm) {
      params.q = filters.searchTerm
    }
    if (filters.dateRange?.start) {
      params.dateFrom = filters.dateRange.start
    }
    if (filters.dateRange?.end) {
      params.dateTo = filters.dateRange.end
    }
    if (filters.tags && filters.tags.length > 0) {
      params.tags = filters.tags
    }

    return params
  }, [filters, limit])

  const activitiesState = useActivities(queryParams)
  const { hasMore, isLoading, loadMore } = activitiesState
  const canViewFollowing = !!user

  useEffect(() => {
    if (!canViewFollowing && filters.orderBy === ActivityOrderBy.FOLLOWING) {
      updateOrder(ActivityOrderBy.LATEST)
    }
  }, [canViewFollowing, filters.orderBy, updateOrder])

  return {
    user,
    canViewFollowing,
    filterState,
    activitiesState,
  }
}

export function ActivityList({
  userId,
  orderBy = ActivityOrderBy.LATEST,
  showComposer = true,
  showFilters = true,
  limit = 20,
  onActivityUpdate,
  className = "",
}: ActivityListProps) {
  const [editingActivity, setEditingActivity] = useState<ActivityWithAuthor | null>(null)
  const [deletingActivity, setDeletingActivity] = useState<ActivityWithAuthor | null>(null)
  const { user, canViewFollowing, filterState, activitiesState } = useActivityListController({
    userId,
    orderBy,
    limit,
  })

  const {
    filters,
    searchDraft,
    setSearchDraft,
    tagDraft,
    setTagDraft,
    dateFromDraft,
    setDateFromDraft,
    dateToDraft,
    setDateToDraft,
    showFiltersDialog,
    setShowFiltersDialog,
    hasActiveFilters,
    applySearch,
    clearSearch,
    applyTags,
    clearTagsAndDates,
    clearAllFilters,
    handleDateChange,
    mergeFilters,
    updateOrder,
  } = filterState

  const {
    activities,
    isLoading,
    isError,
    error,
    hasMore,
    total,
    appliedFilters,
    loadMore,
    refresh,
  } = activitiesState

  const searchQuery = filters.searchTerm ?? ""

  const handleOrderChange = useCallback(
    (newOrder: ActivityOrderBy) => {
      updateOrder(newOrder)
    },
    [updateOrder]
  )

  const handleEditActivity = useCallback((activity: ActivityWithAuthor) => {
    setEditingActivity(activity)
  }, [])

  const handleDeleteActivity = useCallback((activity: ActivityWithAuthor) => {
    setDeletingActivity(activity)
  }, [])

  const handleEditComplete = useCallback(
    (activity: ActivityWithAuthor) => {
      setEditingActivity(null)
      onActivityUpdate?.(activity)
      refresh()
    },
    [onActivityUpdate, refresh]
  )

  const handleDeleteComplete = useCallback(() => {
    setDeletingActivity(null)
    refresh()
  }, [refresh])

  const handleApplySearch = useCallback(() => {
    const result = applySearch()
    if (!result.success && result.reason === "too-short") {
      toast.error(`搜索关键词至少需要 ${MIN_SEARCH_LENGTH} 个字符`)
    }
  }, [applySearch])

  const canPinComposer = !!user
  const canPinEditing =
    !!user && !!editingActivity
      ? user.role === "ADMIN" || editingActivity.authorId === user.id
      : false

  return (
    <div className={cn("space-y-6", className)}>
      {showComposer && user && (
        <ActivityForm
          onSuccess={refresh}
          placeholder="分享你的想法..."
          showPinOption={canPinComposer}
        />
      )}

      <ActivityToolbar
        filters={filters}
        canViewFollowing={canViewFollowing}
        onOrderChange={handleOrderChange}
        searchDraft={searchDraft}
        onSearchDraftChange={setSearchDraft}
        onApplySearch={handleApplySearch}
        onClearSearch={clearSearch}
        hasActiveFilters={hasActiveFilters}
        showFilters={showFilters}
        onOpenFilters={() => setShowFiltersDialog(true)}
        onRefresh={refresh}
        isLoading={isLoading}
      />

      {showFilters && (
        <ActivityFiltersDialog
          open={showFiltersDialog}
          onOpenChange={setShowFiltersDialog}
          filters={filters}
          hasActiveFilters={hasActiveFilters}
          canFilterPinned={user?.role === "ADMIN"}
          tagDraft={tagDraft}
          onTagDraftChange={setTagDraft}
          applyTags={applyTags}
          dateFromDraft={dateFromDraft}
          onDateFromChange={setDateFromDraft}
          dateToDraft={dateToDraft}
          onDateToChange={setDateToDraft}
          handleDateChange={handleDateChange}
          clearTagsAndDates={clearTagsAndDates}
          clearAllFilters={clearAllFilters}
          mergeFilters={mergeFilters}
        />
      )}

      <ActivityMetaSummary total={total} appliedFilters={appliedFilters ?? null} />

      <ActivityFeedView
        activities={activities}
        isLoading={isLoading}
        isError={isError}
        error={error}
        hasMore={hasMore}
        loadMore={loadMore}
        searchQuery={searchQuery}
        hasActiveFilters={hasActiveFilters}
        clearAllFilters={clearAllFilters}
        onRetry={refresh}
        onEdit={handleEditActivity}
        onDelete={handleDeleteActivity}
      />

      <ActivityEditorDialog
        activity={editingActivity}
        onDismiss={() => setEditingActivity(null)}
        onSuccess={handleEditComplete}
        canPin={canPinEditing}
      />

      <ActivityDeleteDialog
        activity={deletingActivity}
        open={!!deletingActivity}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingActivity(null)
          }
        }}
        onSuccess={handleDeleteComplete}
      />
    </div>
  )
}
