"use client"

import { useState, type ComponentProps } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  FileText,
  Rss,
  Tag,
  Settings,
  Activity,
  Menu,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  badge?: {
    label: string
    variant?: ComponentProps<typeof Badge>["variant"]
  }
}

const NAV_ITEMS: NavItem[] = [
  { title: "仪表盘", href: "/admin", icon: LayoutDashboard },
  { title: "用户管理", href: "/admin/users", icon: Users },
  { title: "文章管理", href: "/admin/blog", icon: FileText },
  { title: "动态管理", href: "/admin/feeds", icon: Rss },
  { title: "标签管理", href: "/admin/tags", icon: Tag },
  { title: "系统设置", href: "/admin/settings", icon: Settings },
  {
    title: "监控中心",
    href: "/admin/monitoring",
    icon: Activity,
    badge: { label: "实时", variant: "destructive" },
  },
]

const DESKTOP_WIDTH_CLASS = "w-64"

function getIsActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-6 py-6">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Control Center
        </p>
        <h2 className="mt-2 text-2xl font-semibold">管理后台</h2>
        <p className="text-muted-foreground mt-1 text-sm">快速进入运营、内容与监控模块</p>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active = getIsActive(pathname, item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => onNavigate?.()}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1 truncate">{item.title}</span>
              {item.badge ? (
                <Badge variant={item.badge.variant ?? "secondary"} className="ml-auto text-[10px]">
                  {item.badge.label}
                </Badge>
              ) : null}
            </Link>
          )
        })}
      </nav>

      <div className="border-t px-6 py-6 text-xs leading-relaxed text-muted-foreground">
        <p className="font-semibold text-foreground">运维准则</p>
        <p className="mt-2">
          优先发现瓶颈、记录决策，保持后台高可用且可追踪。
        </p>
      </div>
    </div>
  )
}

export default function AdminSidebar() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="border-b bg-background px-4 py-4 md:hidden">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Admin</p>
            <p className="text-lg font-semibold">控制面板</p>
          </div>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="打开菜单">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 max-w-[256px] p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>管理后台导航</SheetTitle>
                <SheetDescription>管理后台侧边栏菜单</SheetDescription>
              </SheetHeader>
              <SidebarContent onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <aside
        className={cn(
          "hidden border-r bg-muted/20 md:sticky md:top-0 md:flex md:h-screen md:flex-col md:shrink-0 md:self-start",
          DESKTOP_WIDTH_CLASS
        )}
      >
        <SidebarContent />
      </aside>
    </>
  )
}
