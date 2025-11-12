"use client"

import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/app/providers/auth-provider"
import { Bell, LogOut, Settings, Shield, User } from "lucide-react"

export default function AuthActions() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center space-x-4">
        <div className="bg-muted h-8 w-8 animate-pulse rounded-full" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center space-x-3">
        <Link href="/login">
          <Button variant="ghost" size="sm">
            登录
          </Button>
        </Link>
        <Link href="/register">
          <Button size="sm">注册</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="flex items-center space-x-4">
      <Button variant="ghost" size="icon" className="relative transition-transform duration-200 hover:-translate-y-0.5">
        <Bell className="h-4 w-4" />
        <Badge variant="destructive" className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-xs">
          3
        </Badge>
      </Button>

      <ClientUserMenu user={user} />
    </div>
  )
}

function ClientUserMenu({ user }: { user: any }) {
  const { signOut } = useAuth()

  if (!user) return null

  const displayName = user.name || user.user_metadata?.full_name || user.email
  const avatarUrl = user.avatarUrl || user.user_metadata?.avatar_url

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full transition-transform duration-200 hover:-translate-y-0.5">
          <Avatar className="h-8 w-8">
            <AvatarImage src={avatarUrl} alt={displayName || "User"} />
            <AvatarFallback className="text-sm">{displayName?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <div className="flex items-center justify-start gap-2 p-2">
          <div className="flex flex-col space-y-1 leading-none">
            <div className="flex items-center space-x-2">
              <p className="font-medium">{displayName}</p>
              {user.role === "ADMIN" && (
                <Badge variant="default" className="text-xs">
                  管理员
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground w-[200px] truncate text-sm">{user.email}</p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile" className="flex items-center">
            <User className="mr-2 h-4 w-4" />
            <span>个人资料</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings" className="flex items-center">
            <Settings className="mr-2 h-4 w-4" />
            <span>设置</span>
          </Link>
        </DropdownMenuItem>
        {user.role === "ADMIN" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/admin" className="flex items-center text-blue-600">
                <Shield className="mr-2 h-4 w-4" />
                <span>管理后台</span>
              </Link>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => signOut()}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>退出登录</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
