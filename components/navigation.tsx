"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useAuth } from "@/app/providers/auth-provider"
import {
  BookOpen,
  Users,
  Home,
  Search,
  Bell,
  PenTool,
  User,
  Settings,
  LogOut,
  Shield,
} from "lucide-react"
import { motion } from "framer-motion"
import { Suspense } from "react"

const navigationItems = [
  { name: "首页", href: "/", icon: Home },
  { name: "博客", href: "/blog", icon: BookOpen },
  { name: "动态", href: "/feed", icon: Users },
  { name: "搜索", href: "/search", icon: Search },
]

export function Navigation() {
  const pathname = usePathname()

  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full border-b backdrop-blur"
    >
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2">
          <motion.div
            whileHover={{ scale: 1.1, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
            className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-lg"
          >
            <PenTool className="h-4 w-4" />
          </motion.div>
          <motion.span whileHover={{ scale: 1.05 }} className="text-xl font-bold">
            现代博客
          </motion.span>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden items-center space-x-6 md:flex">
          {navigationItems.map((item, index) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <motion.div
                key={item.href}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
              >
                <Link
                  href={item.href}
                  className={cn(
                    "hover:text-primary relative flex items-center space-x-2 text-sm font-medium transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <motion.div whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }}>
                    <Icon className="h-4 w-4" />
                  </motion.div>
                  <span>{item.name}</span>
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="bg-primary absolute -bottom-1 left-0 right-0 h-0.5"
                      initial={false}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                </Link>
              </motion.div>
            )
          })}
        </nav>

        {/* User Actions */}
        <AuthenticatedUserActions />
      </div>
    </motion.header>
  )
}

/**
 * 认证用户操作组件
 * 根据用户登录状态显示不同的UI
 */
function AuthenticatedUserActions() {
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
      {/* 通知铃铛 */}
      <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5, type: "spring", stiffness: 500 }}
          >
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-xs"
            >
              3
            </Badge>
          </motion.div>
        </Button>
      </motion.div>

      {/* 用户菜单 */}
      <ClientUserMenu user={user} />
    </div>
  )
}

/**
 * 客户端用户菜单组件
 * 优先使用数据库中的用户数据而不是 Supabase metadata
 */
function ClientUserMenu({ user }: { user: any }) {
  const { signOut } = useAuth()

  if (!user) return null

  // 优先从数据库数据读取，回退到 Supabase metadata
  const displayName = user.name || user.user_metadata?.full_name || user.email
  const avatarUrl = user.avatarUrl || user.user_metadata?.avatar_url

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarImage src={avatarUrl} alt={displayName || "User"} />
              <AvatarFallback className="text-sm">
                {displayName?.charAt(0).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
          </Button>
        </motion.div>
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
