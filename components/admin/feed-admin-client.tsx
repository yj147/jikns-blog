"use client"

import { useEffect, useMemo, useState } from "react"
import useSWR, { mutate as globalMutate } from "swr"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/components/ui/use-toast"
import { FeedDetailPanel } from "@/components/admin/feed-detail-panel"
import { FeedFilters } from "@/components/admin/feed-filters"
import { FeedTable } from "@/components/admin/feed-table"
import type { ApiResponse } from "@/lib/api-guards"
import { fetchJson, FetchError } from "@/lib/api/fetch-json"
import { useFeedFilters } from "@/hooks/useFeedFilters"
import { useAuth } from "@/hooks/use-auth"
import type { AdminFeedActionInput, FeedActionResult, FeedItem, FeedListResponse } from "@/types/feed"
import { Eye, EyeOff, ListChecks, Loader2, Pin, PinOff, RefreshCw, ShieldAlert, Trash2 } from "lucide-react"

const LIST_ENDPOINT = "/api/admin/feeds"
const BATCH_ENDPOINT = "/api/admin/feeds/batch"
const EMPTY_FEEDS: FeedItem[] = []
const fetchFeeds = (url: string) => fetchJson<ApiResponse<FeedListResponse>>(url)

type FeedBatchAction = AdminFeedActionInput["action"]

const ACTION_CONFIG: Record<FeedBatchAction, { label: string; description: string; icon: typeof Trash2; variant: "destructive" | "outline" | "secondary" }> = {
  delete: {
    label: "删除",
    description: "删除后不可恢复，请谨慎操作。",
    icon: Trash2,
    variant: "destructive",
  },
  hide: {
    label: "隐藏",
    description: "隐藏后对前台不可见，可在稍后取消。",
    icon: EyeOff,
    variant: "outline",
  },
  unhide: {
    label: "取消隐藏",
    description: "恢复动态的可见状态。",
    icon: Eye,
    variant: "outline",
  },
  pin: {
    label: "置顶",
    description: "将动态固定在前台列表顶部。",
    icon: Pin,
    variant: "outline",
  },
  unpin: {
    label: "取消置顶",
    description: "移除置顶标记。",
    icon: PinOff,
    variant: "outline",
  },
}

function extractData<T>(payload?: ApiResponse<T> | T | null): T | undefined {
  if (!payload) return undefined
  if (typeof payload === "object" && "success" in payload) {
    return (payload as ApiResponse<T>).data
  }
  return payload as T
}

export default function FeedAdminClient() {
  const { toast } = useToast()
  const { user, isAdmin } = useAuth()
  const currentUserId = user?.id ?? null

  const {
    filters,
    queryString,
    hasActiveFilters,
    setSearch,
    setAuthorId,
    setPinned,
    setIncludeDeleted,
    setDateRange,
    setPage,
    page,
    resetFilters,
  } = useFeedFilters({
    initialFilters: { includeDeleted: false },
    initialPage: 1,
  })

  useEffect(() => {
    if (!isAdmin && filters.includeDeleted) {
      setIncludeDeleted(false)
    }
  }, [filters.includeDeleted, isAdmin, setIncludeDeleted])

  const revalidateActivities = () =>
    globalMutate(
      (key) => typeof key === "string" && key.startsWith("/api/activities"),
      undefined,
      { revalidate: true }
    )

  const endpoint = useMemo(() => (queryString ? `${LIST_ENDPOINT}?${queryString}` : LIST_ENDPOINT), [queryString])

  const { data, error, isLoading, isValidating, mutate } = useSWR<ApiResponse<FeedListResponse>>(endpoint, fetchFeeds, {
    keepPreviousData: true,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
  })

  const payload = extractData<FeedListResponse>(data)
  const feeds = payload?.feeds ?? EMPTY_FEEDS
  const pagination = payload?.pagination ?? {
    currentPage: page,
    totalPages: 1,
    totalCount: 0,
    hasNext: false,
    hasPrev: false,
  }

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [detailFeed, setDetailFeed] = useState<FeedItem | null>(null)
  const [pendingAction, setPendingAction] = useState<FeedBatchAction | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => feeds.some((feed) => feed.id === id)))
  }, [feeds])

  const handleToggleItem = (feedId: string) => {
    setSelectedIds((prev) => (prev.includes(feedId) ? prev.filter((id) => id !== feedId) : [...prev, feedId]))
  }

  const handleToggleAll = () => {
    if (feeds.length === 0) return
    const allSelected = feeds.every((feed) => selectedIds.includes(feed.id))
    setSelectedIds(allSelected ? [] : feeds.map((feed) => feed.id))
  }

  const handleActionConfirm = async () => {
    if (!pendingAction || selectedIds.length === 0) return
    const action: FeedBatchAction = pendingAction
    const skipOptimistic = action === "unhide"
    setIsSubmitting(true)

    try {
      const selectedSet = new Set(selectedIds)
      const timestamp = new Date().toISOString()
      const matchesClientFilters = (feed: FeedItem) => {
        if (!filters.includeDeleted && feed.deletedAt) return false
        if (filters.pinned === "pinned" && !feed.isPinned) return false
        if (filters.pinned === "unpinned" && feed.isPinned) return false
        return true
      }

      if (!skipOptimistic) {
        await mutate(
          (current) => {
            if (!current?.data) return current

            const updatedFeeds = current.data.feeds.reduce<FeedItem[]>((acc, feed) => {
              if (!selectedSet.has(feed.id)) {
                acc.push(feed)
                return acc
              }

              let nextFeed: FeedItem
              switch (action) {
                case "delete":
                case "hide":
                  nextFeed = { ...feed, deletedAt: timestamp }
                  break
                case "pin":
                  nextFeed = { ...feed, isPinned: true }
                  break
                case "unpin":
                  nextFeed = { ...feed, isPinned: false }
                  break
                default:
                  nextFeed = feed
              }

              if (!matchesClientFilters(nextFeed)) {
                return acc
              }

              acc.push(nextFeed)
              return acc
            }, [])

            return {
              ...current,
              data: {
                ...current.data,
                feeds: updatedFeeds,
              },
            }
          },
          { revalidate: false }
        )
      }

      const response = await fetchJson<ApiResponse<FeedActionResult>>(BATCH_ENDPOINT, {
        method: "POST",
        body: JSON.stringify({ action, ids: selectedIds }),
      })
      const success = response?.success ?? true
      const result = extractData<FeedActionResult>(response)

      if (!success || !result) {
        throw new FetchError("批量操作失败", response?.error?.statusCode ?? 500)
      }

      toast({
        title: `${ACTION_CONFIG[action].label}成功`,
        description: `影响 ${result.affected} 条动态`,
      })

      setSelectedIds([])
      setPendingAction(null)
      await Promise.all([mutate(undefined, { revalidate: true }), revalidateActivities()])
    } catch (err) {
      const message = err instanceof FetchError ? err.message : "批量操作失败"
      toast({ variant: "destructive", title: message })

      await mutate(undefined, { revalidate: true })
    } finally {
      setIsSubmitting(false)
    }
  }

  const visibleActions: FeedBatchAction[] = isAdmin
    ? ["delete", "hide", "unhide", "pin", "unpin"]
    : ["hide", "unhide", "pin", "unpin"]

  const selectedCount = selectedIds.length
  const listLoading = isLoading && !payload
  const hasError = Boolean(error)
  const errorMessage = error instanceof FetchError ? error.message : "加载动态失败"

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Feed 管理</h1>
          <p className="text-muted-foreground text-sm">
            检索、筛选并批量操作动态，保障内容安全与运营效率。
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isValidating && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <Button variant="outline" size="sm" onClick={() => mutate()} disabled={isValidating}>
            <RefreshCw className="mr-1 h-4 w-4" />
            刷新
          </Button>
        </div>
      </header>

      {!isAdmin && (
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>权限限制</AlertTitle>
          <AlertDescription>您当前仅能管理自己发布的动态，系统已自动隐藏其他作者的数据。</AlertDescription>
        </Alert>
      )}

      {hasError && (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>{errorMessage}</span>
            <Button variant="secondary" size="sm" onClick={() => mutate()}>
              重试
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <FeedFilters
        filters={filters}
        isAdmin={isAdmin}
        hasActiveFilters={hasActiveFilters}
        currentUserId={currentUserId}
        onSearchChange={setSearch}
        onAuthorChange={setAuthorId}
        onPinnedChange={setPinned}
        onIncludeDeletedChange={setIncludeDeleted}
        onDateRangeChange={setDateRange}
        onReset={resetFilters}
      />

      {selectedCount > 0 && (
        <Alert>
          <AlertTitle>已选择 {selectedCount} 条动态</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-muted-foreground">
              批量操作前请再次确认，删除操作不可恢复。
            </span>
            <Button variant="secondary" size="sm" onClick={() => setSelectedIds([])}>
              清除选择
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <section className="rounded-xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4" />
            <span>共 {pagination.totalCount} 条记录</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {visibleActions.map((action) => {
              const config = ACTION_CONFIG[action]
              const Icon = config.icon
              const disabled = selectedCount === 0 || isSubmitting
              return (
                <Button
                  key={action}
                  variant={config.variant}
                  size="sm"
                  disabled={disabled}
                  onClick={() => setPendingAction(action)}
                >
                  <Icon className="mr-1 h-4 w-4" />
                  {config.label}
                </Button>
              )
            })}
          </div>
          {isSubmitting && (
            <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              批量操作执行中...
            </div>
          )}
        </div>

        <div className="px-4 py-2">
          <FeedTable
            feeds={feeds}
            selectedIds={selectedIds}
            onToggleItem={handleToggleItem}
            onToggleAll={handleToggleAll}
            onOpenDetail={setDetailFeed}
            isLoading={listLoading}
          />

          {!listLoading && feeds.length === 0 && !hasError && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <p className="mb-3 font-medium">暂无符合条件的动态</p>
              <div className="flex justify-center gap-2">
                <Button variant="outline" size="sm" onClick={() => mutate()}>
                  <RefreshCw className="mr-1 h-4 w-4" />
                  刷新
                </Button>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={resetFilters}>
                    清空筛选
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        <Separator />
        <footer className="flex flex-col gap-3 px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div>
            第 {pagination.currentPage} / {pagination.totalPages} 页
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.hasPrev || isLoading}
              onClick={() => setPage(Math.max(1, pagination.currentPage - 1))}
            >
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.hasNext || isLoading}
              onClick={() => setPage(Math.min(pagination.totalPages, pagination.currentPage + 1))}
            >
              下一页
            </Button>
          </div>
        </footer>
      </section>

      <AlertDialog open={pendingAction !== null} onOpenChange={(open) => !open && !isSubmitting && setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction ? ACTION_CONFIG[pendingAction].label : "批量操作"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction ? ACTION_CONFIG[pendingAction].description : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting} onClick={() => setPendingAction(null)}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction disabled={isSubmitting} onClick={handleActionConfirm}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认执行
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <FeedDetailPanel
        feed={detailFeed}
        open={detailFeed !== null}
        onOpenChange={(open) => {
          if (!open) setDetailFeed(null)
        }}
      />
    </div>
  )
}
