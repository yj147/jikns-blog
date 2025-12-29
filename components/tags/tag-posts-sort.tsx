/**
 * 标签详情页文章排序控件
 * 仅用于标签详情页：最新 / 热门
 */

"use client"

import { useCallback } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { SortDesc } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const options = [
  { value: "publishedAt", label: "最新" },
  { value: "viewCount", label: "热门" },
] as const

interface TagPostsSortProps {
  value: (typeof options)[number]["value"]
}

export function TagPostsSort({ value }: TagPostsSortProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const handleChange = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("sort", next)
      params.delete("order")
      params.delete("page")
      router.push(`${pathname}?${params.toString()}`)
    },
    [pathname, router, searchParams]
  )

  return (
    <Select value={value} onValueChange={handleChange}>
      <SelectTrigger className="h-9 w-[140px]">
        <div className="flex items-center gap-2">
          <SortDesc className="h-4 w-4" />
          <SelectValue placeholder="排序" />
        </div>
      </SelectTrigger>
      <SelectContent>
        {options.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
