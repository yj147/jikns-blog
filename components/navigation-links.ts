import type { LucideIcon } from "lucide-react"
import { BookOpen, Home, Search, Users } from "lucide-react"

export interface NavigationItem {
  name: string
  href: string
  icon: LucideIcon
}

export const navigationItems: NavigationItem[] = [
  { name: "首页", href: "/", icon: Home },
  { name: "博客", href: "/blog", icon: BookOpen },
  { name: "动态", href: "/feed", icon: Users },
  { name: "搜索", href: "/search", icon: Search },
]
