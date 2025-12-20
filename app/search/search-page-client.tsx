/**
 * 统一搜索客户端页面 - Social Feed Style
 * 通过 /api/search 获取结果，支持 Tab、分页、加载/空/错误状态
 */

"use client"

import useSWR from "swr"
import { useEffect, useMemo, useState } from "react"
import type { ElementType } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { FileText, Hash, Search, User, Activity, Sparkles, Newspaper } from "lucide-react"

import NavigationSearch from "@/components/navigation-search"
import { SearchResultCard } from "@/components/search/search-result-card"
import { SearchResultsSkeleton } from "@/components/search/search-results-skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { fetchJson } from "@/lib/api/fetch-json"
import type { ApiResponse } from "@/types/api"
import {
  UNIFIED_SEARCH_SORTS,
  UNIFIED_SEARCH_TYPES,
  type UnifiedSearchResult,
  type UnifiedSearchSort,
  type UnifiedSearchType,
} from "@/types/search"
import { cn } from "@/lib/utils"
import TrendingTopicsCard from "@/components/feed/trending-topics-card"

const TAB_CONFIG: { value: UnifiedSearchType; label: string; icon: ElementType }[] = [
  { value: "all", label: "综合", icon: Sparkles },
  { value: "posts", label: "文章", icon: Newspaper },
  { value: "activities", label: "动态", icon: Activity },
  { value: "users", label: "用户", icon: User },
  { value: "tags", label: "标签", icon: Hash },
]

const DEFAULT_LIMIT = 10

export function SearchPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const parsedQuery = (searchParams.get("q") ?? "").trim()
  const parsedType = parseType(searchParams.get("type"))
  const parsedPage = parsePage(searchParams.get("page"))
  const parsedLimit = parseLimit(searchParams.get("limit"))
  const parsedSort = parseSort(searchParams.get("sort"))

  const [{ query, type, page, limit, sort }, setSearchState] = useState({
    query: parsedQuery,
    type: parsedType,
    page: parsedPage,
    limit: parsedLimit,
    sort: parsedSort,
  })

  useEffect(() => {
    setSearchState({
      query: parsedQuery,
      type: parsedType,
      page: parsedPage,
      limit: parsedLimit,
      sort: parsedSort,
    })
  }, [parsedQuery, parsedType, parsedPage, parsedLimit, parsedSort])

  const swrKey = query ? ["unified-search", query, type, page, limit, sort] : null

  const { data, error, isLoading, isValidating } = useSWR(
    swrKey,
    async ([, q, activeType, activePage, activeLimit, activeSort]) => {
      const response = await fetchJson<ApiResponse<UnifiedSearchResult>>("/api/search", {
        params: {
          q,
          type: activeType === "all" ? undefined : activeType,
          page: activePage,
          limit: activeLimit,
          sort: activeSort,
        },
      })

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || "搜索失败")
      }

      return response.data
    },
    {
      revalidateOnFocus: false,
      keepPreviousData: false,
    }
  )

  const tabCounts = useMemo(() => {
    return {
      all: data?.overallTotal ?? 0,
      posts: data?.posts?.total ?? 0,
      activities: data?.activities?.total ?? 0,
      users: data?.users?.total ?? 0,
      tags: data?.tags?.total ?? 0,
    }
  }, [data])

  const hasQuery = query.length > 0

  const hasAnyResult =
    (data?.posts?.items?.length ?? 0) +
      (data?.activities?.items?.length ?? 0) +
      (data?.users?.items?.length ?? 0) +
      (data?.tags?.items?.length ?? 0) >
    0

  const hasNext =
    type === "all"
      ? Boolean(
          data?.posts?.hasMore ||
            data?.activities?.hasMore ||
            data?.users?.hasMore ||
            data?.tags?.hasMore
        )
      : Boolean(data && data[type]?.hasMore)

  const hasPrev = page > 1

  const renderContent = () => {
    if (!hasQuery) {
      return <SearchEmptyHint />
    }

    if (isLoading) {
      return <SearchResultsSkeleton />
    }

    if (error) {
      return <SearchError message={error instanceof Error ? error.message : "搜索失败"} />
    }

    if (!data || !hasAnyResult) {
      return <SearchEmptyState />
    }

    return (
      <div className="min-h-[50vh]">
        {type === "all"
          ? renderAllBuckets(data, query)
          : renderSingleBucket(data, type as Exclude<UnifiedSearchType, "all">, query)}

        <div className="border-border flex justify-center gap-3 border-t py-8">
          <Button variant="outline" disabled={!hasPrev} onClick={() => changePage(page - 1)}>
            上一页
          </Button>
          <Button variant="outline" disabled={!hasNext} onClick={() => changePage(page + 1)}>
            下一页
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto grid grid-cols-1 gap-8 px-0 py-6 lg:grid-cols-12 lg:px-4">
        {/* Main Search Feed */}
        <main className="col-span-1 lg:col-span-8">
          {/* Sticky Header Area */}
          <div className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-16 z-30 mb-0 border-b backdrop-blur">
            <div className="px-4 py-3">
              <NavigationSearch className="w-full" />
            </div>

            {/* Tabs */}
            <div className="no-scrollbar flex w-full overflow-x-auto px-2">
              {TAB_CONFIG.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => changeType(value)}
                  className={cn(
                    "relative flex shrink-0 items-center gap-2 px-4 py-3 text-sm font-medium transition-colors",
                    type === value
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground/80"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                  {tabCounts[value] > 0 && (
                    <span className="bg-muted text-muted-foreground ml-1 rounded-full px-1.5 py-0.5 text-[10px]">
                      {tabCounts[value]}
                    </span>
                  )}
                  {type === value && (
                    <div className="bg-primary absolute bottom-0 left-0 right-0 h-0.5" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Status Bar */}
          {hasQuery && (isValidating || data) && (
            <div className="bg-muted/30 text-muted-foreground flex items-center justify-between px-4 py-2 text-xs">
              <span>{isValidating ? "搜索中..." : `找到约 ${tabCounts[type]} 条结果`}</span>
              <span>{sortLabel(sort)}</span>
            </div>
          )}

          {/* Results */}
          <div className="divide-border divide-y">{renderContent()}</div>
        </main>

        {/* Right Sidebar */}
        <aside className="hidden lg:col-span-4 lg:block">
          <div className="sticky top-24 space-y-6 px-4">
            <div className="bg-muted/30 rounded-xl border border-transparent p-4">
              <h3 className="mb-4 text-lg font-bold">搜索趋势</h3>
              <TrendingTopicsCard />
            </div>

            <div className="text-muted-foreground px-2 text-xs">
              <p>提示：支持全文检索。尝试搜索 &ldquo;Next.js&rdquo; 或 &ldquo;React&rdquo;。</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )

  function changeType(nextType: UnifiedSearchType) {
    setSearchState((prev) => ({ ...prev, type: nextType, page: 1 }))
    const params = cloneSearchParams(searchParams)
    params.set("type", nextType)
    params.delete("page")
    params.delete("offset")
    router.push(`/search?${params.toString()}`, { scroll: false })
  }

  function changePage(nextPage: number) {
    setSearchState((prev) => ({ ...prev, page: Math.max(1, nextPage) }))
    const params = cloneSearchParams(searchParams)
    params.set("page", Math.max(1, nextPage).toString())
    router.push(`/search?${params.toString()}`, { scroll: false })
  }
}

function renderAllBuckets(result: UnifiedSearchResult, query: string) {
  return (
    <div className="space-y-2 py-4">
      {/* We render sections separated by a heavier border or headers */}

      {result.users.items.length > 0 && (
        <div className="pb-4">
          <h4 className="text-muted-foreground mb-2 px-4 text-sm font-bold uppercase tracking-wider">
            相关用户
          </h4>
          <div className="divide-border border-border divide-y border-y">
            {result.users.items.map((item) => (
              <SearchResultCard key={`users-${item.id}`} type="users" data={item} query={query} />
            ))}
          </div>
        </div>
      )}

      {result.tags.items.length > 0 && (
        <div className="pb-4">
          <h4 className="text-muted-foreground mb-2 px-4 text-sm font-bold uppercase tracking-wider">
            相关标签
          </h4>
          <div className="divide-border border-border divide-y border-y">
            {result.tags.items.map((item) => (
              <SearchResultCard key={`tags-${item.id}`} type="tags" data={item} query={query} />
            ))}
          </div>
        </div>
      )}

      {result.posts.items.length > 0 && (
        <div className="pb-4">
          <h4 className="text-muted-foreground mb-2 px-4 text-sm font-bold uppercase tracking-wider">
            文章
          </h4>
          <div className="divide-border border-border divide-y border-y">
            {result.posts.items.map((item) => (
              <SearchResultCard key={`posts-${item.id}`} type="posts" data={item} query={query} />
            ))}
          </div>
        </div>
      )}

      {result.activities.items.length > 0 && (
        <div className="pb-4">
          <h4 className="text-muted-foreground mb-2 px-4 text-sm font-bold uppercase tracking-wider">
            动态
          </h4>
          <div className="divide-border border-border divide-y border-y">
            {result.activities.items.map((item) => (
              <SearchResultCard
                key={`activities-${item.id}`}
                type="activities"
                data={item}
                query={query}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function renderSingleBucket(
  result: UnifiedSearchResult,
  type: Exclude<UnifiedSearchType, "all">,
  query: string
) {
  switch (type) {
    case "posts": {
      if (result.posts.items.length === 0) return <SearchEmptyState />
      return (
        <div>
          {result.posts.items.map((item) => (
            <SearchResultCard key={`posts-${item.id}`} type="posts" data={item} query={query} />
          ))}
        </div>
      )
    }
    case "activities": {
      if (result.activities.items.length === 0) return <SearchEmptyState />
      return (
        <div>
          {result.activities.items.map((item) => (
            <SearchResultCard
              key={`activities-${item.id}`}
              type="activities"
              data={item}
              query={query}
            />
          ))}
        </div>
      )
    }
    case "users": {
      if (result.users.items.length === 0) return <SearchEmptyState />
      return (
        <div>
          {result.users.items.map((item) => (
            <SearchResultCard key={`users-${item.id}`} type="users" data={item} query={query} />
          ))}
        </div>
      )
    }
    case "tags": {
      if (result.tags.items.length === 0) return <SearchEmptyState />
      return (
        <div>
          {result.tags.items.map((item) => (
            <SearchResultCard key={`tags-${item.id}`} type="tags" data={item} query={query} />
          ))}
        </div>
      )
    }
    default:
      return <SearchEmptyState />
  }
}

function SearchEmptyHint() {
  return (
    <div className="py-20 text-center">
      <Search className="text-muted-foreground mx-auto mb-4 h-12 w-12 opacity-20" />
      <h3 className="text-lg font-semibold">准备搜索</h3>
      <p className="text-muted-foreground mt-2 text-sm">输入关键词，探索感兴趣的内容</p>
    </div>
  )
}

function SearchEmptyState() {
  return (
    <div className="py-20 text-center">
      <div className="mb-4 text-4xl">🦕</div>
      <h3 className="text-lg font-semibold">未找到结果</h3>
      <p className="text-muted-foreground mt-2 text-sm">换个关键词试试看？</p>
    </div>
  )
}

function SearchError({ message }: { message: string }) {
  return (
    <div className="text-destructive py-20 text-center">
      <h3 className="text-lg font-semibold">出错了</h3>
      <p className="mt-2 text-sm">{message}</p>
    </div>
  )
}

function parseType(raw: string | null): UnifiedSearchType {
  return UNIFIED_SEARCH_TYPES.includes(raw as UnifiedSearchType)
    ? (raw as UnifiedSearchType)
    : "all"
}

function parsePage(raw: string | null): number {
  const parsed = raw ? Number.parseInt(raw, 10) : 1
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

function parseLimit(raw: string | null): number {
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_LIMIT
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT
  return Math.min(Math.max(parsed, 1), DEFAULT_LIMIT)
}

function parseSort(raw: string | null): UnifiedSearchSort {
  return UNIFIED_SEARCH_SORTS.includes(raw as UnifiedSearchSort)
    ? (raw as UnifiedSearchSort)
    : "relevance"
}

function sortLabel(sort: UnifiedSearchSort) {
  switch (sort) {
    case "latest":
      return "按时间排序"
    default:
      return "按相关度排序"
  }
}

function cloneSearchParams(params: URLSearchParams | ReturnType<typeof useSearchParams>) {
  const next = new URLSearchParams()
  params.forEach((value, key) => next.set(key, value))
  return next
}
