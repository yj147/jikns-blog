/**
 * 用户菜单组件
 * 显示已登录用户的头像、信息和操作菜单
 */

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getCurrentUser } from "@/lib/auth"
import { LogoutButton } from "./logout-button"
import { Shield, User, Settings } from "lucide-react"
import Link from "@/components/app-link"

export async function UserMenu() {
  // 获取完整的用户信息，包括角色等业务数据
  const user = await getCurrentUser()

  if (!user) {
    return null
  }

  // 使用数据库中的用户信息
  const displayName = user.name || user.email
  const avatarUrl = user.avatarUrl
  const isAdmin = user.role === "ADMIN"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-9 w-9 rounded-full">
          <Avatar className="h-9 w-9">
            <AvatarImage src={avatarUrl || undefined} alt={displayName || "User"} />
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
            <AvatarImage src={avatarUrl || undefined} alt={displayName || "User"} />
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
            <p className="text-muted-foreground w-48 truncate text-sm">{user.email}</p>
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
                <Link href="/admin" className="flex items-center text-blue-600 dark:text-blue-400">
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
