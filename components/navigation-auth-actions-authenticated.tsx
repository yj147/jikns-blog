"use client"

import dynamic from "next/dynamic"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/app/providers/auth-provider"
import { MoreHorizontal } from "lucide-react"
import NotificationBell from "@/components/notifications/notification-bell"

const NavigationUserMenuDropdown = dynamic(() => import("./navigation-user-menu-dropdown"), {
  ssr: false,
  loading: () => (
    <Button
      variant="ghost"
      className="relative h-8 w-8 rounded-full"
      aria-label="打开用户菜单"
      disabled
    >
      <MoreHorizontal className="h-4 w-4" />
    </Button>
  ),
})

export default function NavigationAuthActionsAuthenticated() {
  const { user } = useAuth()

  if (!user) return null

  return (
    <>
      <NotificationBell />
      <ClientUserMenu user={user} />
    </>
  )
}

function ClientUserMenu({ user }: { user: any }) {
  const { signOut } = useAuth()
  const [menuEnabled, setMenuEnabled] = useState(false)
  const [open, setOpen] = useState(false)

  if (!user) return null

  const authMetadata = user.authUser?.metadata || {}
  const displayName =
    user.name || authMetadata.full_name || authMetadata.name || authMetadata.user_name || user.email
  // 完全使用数据库的 avatarUrl，不再 fallback 到 Auth metadata
  const avatarUrl = user.avatarUrl || undefined

  if (!menuEnabled) {
    return (
      <Button
        variant="ghost"
        className="relative h-8 w-8 rounded-full transition-transform duration-200 hover:-translate-y-0.5"
        onClick={() => {
          setMenuEnabled(true)
          setOpen(true)
        }}
        aria-label="打开用户菜单"
      >
        <Avatar className="h-8 w-8">
          <AvatarImage src={avatarUrl} alt={displayName || "User"} />
          <AvatarFallback className="text-sm">
            {displayName?.charAt(0).toUpperCase() || "U"}
          </AvatarFallback>
        </Avatar>
      </Button>
    )
  }

  return (
    <NavigationUserMenuDropdown
      user={user}
      open={open}
      onOpenChange={setOpen}
      onSignOut={() => signOut()}
    />
  )
}
