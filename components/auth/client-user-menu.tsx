/**
 * 客户端用户菜单组件
 * 基于客户端认证状态的用户菜单
 */

"use client"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/hooks/use-auth"
import { LogoutButton } from "./logout-button"
import { Shield, User, Settings, Loader2 } from "lucide-react"
import Link from "next/link"

export function ClientUserMenu() {
  const { user, session, isLoading } = useAuth()

  // 加载状态
  if (isLoading) {
    return (
      <Button variant="ghost" size="sm" disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    )
  }

  // 未登录状态
  if (!user || !session) {
    return null
  }

  const authUser = session.user
  const displayName = user.name || authUser.email
  const isAdmin = user.role === "ADMIN" && user.status === "ACTIVE"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-9 w-9 rounded-full">
          <Avatar className="h-9 w-9">
            <AvatarImage
              src={user.avatarUrl || authUser.user_metadata?.avatar_url}
              alt={displayName || "用户"}
            />
            <AvatarFallback className="text-sm">
              {displayName?.charAt(0).toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-64" align="end" forceMount>
        {/* 用户信息头部 */}
        <div className="flex items-center justify-start gap-2 border-b p-3">
          <Avatar className="h-10 w-10">
            <AvatarImage
              src={user.avatarUrl || authUser.user_metadata?.avatar_url}
              alt={displayName || "用户"}
            />
            <AvatarFallback>{displayName?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col space-y-1 leading-none">
            <p className="text-sm font-medium">
              {displayName}
              {isAdmin && (
                <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-800 dark:text-blue-100">
                  <Shield className="mr-1 h-3 w-3" />
                  管理员
                </span>
              )}
            </p>
            <p className="text-muted-foreground w-48 truncate text-sm">{authUser.email}</p>
          </div>
        </div>

        {/* 菜单项 */}
        <div className="p-1">
          <DropdownMenuItem asChild>
            <Link href="/profile" className="flex items-center">
              <User className="mr-2 h-4 w-4" />
              个人资料
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link href="/settings" className="flex items-center">
              <Settings className="mr-2 h-4 w-4" />
              设置
            </Link>
          </DropdownMenuItem>

          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link
                  href="/admin"
                  prefetch={false}
                  className="flex items-center text-blue-600 dark:text-blue-400"
                >
                  <Shield className="mr-2 h-4 w-4" />
                  管理后台
                </Link>
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuSeparator />
          <LogoutButton />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * 简化版用户头像
 * 仅显示用户头像，点击后跳转到个人资料页面
 */
export function UserAvatar() {
  const { user, session, isLoading } = useAuth()

  if (isLoading || !user || !session) {
    return null
  }

  const authUser = session.user
  const displayName = user.name || authUser.email

  return (
    <Link href="/profile">
      <Avatar className="h-8 w-8 cursor-pointer transition-opacity hover:opacity-80">
        <AvatarImage
          src={user.avatarUrl || authUser.user_metadata?.avatar_url}
          alt={displayName || "用户"}
        />
        <AvatarFallback className="text-sm">
          {displayName?.charAt(0).toUpperCase() || "U"}
        </AvatarFallback>
      </Avatar>
    </Link>
  )
}
