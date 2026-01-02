/**
 * 顶部导航的通知铃铛
 */
"use client"

import dynamic from "next/dynamic"
import { Bell } from "lucide-react"
import { useMemo, useState } from "react"
import useSWR from "swr"

import { Button } from "@/components/ui/button"
import { fetchJson } from "@/lib/api/fetch-json"
import { useAuth } from "@/hooks/use-auth"

type NotificationUnreadCountPayload = {
  unreadCount: number
}

type NotificationUnreadCountApiResponse = {
  success: boolean
  data: NotificationUnreadCountPayload
}

const unreadFetcher = (url: string) => fetchJson<NotificationUnreadCountApiResponse>(url)

const NotificationBellMenu = dynamic(() => import("./notification-bell-menu"), {
  ssr: false,
  loading: () => (
    <Button variant="ghost" size="icon" className="relative" aria-label="打开通知" disabled>
      <Bell className="h-4 w-4" />
    </Button>
  ),
})

export function NotificationBell() {
  const { user, loading, supabase } = useAuth()
  const [menuEnabled, setMenuEnabled] = useState(false)
  const [open, setOpen] = useState(false)
  const [overrideUnreadCount, setOverrideUnreadCount] = useState<number | null>(null)

  const { data: unreadData, mutate: mutateUnread } = useSWR<NotificationUnreadCountApiResponse>(
    user ? "/api/notifications/unread-count" : null,
    unreadFetcher,
    {
      refreshInterval: 0,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  )
  const unreadCount = useMemo(() => {
    if (overrideUnreadCount !== null) return overrideUnreadCount
    return unreadData?.data.unreadCount ?? 0
  }, [overrideUnreadCount, unreadData?.data.unreadCount])

  if (loading) {
    return <div className="bg-muted h-8 w-8 animate-pulse rounded-full" />
  }

  if (!user) {
    return null
  }

  if (!menuEnabled) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="relative transition-transform duration-200 hover:-translate-y-0.5"
        aria-label="打开通知"
        onClick={() => {
          setMenuEnabled(true)
          setOpen(true)
        }}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="bg-destructive text-destructive-foreground absolute -right-1 -top-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[11px] font-semibold">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </Button>
    )
  }

  return (
    <NotificationBellMenu
      userId={user.id}
      supabase={supabase}
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) {
          setOverrideUnreadCount(null)
        }
      }}
      unreadCount={unreadCount}
      onUnreadCountChange={setOverrideUnreadCount}
      onRefreshUnread={async () => {
        setOverrideUnreadCount(null)
        await mutateUnread()
      }}
    />
  )
}

export default NotificationBell
