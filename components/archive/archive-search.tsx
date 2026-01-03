"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "@/components/app-link"
import { ArchivePost } from "@/lib/actions/archive"
import { buildHighlightSegments, buildSearchPreview } from "@/lib/utils/archive-search"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Clock3, Loader2, Search, X, History as HistoryIcon } from "lucide-react"
import { logger } from "@/lib/utils/logger"
import {
  ARCHIVE_SEARCH_MAX_QUERY_LENGTH,
  ARCHIVE_SEARCH_MIN_QUERY_LENGTH,
} from "@/lib/constants/archive-search"

const HISTORY_KEY = "archive-search-history"
const MIN_QUERY_LENGTH = ARCHIVE_SEARCH_MIN_QUERY_LENGTH
const MAX_QUERY_LENGTH = ARCHIVE_SEARCH_MAX_QUERY_LENGTH
const MAX_HISTORY_ITEMS = 5

interface ArchiveSearchProps {
  years: { year: number; count: number }[]
  defaultYear?: number
}

interface FetchState {
  loading: boolean
  error: string | null
}

type ArchiveSearchResult = Omit<ArchivePost, "publishedAt"> & { publishedAt: string }

export default function ArchiveSearch({ years, defaultYear }: ArchiveSearchProps) {
  const [query, setQuery] = useState("")
  const [yearFilter, setYearFilter] = useState(defaultYear ? String(defaultYear) : "all")
  const [results, setResults] = useState<ArchivePost[]>([])
  const [history, setHistory] = useState<string[]>([])
  const [touched, setTouched] = useState(false)
  const [{ loading, error }, setFetchState] = useState<FetchState>({
    loading: false,
    error: null,
  })
  const controllerRef = useRef<AbortController | null>(null)
  const historySyncReadyRef = useRef(false)

  useEffect(() => {
    if (defaultYear) {
      setYearFilter(String(defaultYear))
    }
  }, [defaultYear])

  useEffect(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          setHistory(parsed.slice(0, MAX_HISTORY_ITEMS))
        }
      }
    } catch (err) {
      logger.warn("读取搜索历史失败", { error: err })
    }
  }, [])

  useEffect(() => {
    if (!historySyncReadyRef.current) {
      historySyncReadyRef.current = true
      return
    }

    try {
      if (history.length === 0) {
        localStorage.removeItem(HISTORY_KEY)
      } else {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
      }
    } catch (err) {
      logger.warn("写入搜索历史失败", { error: err })
    }
  }, [history])

  useEffect(() => {
    // 组件卸载时中止所有进行中的请求，防止内存泄漏
    return () => {
      controllerRef.current?.abort()
    }
  }, [])

  const selectedYearLabel = useMemo(() => {
    if (yearFilter === "all") return "全部年份"
    const yearItem = years.find((item) => item.year.toString() === yearFilter)
    return yearItem ? `${yearItem.year} 年 (${yearItem.count})` : "全部年份"
  }, [yearFilter, years])

  const clearHistory = () => {
    setHistory([])
    try {
      localStorage.removeItem(HISTORY_KEY)
    } catch (err) {
      logger.warn("清除搜索历史失败", { error: err })
    }
  }

  const runSearch = async (text: string, yearValue: string) => {
    const normalized = text.trim()
    setTouched(true)

    if (normalized.length < MIN_QUERY_LENGTH) {
      setFetchState({ loading: false, error: `至少输入 ${MIN_QUERY_LENGTH} 个字符` })
      setResults([])
      return
    }

    if (normalized.length > MAX_QUERY_LENGTH) {
      setFetchState({ loading: false, error: `最多输入 ${MAX_QUERY_LENGTH} 个字符` })
      setResults([])
      return
    }

    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    setFetchState({ loading: true, error: null })

    const params = new URLSearchParams({ q: normalized })
    if (yearValue !== "all") {
      params.append("year", yearValue)
    }

    try {
      const response = await fetch(`/api/archive/search?${params.toString()}`, {
        method: "GET",
        signal: controller.signal,
        cache: "no-store",
      })

      const data = await response.json()

      if (data?.message === "QUERY_TOO_SHORT") {
        setFetchState({ loading: false, error: `至少输入 ${MIN_QUERY_LENGTH} 个字符` })
        setResults([])
        return
      }

      if (!response.ok) {
        if (data?.message === "QUERY_TOO_LONG") {
          setFetchState({ loading: false, error: `最多输入 ${MAX_QUERY_LENGTH} 个字符` })
          setResults([])
          return
        }
        throw new Error(data?.message ?? "SEARCH_FAILED")
      }

      const nextResults: ArchivePost[] = Array.isArray(data?.results)
        ? (data.results as ArchiveSearchResult[]).map((item) => ({
            ...item,
            publishedAt: new Date(item.publishedAt),
          }))
        : []
      setResults(nextResults)
      setFetchState({ loading: false, error: nextResults.length === 0 ? "未找到匹配文章" : null })

      setHistory((prev) => {
        const next = [normalized, ...prev.filter((item) => item !== normalized)]
        return next.slice(0, MAX_HISTORY_ITEMS)
      })
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        return
      }
      logger.error("归档搜索失败", { error: err })
      setFetchState({ loading: false, error: "搜索失败，请稍后重试" })
      setResults([])
    }
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    runSearch(query, yearFilter)
  }

  const handleHistoryClick = (value: string) => {
    setQuery(value)
    runSearch(value, yearFilter)
  }

  const handleYearChange = (value: string) => {
    setYearFilter(value)
    const length = query.trim().length
    if (touched && length >= MIN_QUERY_LENGTH && length <= MAX_QUERY_LENGTH) {
      runSearch(query, value)
    }
  }

  return (
    <section aria-label="归档搜索" className="mb-10">
      <form
        onSubmit={handleSubmit}
        className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px_auto] md:items-end"
      >
        <div className="space-y-2">
          <Label htmlFor="archive-search-input">搜索文章</Label>
          <div className="relative">
            <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <Input
              id="archive-search-input"
              name="q"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="输入标题、摘要或内容关键词…"
              autoComplete="off"
              aria-describedby={error ? "archive-search-error" : undefined}
              className="pl-9"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="archive-search-year">限定年份</Label>
          <Select name="year" value={yearFilter} onValueChange={handleYearChange}>
            <SelectTrigger id="archive-search-year">
              <SelectValue placeholder="全部年份">{selectedYearLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部年份</SelectItem>
              {years.map((item) => (
                <SelectItem key={item.year} value={item.year.toString()}>
                  {item.year} 年 ({item.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button type="submit" className="md:ml-4" disabled={loading} aria-label="执行归档搜索">
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Search className="mr-2 h-4 w-4" />
          )}
          搜索
        </Button>
      </form>

      {history.length > 0 && (
        <div className="text-muted-foreground mt-4 flex items-center gap-2 text-sm">
          <HistoryIcon className="h-4 w-4" aria-hidden />
          <span className="mr-2">最近搜索:</span>
          <div className="flex flex-wrap gap-2">
            {history.map((item) => (
              <Button
                key={item}
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleHistoryClick(item)}
                className="h-7"
              >
                {item}
              </Button>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={clearHistory}
              className="h-7 w-7"
              aria-label="清除搜索历史"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <div className="mt-6" aria-live="polite">
        {error && !loading && (
          <p
            id="archive-search-error"
            className="text-destructive text-sm"
            role="alert"
            aria-live="assertive"
          >
            {error}
          </p>
        )}

        {results.length > 0 && (
          <div className="bg-card rounded-lg border">
            <div className="flex items-center justify-between border-b px-4 py-3" role="status">
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Search className="h-4 w-4" aria-hidden />
                <span>共找到 {results.length} 篇文章</span>
              </div>
              {yearFilter !== "all" && <Badge variant="secondary">限定 {yearFilter} 年</Badge>}
            </div>

            <ScrollArea className="max-h-[420px]">
              <ul className="divide-y">
                {results.map((post) => {
                  const preview = buildSearchPreview(post.summary ?? "", query, 120)
                  const titleSegments = buildHighlightSegments(post.title, query)
                  const previewSegments = buildHighlightSegments(preview, query)
                  const publishedDate = new Date(post.publishedAt)
                  const formattedDate = publishedDate.toLocaleDateString("zh-CN", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                  })

                  return (
                    <li key={post.id} className="px-4 py-4">
                      <article className="space-y-2">
                        <Link
                          href={`/blog/${post.slug}`}
                          className="hover:text-primary focus-visible:ring-ring text-base font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                        >
                          {titleSegments.map((segment, index) =>
                            segment.match ? (
                              <mark
                                key={`title-${post.id}-${index}`}
                                className="bg-primary/20 text-primary px-0.5"
                              >
                                {segment.text}
                              </mark>
                            ) : (
                              <span key={`title-${post.id}-${index}`}>{segment.text}</span>
                            )
                          )}
                        </Link>

                        <div className="text-muted-foreground flex items-center gap-2 text-xs">
                          <Clock3 className="h-3 w-3" aria-hidden />
                          <span>{formattedDate}</span>
                          {post.tags.length > 0 && (
                            <span className="truncate">
                              {post.tags
                                .slice(0, 3)
                                .map((item) => `#${item.tag.name}`)
                                .join(" ")}
                            </span>
                          )}
                        </div>

                        {preview && (
                          <p className="text-muted-foreground text-sm leading-relaxed">
                            {previewSegments.map((segment, index) =>
                              segment.match ? (
                                <mark
                                  key={`preview-${post.id}-${index}`}
                                  className="bg-primary/20 text-primary px-0.5"
                                >
                                  {segment.text}
                                </mark>
                              ) : (
                                <span key={`preview-${post.id}-${index}`}>{segment.text}</span>
                              )
                            )}
                          </p>
                        )}
                      </article>
                    </li>
                  )
                })}
              </ul>
            </ScrollArea>
          </div>
        )}
      </div>
    </section>
  )
}
