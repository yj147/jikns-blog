/**
 * 登出按钮组件
 * 处理用户登出操作
 */

"use client"

import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { createClient } from "@/lib/supabase"
import { LogOut, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

export function LogoutButton() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    setLoading(true)

    try {
      const { error } = await supabase.auth.signOut()

      if (error) {
        console.error("登出错误:", error.message)
        // 这里可以添加 toast 错误提示
      } else {
        // 登出成功，刷新页面或重定向
        router.push("/")
        router.refresh()
      }
    } catch (error) {
      console.error("登出异常:", error)
      // 这里可以添加 toast 错误提示
    } finally {
      setLoading(false)
    }
  }

  return (
    <DropdownMenuItem
      onSelect={handleLogout}
      disabled={loading}
      className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
    >
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <LogOut className="mr-2 h-4 w-4" />
      )}
      {loading ? "登出中..." : "登出"}
    </DropdownMenuItem>
  )
}
