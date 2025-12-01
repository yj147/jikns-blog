/**
 * 统一搜索客户端页面
 * 通过 /api/search 获取结果，支持 Tab、分页、加载/空/错误状态
 */

"use client"

import useSWR from "swr"
import { useEffect, useMemo, useState } from "react"
import type { ElementType } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { FileText, Hash, Search, User, Activity } from "lucide-react"

import NavigationSearch from "@/components/navigation-search"
import { SearchResultCard } from "@/components/search/search-result-card"
import { SearchResultsSkeleton } from "@/components/search/search-results-skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { fetchJson } from "@/lib/api/fetch-json"
import type { ApiResponse } from "@/types/api"
import {
  UNIFIED_SEARCH_SORTS,
  UNIFIED_SEARCH_TYPES,
  type UnifiedSearchResult,
  type UnifiedSearchSort,
  type UnifiedSearchType,
} from "@/types/search"

const TAB_CONFIG: { value: UnifiedSearchType; label: string; icon: ElementType }[] = [
  { value: "all", label: "全部", icon: Search },
  { value: "posts", label: "文章", icon: FileText },
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

  const { data, error, isLoading, isValidating, mutate } = useSWR(
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
      <div className="space-y-6" data-testid="search-results">
        {type === "all"
          ? renderAllBuckets(data, query)
          : renderSingleBucket(data, type as Exclude<UnifiedSearchType, "all">, query)}

        <div className="flex justify-center gap-3">
          <Button variant="outline" disabled={!hasPrev} onClick={() => changePage(page - 1)}>
            上一页
          </Button>
          <Button variant="outline" disabled={!hasNext} onClick={() => changePage(page + 1)}>
            下一页
          </Button>
          {isValidating && <Badge variant="secondary">刷新中</Badge>}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-10 space-y-8">
        <header className="space-y-4 text-center">
          <p className="text-primary/80 text-sm font-semibold uppercase tracking-[0.18em]">
            Unified Search
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">搜索文章、动态、用户与标签</h1>
          <p className="text-muted-foreground mx-auto max-w-2xl text-base">
            全文检索由 PostgreSQL FTS 提供支持。按 Tab 切换结果类型，使用分页查看更多内容。
          </p>
          <div className="mx-auto max-w-3xl">
            <NavigationSearch className="w-full" />
          </div>
        </header>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">
                {hasQuery ? (
                  <>
                    找到 <span className="font-semibold">{tabCounts[type]}</span>{" "}
                    {type === "all" ? "条相关内容（全部类型）" : "条结果"}
                  </>
                ) : (
                  "输入关键词开始搜索"
                )}
              </p>
              {hasQuery && (
                <p className="text-muted-foreground mt-1 text-xs">
                  当前页：{page}，每页 {limit} 条，排序：{sortLabel(sort)}
                </p>
              )}
            </div>
          </div>

          <Tabs value={type} onValueChange={(next) => changeType(next as UnifiedSearchType)}>
            <TabsList className="grid w-full grid-cols-5">
              {TAB_CONFIG.map(({ value, label, icon: Icon }) => (
                <TabsTrigger key={value} value={value} className="gap-2">
                  <Icon className="h-4 w-4" />
                  {label}
                  <Badge variant="secondary" className="ml-1">
                    {tabCounts[value]}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </section>

        {renderContent()}
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
    <div className="space-y-8">
      {result.posts.items.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline">文章</Badge>
            <span className="text-muted-foreground text-sm">{result.posts.items.length} 条</span>
          </div>
          <div className="space-y-4">
            {result.posts.items.map((item) => (
              <SearchResultCard key={`posts-${item.id}`} type="posts" data={item} query={query} />
            ))}
          </div>
        </div>
      )}

      {result.activities.items.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline">动态</Badge>
            <span className="text-muted-foreground text-sm">{result.activities.items.length} 条</span>
          </div>
          <div className="space-y-4">
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

      {result.users.items.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline">用户</Badge>
            <span className="text-muted-foreground text-sm">{result.users.items.length} 条</span>
          </div>
          <div className="space-y-4">
            {result.users.items.map((item) => (
              <SearchResultCard key={`users-${item.id}`} type="users" data={item} query={query} />
            ))}
          </div>
        </div>
      )}

      {result.tags.items.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline">标签</Badge>
            <span className="text-muted-foreground text-sm">{result.tags.items.length} 条</span>
          </div>
          <div className="space-y-4">
            {result.tags.items.map((item) => (
              <SearchResultCard key={`tags-${item.id}`} type="tags" data={item} query={query} />
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
        <div className="space-y-4">
          {result.posts.items.map((item) => (
            <SearchResultCard key={`posts-${item.id}`} type="posts" data={item} query={query} />
          ))}
        </div>
      )
    }
    case "activities": {
      if (result.activities.items.length === 0) return <SearchEmptyState />
      return (
        <div className="space-y-4">
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
        <div className="space-y-4">
          {result.users.items.map((item) => (
            <SearchResultCard key={`users-${item.id}`} type="users" data={item} query={query} />
          ))}
        </div>
      )
    }
    case "tags": {
      if (result.tags.items.length === 0) return <SearchEmptyState />
      return (
        <div className="space-y-4">
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
    <Card data-testid="search-empty-hint">
      <CardContent className="py-12 text-center space-y-3">
        <Search className="text-muted-foreground mx-auto h-10 w-10" />
        <h3 className="text-xl font-semibold">输入关键词开始搜索</h3>
        <p className="text-muted-foreground text-sm">
          支持模糊匹配与全文检索，最多 100 字。按 Tab 可筛选结果类型。
        </p>
      </CardContent>
    </Card>
  )
}

function SearchEmptyState() {
  return (
    <Card data-testid="search-empty-state">
      <CardContent className="py-12 text-center space-y-3">
        <Search className="text-muted-foreground mx-auto h-10 w-10" />
        <h3 className="text-xl font-semibold">没有找到相关结果</h3>
        <p className="text-muted-foreground text-sm">尝试更短的关键词或切换其他 Tab。</p>
      </CardContent>
    </Card>
  )
}

function SearchError({ message }: { message: string }) {
  return (
    <Card data-testid="search-error">
      <CardContent className="py-12 text-center space-y-3">
        <Search className="text-destructive mx-auto h-10 w-10" />
        <h3 className="text-xl font-semibold">搜索出错</h3>
        <p className="text-muted-foreground text-sm">{message}</p>
        <p className="text-muted-foreground text-xs">请稍后重试或检查网络连接。</p>
      </CardContent>
    </Card>
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
      return "最新优先"
    default:
      return "相关度优先"
  }
}

function cloneSearchParams(params: URLSearchParams | ReturnType<typeof useSearchParams>) {
  const next = new URLSearchParams()
  params.forEach((value, key) => next.set(key, value))
  return next
}
