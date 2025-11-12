/**
 * 搜索建议组件 - Phase 11 / M3 / T3.2
 * 搜索框的下拉建议列表，支持键盘导航和搜索历史
 */

"use client"

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  cloneElement,
  isValidElement,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react"
import { useRouter } from "next/navigation"
import { Hash, FileText, User, Clock, TrendingUp } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { getSearchSuggestions } from "@/lib/actions/search"
import type { SearchSuggestion } from "@/lib/actions/search"
import type { ApiError } from "@/types/api"
import { useDebounce } from "@/hooks/use-debounce"
import { useSearchHistory } from "@/hooks/use-search-history"
import { cn } from "@/lib/utils"

interface SearchSuggestionsProps {
  query: string
  debouncedQuery?: string
  isOpen: boolean
  onClose: () => void
  onSelect: (suggestion: SearchSuggestion) => void
  children: React.ReactNode
}

const MIN_QUERY_LENGTH = 2
const SUGGESTION_LIMIT = 5
const SEARCH_HISTORY_KEY = "search_history"
const MAX_HISTORY_ITEMS = 5
const SUGGESTION_DEBOUNCE_DELAY = 300

type SuggestionStatus = "idle" | "loading" | "success" | "empty" | "error" | "rate_limited"

export function SearchSuggestions({
  query,
  debouncedQuery,
  isOpen,
  onClose,
  onSelect,
  children,
}: SearchSuggestionsProps) {
  const router = useRouter()
  const { history, addEntry } = useSearchHistory({
    storageKey: SEARCH_HISTORY_KEY,
    limit: MAX_HISTORY_ITEMS,
  })
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [status, setStatus] = useState<SuggestionStatus>("idle")
  const [errorInfo, setErrorInfo] = useState<{ code: string; retryAfter?: number } | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const fallbackDebouncedQuery = useDebounce(query, SUGGESTION_DEBOUNCE_DELAY)
  const fetchQuery = debouncedQuery ?? fallbackDebouncedQuery
  const latestRequestRef = useRef(0)
  const showHistory = query.length < MIN_QUERY_LENGTH && history.length > 0
  const historyItems = useMemo(() => (showHistory ? history : []), [history, showHistory])
  const shouldRender = isOpen && (historyItems.length > 0 || query.length >= MIN_QUERY_LENGTH)
  const totalItems = historyItems.length + suggestions.length

  useEffect(() => {
    setSelectedIndex(-1)
  }, [fetchQuery, historyItems.length])

  useEffect(() => {
    if (!shouldRender) {
      setSelectedIndex(-1)
      return
    }

    if (totalItems === 0) {
      setSelectedIndex(-1)
      return
    }

    setSelectedIndex((prev) => {
      if (prev < 0) return prev
      return prev >= totalItems ? totalItems - 1 : prev
    })
  }, [shouldRender, totalItems])

  useEffect(() => {
    if (!fetchQuery || fetchQuery.length < MIN_QUERY_LENGTH) {
      setSuggestions([])
      setStatus("idle")
      setErrorInfo(null)
      return
    }

    const requestId = latestRequestRef.current + 1
    latestRequestRef.current = requestId
    setStatus("loading")
    setSuggestions([])
    setErrorInfo(null)

    let cancelled = false

    const fetchSuggestions = async () => {
      try {
        const result = await getSearchSuggestions({
          query: fetchQuery,
          limit: SUGGESTION_LIMIT,
        })

        if (cancelled || latestRequestRef.current !== requestId) {
          return
        }

        if (result.success && result.data) {
          const fetched = result.data.suggestions
          setSuggestions(fetched)
          setStatus(fetched.length > 0 ? "success" : "empty")
          setErrorInfo(null)
        } else {
          setSuggestions([])
          const retryAfter = extractRetryAfter(result.error)
          setErrorInfo({ code: result.error?.code ?? "UNKNOWN_ERROR", retryAfter })
          setStatus(result.error?.code === "RATE_LIMIT_EXCEEDED" ? "rate_limited" : "error")
        }
      } catch {
        if (!cancelled && latestRequestRef.current === requestId) {
          setSuggestions([])
          setStatus("error")
          setErrorInfo({ code: "NETWORK_ERROR" })
        }
      }
    }

    void fetchSuggestions()

    return () => {
      cancelled = true
    }
  }, [fetchQuery])

  const handleSelectSuggestion = useCallback(
    (suggestion: SearchSuggestion) => {
      addEntry(suggestion.text)
      onSelect(suggestion)
      router.push(suggestion.href)
      onClose()
    },
    [addEntry, onClose, onSelect, router]
  )

  const handleHistorySelect = useCallback(
    (value: string) => {
      addEntry(value)
      router.push(`/search?q=${encodeURIComponent(value)}`)
      onClose()
    },
    [addEntry, onClose, router]
  )

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case "tag":
        return <Hash className="h-4 w-4" />
      case "post":
        return <FileText className="h-4 w-4" />
      case "user":
        return <User className="h-4 w-4" />
      default:
        return <TrendingUp className="h-4 w-4" />
    }
  }

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent) => {
      if (event.defaultPrevented || event.nativeEvent.isComposing) {
        return
      }

      if (!shouldRender) {
        return
      }

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault()
          setSelectedIndex((prev) => {
            if (totalItems === 0) return prev
            if (prev < totalItems - 1) {
              return prev + 1
            }
            return totalItems - 1
          })
          break
        case "ArrowUp":
          event.preventDefault()
          setSelectedIndex((prev) => {
            if (prev <= 0) {
              return -1
            }
            return prev - 1
          })
          break
        case "Enter":
          if (selectedIndex < 0 || totalItems === 0) {
            return
          }
          event.preventDefault()

          if (selectedIndex < historyItems.length) {
            const historyValue = historyItems[selectedIndex]
            if (historyValue) {
              handleHistorySelect(historyValue)
            }
            return
          }

          const suggestionIndex = selectedIndex - historyItems.length
          const suggestion = suggestions[suggestionIndex]
          if (suggestion) {
            handleSelectSuggestion(suggestion)
          }
          break
        case "Escape":
          event.preventDefault()
          onClose()
          break
      }
    },
    [
      handleHistorySelect,
      handleSelectSuggestion,
      historyItems,
      onClose,
      selectedIndex,
      shouldRender,
      suggestions,
      totalItems,
    ]
  )

  const trigger = isValidElement(children)
    ? cloneElement(children as React.ReactElement<any>, {
        onKeyDown: (event: ReactKeyboardEvent) => {
          const childProps = (children as React.ReactElement<any>).props
          if (typeof childProps.onKeyDown === "function") {
            childProps.onKeyDown(event)
          }
          if (!event.defaultPrevented) {
            handleKeyDown(event)
          }
        },
      })
    : children

  const renderSuggestionsSection = () => {
    if (query.length < MIN_QUERY_LENGTH) {
      return null
    }

    if (status === "loading") {
      return <div className="text-muted-foreground px-3 py-8 text-center text-sm">加载中...</div>
    }

    if (status === "error") {
      return (
        <div className="text-muted-foreground px-3 py-8 text-center text-sm">
          获取搜索建议失败，请稍后重试
        </div>
      )
    }

    if (status === "rate_limited") {
      const retryAfterSeconds = errorInfo?.retryAfter ?? 60
      return (
        <div className="text-muted-foreground px-3 py-8 text-center text-sm">
          搜索过于频繁，请 {retryAfterSeconds} 秒后再试
        </div>
      )
    }

    if (status === "empty") {
      return (
        <div className="text-muted-foreground px-3 py-8 text-center text-sm">没有找到相关建议</div>
      )
    }

    return suggestions.map((suggestion, index) => (
      <button
        key={`suggestion-${suggestion.type}-${suggestion.id}`}
        onClick={() => handleSelectSuggestion(suggestion)}
        className={cn(
          "hover:bg-accent flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors",
          selectedIndex === historyItems.length + index && "bg-accent"
        )}
      >
        <div className="text-muted-foreground">{getSuggestionIcon(suggestion.type)}</div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{suggestion.text}</div>
          {suggestion.subtitle && (
            <div className="text-muted-foreground truncate text-xs">{suggestion.subtitle}</div>
          )}
        </div>
      </button>
    ))
  }

  return (
    <Popover open={shouldRender} onOpenChange={(open) => !open && onClose()}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <ScrollArea className="max-h-[400px]">
          {historyItems.length > 0 && (
            <div className="p-2">
              <div className="text-muted-foreground mb-2 px-2 text-xs font-medium">最近搜索</div>
              {historyItems.map((item, index) => (
                <button
                  key={`history-${item}-${index}`}
                  onClick={() => handleHistorySelect(item)}
                  className={cn(
                    "hover:bg-accent flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
                    selectedIndex === index && "bg-accent"
                  )}
                >
                  <Clock className="text-muted-foreground h-4 w-4" />
                  <span className="truncate">{item}</span>
                </button>
              ))}
            </div>
          )}

          {query.length >= MIN_QUERY_LENGTH && (
            <>
              {historyItems.length > 0 && <Separator />}
              <div className="p-2">
                <div className="text-muted-foreground mb-2 px-2 text-xs font-medium">搜索建议</div>
                {renderSuggestionsSection()}
              </div>
            </>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}

function extractRetryAfter(error?: ApiError | null): number | undefined {
  if (!error?.details || typeof error.details !== "object") {
    return undefined
  }
  const raw = (error.details as Record<string, unknown>).retryAfter
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw
  }
  if (typeof raw === "string") {
    const parsed = Number.parseInt(raw, 10)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return undefined
}
