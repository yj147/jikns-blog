/**
 * 顶部导航的通知铃铛
 */
"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import { useRouter } from "next/navigation"
import { Bell, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { fetchJson } from "@/lib/api/fetch-json"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { useRealtimeNotifications } from "@/hooks/use-realtime-notifications"
import NotificationItem from "./notification-item"
import type { NotificationListPayload, NotificationView } from "./types"

type NotificationApiResponse = {
  success: boolean
  data: NotificationListPayload
}

type NotificationUnreadCountPayload = {
  unreadCount: number
}

type NotificationUnreadCountApiResponse = {
  success: boolean
  data: NotificationUnreadCountPayload
}

const listFetcher = (url: string) => fetchJson<NotificationApiResponse>(url)
const unreadFetcher = (url: string) => fetchJson<NotificationUnreadCountApiResponse>(url)

export function NotificationBell() {
  const { user, loading, supabase } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [realtimeNotifications, setRealtimeNotifications] = useState<NotificationView[]>([])
  const [idleFetchEnabled, setIdleFetchEnabled] = useState(false)

  useEffect(() => {
    if (!user) {
      setIdleFetchEnabled(false)
      return
    }

    if (idleFetchEnabled) {
      return
    }

    const timeoutId = window.setTimeout(() => setIdleFetchEnabled(true), 1500)
    return () => window.clearTimeout(timeoutId)
  }, [user, idleFetchEnabled])

  const { data: unreadData, mutate: mutateUnread } = useSWR<NotificationUnreadCountApiResponse>(
    user && idleFetchEnabled ? "/api/notifications/unread-count" : null,
    unreadFetcher,
    {
      refreshInterval: 0,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  )

  const { data, mutate, isLoading } = useSWR<NotificationApiResponse>(
    user && open ? "/api/notifications?limit=5" : null,
    listFetcher,
    {
      refreshInterval: 0,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  )

  const swrNotifications = useMemo(() => data?.data.items ?? [], [data?.data.items])
  const displayLimit = data?.data.pagination.limit ?? 5

  useEffect(() => {
    if (!swrNotifications.length) return
    setRealtimeNotifications((prev) =>
      prev.filter((item) => !swrNotifications.some((existing) => existing.id === item.id))
    )
  }, [swrNotifications])

  const handleRealtimeInsert = useCallback(
    (notification: NotificationView) => {
      setRealtimeNotifications((prev) => {
        if (prev.some((item) => item.id === notification.id)) return prev
        if (swrNotifications.some((item) => item.id === notification.id)) return prev
        return [notification, ...prev].slice(0, displayLimit)
      })
    },
    [swrNotifications, displayLimit]
  )

  useRealtimeNotifications({
    userId: user?.id,
    enabled: Boolean(user && open),
    onInsert: handleRealtimeInsert,
    supabase,
  })

  const notifications = useMemo(() => {
    const seen = new Set<string>()
    const merged: NotificationView[] = []

    for (const item of realtimeNotifications) {
      if (seen.has(item.id)) continue
      seen.add(item.id)
      merged.push(item)
      if (merged.length >= displayLimit) {
        return merged
      }
    }

    for (const item of swrNotifications) {
      if (seen.has(item.id)) continue
      merged.push(item)
      if (merged.length >= displayLimit) break
    }

    return merged
  }, [realtimeNotifications, swrNotifications, displayLimit])

  const baseUnreadIds = useMemo(
    () => new Set(swrNotifications.filter((item) => !item.readAt).map((item) => item.id)),
    [swrNotifications]
  )

  const realtimeUnreadDelta = useMemo(
    () =>
      realtimeNotifications.reduce((total, item) => {
        if (!item.readAt && !baseUnreadIds.has(item.id)) {
          return total + 1
        }
        return total
      }, 0),
    [realtimeNotifications, baseUnreadIds]
  )

  const baseUnreadCount = data?.data.unreadCount ?? unreadData?.data.unreadCount ?? 0
  const unreadCount = baseUnreadCount + realtimeUnreadDelta

  if (loading) {
    return <div className="bg-muted h-8 w-8 animate-pulse rounded-full" />
  }

  if (!user) {
    return null
  }

  const handleNavigate = () => {
    router.push("/notifications")
  }

  const handleMarkAll = async () => {
    const ids = notifications.filter((item) => !item.readAt).map((item) => item.id)
    if (!ids.length) return
    try {
      await fetchJson("/api/notifications", {
        method: "PATCH",
        body: JSON.stringify({ ids }),
      })
      await Promise.all([mutate(), mutateUnread()])
      const markTime = new Date().toISOString()
      const idSet = new Set(ids)
      setRealtimeNotifications((prev) =>
        prev.map((item) => (idSet.has(item.id) ? { ...item, readAt: markTime } : item))
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : "操作失败"
      toast({ title: message, variant: "destructive" })
    }
  }

  const handleMarkSingle = async (id: string) => {
    try {
      await fetchJson(`/api/notifications/${id}`, { method: "PATCH" })
      await Promise.all([mutate(), mutateUnread()])
      const markTime = new Date().toISOString()
      setRealtimeNotifications((prev) =>
        prev.map((item) => (item.id === id ? { ...item, readAt: markTime } : item))
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : "操作失败"
      toast({ title: message, variant: "destructive" })
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative transition-transform duration-200 hover:-translate-y-0.5"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 ? (
            <span className="bg-destructive text-destructive-foreground absolute -right-1 -top-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[11px] font-semibold">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[360px] p-0 shadow-lg" forceMount>
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-semibold">通知</p>
            <p className="text-muted-foreground text-xs">未读 {unreadCount}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" disabled={!unreadCount} onClick={handleMarkAll}>
              全部已读
            </Button>
            <Button variant="secondary" size="sm" onClick={handleNavigate}>
              查看全部
            </Button>
          </div>
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-[420px] space-y-2 overflow-y-auto px-3 py-3">
          {isLoading ? (
            <div className="text-muted-foreground flex items-center justify-center gap-2 py-6 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>加载中...</span>
            </div>
          ) : notifications.length ? (
            notifications.map((item) => (
              <NotificationItem
                key={item.id}
                notification={item}
                compact
                onMarkRead={handleMarkSingle}
                onNavigate={(href) => {
                  setOpen(false)
                  router.push(href)
                }}
              />
            ))
          ) : (
            <div className="text-muted-foreground py-6 text-center text-sm">暂无通知</div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default NotificationBell
