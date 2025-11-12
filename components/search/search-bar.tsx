/**
 * 全局搜索框组件 - Phase 11 / M3 / T3.1
 * 导航栏中的全局搜索框，支持快捷键和实时搜索建议
 */

"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { Search, Command } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { SearchSuggestions } from "@/components/search/search-suggestions"
import { useDebounce } from "@/hooks/use-debounce"

interface SearchBarProps {
  className?: string
  placeholder?: string
  showShortcut?: boolean
}

const INPUT_DEBOUNCE_DELAY = 300

export function SearchBar({
  className,
  placeholder = "搜索文章、动态、用户...",
  showShortcut = true,
}: SearchBarProps) {
  const searchParams = useSearchParams()
  const [query, setQuery] = useState("")
  const [isFocused, setIsFocused] = useState(false)
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchQueryParam = searchParams.get("q") ?? ""

  // 从 URL 参数初始化搜索关键词
  useEffect(() => {
    setQuery(searchQueryParam)
  }, [searchQueryParam])

  useEffect(() => {
    setIsSuggestionsOpen(false)
  }, [searchQueryParam])

  const preservedParams = useMemo(() => {
    const entries: Array<{ name: string; value: string }> = []
    searchParams.forEach((value, key) => {
      if (key === "q" || key === "page") return
      entries.push({ name: key, value })
    })
    return entries
  }, [searchParams])

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      const normalized = query.trim()
      if (!normalized) {
        event.preventDefault()
        return
      }

      if (inputRef.current) {
        inputRef.current.value = normalized
        inputRef.current.blur()
      }

      setQuery(normalized)
      setIsFocused(false)
      setIsSuggestionsOpen(false)
    },
    [query]
  )

  const debouncedQuery = useDebounce(query, INPUT_DEBOUNCE_DELAY)

  // 快捷键功能 (Ctrl/Cmd + K)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }

    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [])

  return (
    <div className={cn("relative w-full max-w-md", className)}>
      <div className="relative">
        <SearchSuggestions
          query={query}
          debouncedQuery={debouncedQuery}
          isOpen={isSuggestionsOpen}
          onClose={() => setIsSuggestionsOpen(false)}
          onSelect={(suggestion) => {
            setQuery(suggestion.text)
            inputRef.current?.blur()
            setIsFocused(false)
            setIsSuggestionsOpen(false)
          }}
        >
          <form
            action="/search"
            method="get"
            className="relative"
            onSubmit={handleSubmit}
            data-testid="search-form"
          >
            {preservedParams.map(({ name, value }, index) => (
              <input key={`${name}-${value}-${index}`} type="hidden" name={name} value={value} />
            ))}

            {/* 搜索图标 */}
            <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />

            {/* 搜索输入框 */}
            <Input
              ref={inputRef}
              type="text"
              name="q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => {
                setIsFocused(true)
                setIsSuggestionsOpen(true)
              }}
              onBlur={() => setIsFocused(false)}
              placeholder={placeholder}
              className={cn("pl-10 pr-20 transition-all", isFocused && "ring-primary ring-2")}
            />

            {/* 快捷键提示 */}
            {showShortcut && !isFocused && !query && (
              <div className="bg-muted text-muted-foreground absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded px-2 py-1 text-xs">
                <Command className="h-3 w-3" />
                <span>K</span>
              </div>
            )}

            {/* 搜索按钮（移动端） */}
            {query && (
              <button
                type="submit"
                className="text-primary hover:text-primary/80 absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium transition-colors"
              >
                搜索
              </button>
            )}
          </form>
        </SearchSuggestions>
      </div>
    </div>
  )
}
