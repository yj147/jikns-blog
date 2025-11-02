/**
 * 客户端登出按钮组件
 * 处理用户登出操作的客户端交互
 */

"use client"

import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { LogOut } from "lucide-react"
import { useAuth } from "@/app/providers/auth-provider"

export function ClientLogoutButton() {
  const { signOut } = useAuth()

  return (
    <DropdownMenuItem
      className="cursor-pointer text-red-600 focus:text-red-600"
      onClick={() => signOut()}
    >
      <LogOut className="mr-2 h-4 w-4" />
      <span>退出登录</span>
    </DropdownMenuItem>
  )
}
