"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import useSWR from "swr"
import { Search, Hash, AlertCircle } from "lucide-react"

import { TagCard } from "@/components/blog/tag-card"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from "@/components/ui/pagination"
import { useDebounce } from "@/hooks/use-debounce"
import { fetchJson } from "@/lib/api/fetch-json"

type TagListItem = {
  id: string
  name: string
  slug: string
  description: string | null
  color: string | null
  postsCount: number
}

type TagListPagination = {
  page: number
  limit: number
  total: number
  hasMore: boolean
  totalPages: number
}

type TagsApiResponse = {
  success: boolean
  data?: {
    tags?: TagListItem[]
    pagination?: TagListPagination
  }
  error?: {
    code?: string
    message?: string
    details?: unknown
  }
}

interface TagsPageClientProps {
  pageSize: number
  initialTags: TagListItem[]
  initialPagination: TagListPagination | null
  initialError: { code: string; message: string } | null
}

const fetcher = (url: string) => fetchJson<TagsApiResponse>(url)

export function TagsPageClient({
  pageSize,
  initialTags,
  initialPagination,
  initialError,
}: TagsPageClientProps) {
  const searchParams = useSearchParams()

  const resolvedInitialQuery = useMemo(() => {
    return (searchParams.get("q") ?? "").trim()
  }, [searchParams])

  const resolvedInitialPage = useMemo(() => {
    const parsedPage = Number.parseInt(searchParams.get("page") ?? "", 10)
    return Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1
  }, [searchParams])

  const [urlQuery, setUrlQuery] = useState(resolvedInitialQuery)
  const [activePage, setActivePage] = useState(resolvedInitialPage)

  useEffect(() => {
    const syncFromLocation = () => {
      const params = new URLSearchParams(window.location.search)
      const nextQuery = (params.get("q") ?? "").trim()
      const parsedPage = Number.parseInt(params.get("page") ?? "", 10)
      const nextPage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1
      setUrlQuery(nextQuery)
      setActivePage(nextPage)
    }

    window.addEventListener("popstate", syncFromLocation)
    return () => window.removeEventListener("popstate", syncFromLocation)
  }, [])

  const useInitialData = urlQuery === "" && activePage === 1

  const apiUrl = useMemo(() => {
    if (useInitialData) return null

    const params = new URLSearchParams()
    params.set("page", String(activePage))
    params.set("limit", String(pageSize))
    params.set("orderBy", "postsCount")
    params.set("order", "desc")
    if (urlQuery) {
      params.set("search", urlQuery)
    }
    return `/api/tags?${params.toString()}`
  }, [activePage, pageSize, urlQuery, useInitialData])

  const { data, error, isLoading } = useSWR<TagsApiResponse>(apiUrl, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  })

  const view = useMemo(() => {
    if (useInitialData) {
      return {
        tags: initialTags,
        pagination: initialPagination,
        requestError: initialError,
      }
    }

    if (error) {
      return {
        tags: [] as TagListItem[],
        pagination: null as TagListPagination | null,
        requestError: { code: "NETWORK_ERROR", message: "无法加载标签列表" },
      }
    }

    if (!data) {
      return {
        tags: [] as TagListItem[],
        pagination: null as TagListPagination | null,
        requestError: null as { code: string; message: string } | null,
      }
    }

    if (!data.success) {
      return {
        tags: [] as TagListItem[],
        pagination: null as TagListPagination | null,
        requestError: {
          code: data.error?.code ?? "UNKNOWN_ERROR",
          message: data.error?.message ?? "获取标签列表失败",
        },
      }
    }

    return {
      tags: data.data?.tags ?? [],
      pagination: data.data?.pagination ?? null,
      requestError: null,
    }
  }, [data, error, initialError, initialPagination, initialTags, useInitialData])

  const [queryInput, setQueryInput] = useState(urlQuery)
  const debouncedQuery = useDebounce(queryInput, 500)

  useEffect(() => {
    setQueryInput(urlQuery)
  }, [urlQuery])

  const replaceUrlIfChanged = useCallback((nextQuery: string) => {
    const query = new URLSearchParams()
    if (nextQuery) {
      query.set("q", nextQuery)
    }
    const url = query.toString() ? `/tags?${query.toString()}` : "/tags"
    const currentUrl = `${window.location.pathname}${window.location.search}`
    if (currentUrl === url) return

    window.history.replaceState(null, "", url)
    setUrlQuery(nextQuery)
    setActivePage(1)
  }, [])

  useEffect(() => {
    const normalized = debouncedQuery.trim()
    replaceUrlIfChanged(normalized)
  }, [debouncedQuery, replaceUrlIfChanged])

  const totalTags = view.pagination?.total ?? view.tags.length
  const totalPages = Math.max(1, view.pagination?.totalPages ?? 1)
  const hasPrev = activePage > 1
  const hasNext = view.pagination?.hasMore ?? activePage < totalPages

  const buildPageHref = (page: number) => {
    const query = new URLSearchParams()
    if (urlQuery) {
      query.set("q", urlQuery)
    }
    if (page > 1) {
      query.set("page", String(page))
    }
    const qs = query.toString()
    return qs ? `/tags?${qs}` : "/tags"
  }

  const pageNumbers = (() => {
    if (!view.pagination || totalPages <= 1) {
      return []
    }
    const pages: (number | "ellipsis")[] = []
    const delta = 2
    pages.push(1)
    const startPage = Math.max(2, activePage - delta)
    const endPage = Math.min(totalPages - 1, activePage + delta)
    if (startPage > 2) {
      pages.push("ellipsis")
    }
    for (let index = startPage; index <= endPage; index++) {
      pages.push(index)
    }
    if (endPage < totalPages - 1) {
      pages.push("ellipsis")
    }
    if (totalPages > 1) {
      pages.push(totalPages)
    }
    return pages
  })()

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-12">
        {/* 页面头部 */}
        <div className="mb-12 text-center">
          <div className="mb-4 flex items-center justify-center">
            <div className="bg-primary/10 text-primary rounded-full p-4">
              <Hash className="h-8 w-8" />
            </div>
          </div>
          <h1 className="mb-4 text-4xl font-bold tracking-tight">标签云</h1>
          <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
            探索 {totalTags} 个主题标签，发现感兴趣的内容分类
          </p>
        </div>

        {/* 搜索栏 */}
        <div className="mx-auto mb-12 max-w-2xl">
          <div className="relative">
            <Search className="text-muted-foreground absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2" />
            <Input
              type="search"
              name="q"
              placeholder="搜索标签..."
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              className="pl-10 pr-4"
              autoComplete="off"
            />
          </div>
        </div>

        {/* 标签网格 */}
        {view.requestError ? (
          <Card className="mx-auto max-w-2xl">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <AlertCircle className="text-destructive mb-4 h-12 w-12" />
              <h3 className="mb-2 text-lg font-semibold">无法加载标签列表</h3>
              <p className="text-muted-foreground mb-2">{view.requestError.message}</p>
              <p className="text-muted-foreground text-sm">
                错误代码 {view.requestError.code} · 请稍后重试或联系管理员
              </p>
            </CardContent>
          </Card>
        ) : isLoading && view.tags.length === 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 12 }).map((_, index) => (
              <div key={index} className="bg-muted h-40 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : view.tags.length === 0 ? (
          <Card className="mx-auto max-w-2xl">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <AlertCircle className="text-muted-foreground mb-4 h-12 w-12" />
              <h3 className="mb-2 text-lg font-semibold">
                {urlQuery ? "未找到匹配的标签" : "还没有标签"}
              </h3>
              <p className="text-muted-foreground">
                {urlQuery ? "尝试使用不同的搜索词" : "标签由管理员统一创建，文章发布后会逐步补齐"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {view.tags.map((tag, index) => (
              <TagCard key={tag.id} tag={tag} index={index} />
            ))}
          </div>
        )}

        {/* 分页 */}
        {view.tags.length > 0 && view.pagination && totalPages > 1 && (
          <div className="mt-12 space-y-4 text-center">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href={hasPrev ? buildPageHref(activePage - 1) : "#"}
                    aria-disabled={!hasPrev}
                    className={!hasPrev ? "pointer-events-none opacity-50" : ""}
                    tabIndex={hasPrev ? undefined : -1}
                  />
                </PaginationItem>
                {pageNumbers.map((pageNum, index) =>
                  pageNum === "ellipsis" ? (
                    <PaginationItem key={`ellipsis-${index}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={pageNum}>
                      <PaginationLink
                        href={buildPageHref(pageNum)}
                        isActive={pageNum === activePage}
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  )
                )}
                <PaginationItem>
                  <PaginationNext
                    href={hasNext ? buildPageHref(activePage + 1) : "#"}
                    aria-disabled={!hasNext}
                    className={!hasNext ? "pointer-events-none opacity-50" : ""}
                    tabIndex={hasNext ? undefined : -1}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>
    </div>
  )
}
