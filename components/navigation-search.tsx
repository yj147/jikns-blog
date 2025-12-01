/**
 * 导航栏搜索组件：跳转到 /search?q=...，带清空按钮与移动端适配
 */

"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { UNIFIED_SEARCH_TYPES, type UnifiedSearchType } from "@/types/search"

interface NavigationSearchProps {
  className?: string
}

const DEFAULT_TYPE: UnifiedSearchType = "all"

function normalizeType(value: string | null): UnifiedSearchType {
  if (!value) return DEFAULT_TYPE
  return UNIFIED_SEARCH_TYPES.includes(value as UnifiedSearchType)
    ? (value as UnifiedSearchType)
    : DEFAULT_TYPE
}

export function NavigationSearch({ className }: NavigationSearchProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState("")

  useEffect(() => {
    setValue(searchParams.get("q") ?? "")
  }, [searchParams])

  const preservedParams = useMemo(() => {
    const params = new URLSearchParams()
    searchParams.forEach((paramValue, key) => {
      if (key === "q" || key === "page" || key === "offset") return
      params.set(key, paramValue)
    })
    params.set("type", normalizeType(searchParams.get("type")))
    return params
  }, [searchParams])

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return

    const next = new URLSearchParams(preservedParams)
    next.set("q", trimmed)
    router.push(`/search?${next.toString()}`)
    inputRef.current?.blur()
  }

  const handleClear = () => {
    setValue("")
    const hasQuery = searchParams.get("q")
    if (!hasQuery) {
      inputRef.current?.focus()
      return
    }
    const next = new URLSearchParams(preservedParams)
    next.delete("q")
    router.push(next.size > 0 ? `/search?${next.toString()}` : "/search")
    inputRef.current?.focus()
  }

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      className={cn("flex items-center gap-2", className)}
      data-testid="navigation-search"
    >
      <div className="relative flex-1">
        <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <Input
          ref={inputRef}
          type="text"
          name="q"
          autoComplete="off"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="搜索文章、动态、用户、标签"
          className="h-10 w-full rounded-lg pl-9 pr-10"
          aria-label="搜索"
        />
        {value && (
          <button
            type="button"
            aria-label="清空搜索"
            onClick={handleClear}
            className="text-muted-foreground hover:text-foreground absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <Button type="submit" size="sm" className="h-10 px-3 sm:px-4" variant="secondary">
        搜索
      </Button>
    </form>
  )
}

export default NavigationSearch
