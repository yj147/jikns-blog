/**
 * 通知列表（支持按类型过滤与无限滚动）
 */
"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import useSWRInfinite from "swr/infinite"
import { Loader2, Inbox, BellRing } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { fetchJson } from "@/lib/api/fetch-json"
import { cn } from "@/lib/utils"
import { NotificationType } from "@/lib/generated/prisma"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { useRealtimeNotifications } from "@/hooks/use-realtime-notifications"
import NotificationItem from "./notification-item"
import type { NotificationListPayload, NotificationView } from "./types"

const PAGE_SIZE = 10

type NotificationApiResponse = {
  success: boolean
  data: NotificationListPayload
}

type FilterValue = NotificationType | "ALL"

const FILTERS: { label: string; value: FilterValue }[] = [
  { label: "全部", value: "ALL" },
  { label: "点赞", value: NotificationType.LIKE },
  { label: "评论", value: NotificationType.COMMENT },
  { label: "关注", value: NotificationType.FOLLOW },
  { label: "系统", value: NotificationType.SYSTEM },
]

const fetcher = (url: string) => fetchJson<NotificationApiResponse>(url)

function buildKey(
  pageIndex: number,
  previousPage: NotificationApiResponse | null,
  filter: FilterValue
) {
  if (previousPage && !previousPage.data.pagination.hasMore) {
    return null
  }

  const params = new URLSearchParams()
  params.set("limit", PAGE_SIZE.toString())
  params.set("page", String(pageIndex + 1))

  if (pageIndex > 0) {
    const cursor = previousPage?.data.pagination.nextCursor
    if (!cursor) return null
    params.set("cursor", cursor)
  }

  if (filter !== "ALL") {
    params.set("type", filter)
  }

  return `/api/notifications?${params.toString()}`
}

export interface NotificationListProps {
  initialType?: FilterValue
  className?: string
}

export function NotificationList({ initialType = "ALL", className }: NotificationListProps) {
  const [filter, setFilter] = useState<FilterValue>(initialType)
  const { toast } = useToast()
  const { user, supabase } = useAuth()

  const {
    data,
    error,
    isLoading,
    isValidating,
    size,
    setSize,
    mutate,
  } = useSWRInfinite<NotificationApiResponse>(
    (index, previous) => buildKey(index, previous, filter),
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    }
  )

  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const items: NotificationView[] = useMemo(
    () => (data ? data.flatMap((page) => page.data.items ?? []) : []),
    [data]
  )

  const unreadCount = data?.[0]?.data.unreadCount ?? 0
  const filteredUnreadCount = data?.[0]?.data.filteredUnreadCount ?? unreadCount
  const lastPage = data?.[data.length - 1]
  const hasMore = lastPage?.data.pagination.hasMore ?? false
  const isInitialLoading = isLoading && size === 1 && items.length === 0
  const isLoadingMore = isValidating && size > 1

  useEffect(() => {
    if (!sentinelRef.current) return
    const node = sentinelRef.current

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry.isIntersecting && hasMore && !isLoadingMore) {
          setSize((current) => current + 1)
        }
      },
      { rootMargin: "200px" }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, isLoadingMore, setSize])

  const handleFilterChange = (value: string) => {
    const nextFilter = (value as FilterValue) || "ALL"
    setFilter(nextFilter)
    void mutate([], false)
    void setSize(1)
  }

  const handleMarkAll = async () => {
    const unreadIds = items.filter((item) => !item.readAt).map((item) => item.id)
    if (!unreadIds.length) {
      toast({ title: "没有未读通知" })
      return
    }

    try {
      await fetchJson("/api/notifications", {
        method: "PATCH",
        body: JSON.stringify({ ids: unreadIds }),
      })
      await mutate()
    } catch (err) {
      const message = err instanceof Error ? err.message : "标记失败"
      toast({ title: message, variant: "destructive" })
    }
  }

  const handleMarkSingle = async (id: string) => {
    try {
      await fetchJson(`/api/notifications/${id}`, { method: "PATCH" })
      await mutate()
    } catch (err) {
      const message = err instanceof Error ? err.message : "标记失败"
      toast({ title: message, variant: "destructive" })
    }
  }

  const handleRealtimeInsert = useCallback(
    (notification: NotificationView) => {
      const unreadDelta = notification.readAt ? 0 : 1
      const matchesFilter = filter === "ALL" || notification.type === filter

      mutate((current) => {
        if (!current || !current.length) {
          return current
        }

        const exists = current.some((page) =>
          page?.data?.items?.some((item) => item.id === notification.id)
        )

        if (exists) {
          return current
        }

        return current.map((page, index) => {
          if (!page?.data) return page
          if (index !== 0) return page

          const baseItems = page.data.items ?? []
          const nextItems = matchesFilter
            ? [notification, ...baseItems].slice(0, PAGE_SIZE)
            : baseItems

          const filteredDelta = matchesFilter ? unreadDelta : 0

          return {
            ...page,
            data: {
              ...page.data,
              items: nextItems,
              unreadCount: (page.data.unreadCount ?? 0) + unreadDelta,
              filteredUnreadCount: (page.data.filteredUnreadCount ?? 0) + filteredDelta,
              pagination: {
                ...page.data.pagination,
                hasMore: true,
              },
            },
          }
        })
      }, false)
    },
    [mutate, filter]
  )

  useRealtimeNotifications({
    userId: user?.id,
    enabled: Boolean(user),
    onInsert: handleRealtimeInsert,
    supabase,
  })

  if (isInitialLoading) {
    return (
      <Card className={cn("border-dashed", className)}>
        <CardContent className="flex items-center gap-2 py-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>加载通知中...</span>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="space-y-3 py-8 text-center">
          <BellRing className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground text-sm">获取通知失败，请稍后再试</p>
          <Button variant="outline" onClick={() => mutate()}>
            重新加载
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!items.length) {
    return (
      <Card className={className}>
        <CardContent className="space-y-3 py-12 text-center">
          <Inbox className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground text-sm">暂时没有通知</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={filter} onValueChange={handleFilterChange} className="w-full md:w-auto">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-2 md:flex md:w-auto">
            {FILTERS.map((item) => (
              <TabsTrigger
                key={item.value}
                value={item.value}
                className="text-xs md:text-sm"
              >
                {item.label}
                {item.value !== "ALL" && filteredUnreadCount > 0 && filter === item.value ? (
                  <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
                    {filteredUnreadCount}
                  </span>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-muted-foreground text-xs md:text-sm">未读 {unreadCount}</span>
          <Button variant="outline" size="sm" onClick={handleMarkAll} disabled={!unreadCount}>
            全部已读
          </Button>
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        {items.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onMarkRead={handleMarkSingle}
          />
        ))}

        <div ref={sentinelRef} />

        {isLoadingMore ? (
          <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>加载更多...</span>
          </div>
        ) : null}

        {!hasMore && (
          <p className="text-muted-foreground py-4 text-center text-xs">没有更多通知了</p>
        )}
      </div>
    </div>
  )
}

export default NotificationList
