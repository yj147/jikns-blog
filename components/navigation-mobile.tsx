"use client"

import Link from "next/link"
import { useState } from "react"
import { usePathname } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useAuth } from "@/app/providers/auth-provider"
import { Bell, LogIn, LogOut, Menu, Settings, Shield, User, UserPlus } from "lucide-react"

import { navigationItems } from "./navigation-links"

export default function MobileNavigation() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="打开导航菜单" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">打开导航菜单</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        id="mobile-navigation"
        side="left"
        className="max-w-xs gap-0 border-r p-0 sm:max-w-sm"
        aria-label="移动端导航抽屉"
      >
        <SheetHeader className="border-b px-4 py-3 text-left">
          <SheetTitle className="text-base">导航菜单</SheetTitle>
          <SheetDescription className="text-muted-foreground text-sm">
            快速访问博客、动态和账号设置
          </SheetDescription>
        </SheetHeader>

        <div className="flex h-full flex-col gap-5 overflow-y-auto px-4 py-4">
          <nav aria-label="站点导航" className="flex flex-col gap-2">
            {navigationItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  onClick={() => setIsOpen(false)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "focus-visible:ring-ring flex items-center gap-3 rounded-lg border px-3 py-2 text-base font-medium transition focus-visible:outline-none focus-visible:ring-2",
                    isActive
                      ? "border-primary bg-primary/10 text-primary"
                      : "text-foreground hover:border-muted hover:bg-muted/60 border-transparent"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </nav>

          <MobileUserSection closeSheet={() => setIsOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  )
}

function MobileUserSection({ closeSheet }: { closeSheet: () => void }) {
  const { user, loading, signOut } = useAuth()

  if (loading) {
    return (
      <div className="space-y-2" aria-live="polite">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="space-y-3">
        <p className="text-muted-foreground text-sm">登录后可访问通知与个人设置</p>
        <div className="grid gap-2">
          <Button
            asChild
            variant="secondary"
            size="lg"
            className="justify-start gap-2"
            onClick={closeSheet}
          >
            <Link href="/login" prefetch={false}>
              <LogIn className="h-4 w-4" /> 登录
            </Link>
          </Button>
          <Button asChild size="lg" className="justify-start gap-2" onClick={closeSheet}>
            <Link href="/register" prefetch={false}>
              <UserPlus className="h-4 w-4" /> 注册
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  const displayName = user.name || user.email

  const handleSignOut = async () => {
    await signOut()
    closeSheet()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-lg border p-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={user.avatarUrl ?? undefined} alt={displayName || "用户"} />
          <AvatarFallback>{displayName?.charAt(0).toUpperCase() ?? "U"}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="font-semibold leading-tight">{displayName}</p>
          <p className="text-muted-foreground truncate text-sm">{user.email}</p>
        </div>
        {user.role === "ADMIN" && (
          <Badge variant="default" className="ml-auto">
            管理员
          </Badge>
        )}
      </div>

      <div className="grid gap-2">
        <Button asChild variant="ghost" className="justify-start gap-2" onClick={closeSheet}>
          <Link href="/notifications" prefetch={false}>
            <Bell className="h-4 w-4" /> 通知
          </Link>
        </Button>
        <Button asChild variant="ghost" className="justify-start gap-2" onClick={closeSheet}>
          <Link href="/profile" prefetch={false}>
            <User className="h-4 w-4" /> 个人资料
          </Link>
        </Button>
        <Button asChild variant="ghost" className="justify-start gap-2" onClick={closeSheet}>
          <Link href="/settings" prefetch={false}>
            <Settings className="h-4 w-4" /> 设置
          </Link>
        </Button>
        {user.role === "ADMIN" && (
          <Button
            asChild
            variant="ghost"
            className="justify-start gap-2 text-blue-600 hover:text-blue-700"
            onClick={closeSheet}
          >
            <Link href="/admin" prefetch={false}>
              <Shield className="h-4 w-4" /> 管理后台
            </Link>
          </Button>
        )}
        <Button variant="destructive" className="justify-center" onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" /> 退出登录
        </Button>
      </div>
    </div>
  )
}
