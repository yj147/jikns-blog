"use client"

import { useEffect, useMemo, useRef } from "react"
import useSWRInfinite from "swr/infinite"
import { Loader2, RefreshCcw, AlertCircle, Sparkles } from "lucide-react"
import { BlogPostCard } from "@/components/blog/blog-post-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchJson } from "@/lib/api/fetch-json"
import type { PostListItem } from "@/types/blog"

interface BlogListClientProps {
  initialPosts: PostListItem[]
  initialPagination: { total: number; hasNext: boolean; nextCursor?: string | null }
  searchQuery?: string
  tagFilter?: string
  sortBy?: string
}

interface PostsApiResponse {
  success: boolean
  data?: {
    posts: PostListItem[]
    pagination?: {
      currentPage: number
      totalPages: number
      totalCount: number
      hasNext: boolean
      hasPrev: boolean
      nextCursor?: string | null
    }
  }
  meta?: {
    pagination?: {
      page?: number
      limit: number
      total: number | null
      hasMore: boolean
      nextCursor?: string | null
    }
  }
}

const PAGE_SIZE = 10
const ALLOWED_SORTS = new Set(["publishedAt", "createdAt", "viewCount"])
const fetcher = (url: string) => fetchJson<PostsApiResponse>(url)

function getHasMore(page?: PostsApiResponse | null) {
  return page?.meta?.pagination?.hasMore ?? page?.data?.pagination?.hasNext ?? false
}

function getNextCursor(page?: PostsApiResponse | null) {
  return page?.meta?.pagination?.nextCursor ?? page?.data?.pagination?.nextCursor ?? null
}

function getTotal(page?: PostsApiResponse | null, fallback?: number) {
  const totalFromMeta = page?.meta?.pagination?.total
  if (typeof totalFromMeta === "number" && totalFromMeta >= 0) return totalFromMeta

  const totalFromData = page?.data?.pagination?.totalCount
  if (typeof totalFromData === "number") return totalFromData

  return fallback ?? 0
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }).map((_, index) => (
        <Card key={index} className="border-border/70 bg-background shadow-none">
          <CardContent className="space-y-4 py-6">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
            <div className="space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
            <Skeleton className="h-48 w-full rounded-xl" />
            <div className="flex gap-3">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-20" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function BlogListClient({
  initialPosts,
  initialPagination,
  searchQuery,
  tagFilter,
  sortBy,
}: BlogListClientProps) {
  const normalizedSearch = searchQuery?.trim() ?? ""
  const normalizedTag = tagFilter?.trim() ?? ""
  const orderBy = sortBy && ALLOWED_SORTS.has(sortBy) ? sortBy : "publishedAt"

  const initialPage = useMemo<PostsApiResponse | undefined>(() => {
    if (!initialPosts || initialPosts.length === 0) return undefined

    const nextCursor = initialPagination.nextCursor ?? (initialPagination.hasNext ? "2" : null)
    const totalPages = Math.max(1, Math.ceil((initialPagination.total || initialPosts.length) / PAGE_SIZE))

    return {
      success: true,
      data: {
        posts: initialPosts,
        pagination: {
          currentPage: 1,
          totalPages,
          totalCount: initialPagination.total,
          hasNext: initialPagination.hasNext,
          hasPrev: false,
          nextCursor,
        },
      },
      meta: {
        pagination: {
          page: 1,
          limit: PAGE_SIZE,
          total: initialPagination.total,
          hasMore: initialPagination.hasNext,
          nextCursor,
        },
      },
    }
  }, [initialPagination.hasNext, initialPagination.nextCursor, initialPagination.total, initialPosts])

  const { data, error, isLoading, isValidating, size, setSize, mutate } = useSWRInfinite<PostsApiResponse>(
    (pageIndex, previousPage) => {
      if (previousPage && !getHasMore(previousPage)) return null

      const params = new URLSearchParams()
      params.set("limit", PAGE_SIZE.toString())
      params.set("page", String(pageIndex + 1))
      params.set("orderBy", orderBy)
      params.set("order", "desc")

      if (normalizedSearch) params.set("search", normalizedSearch)
      if (normalizedTag) params.set("tag", normalizedTag)

      if (pageIndex > 0) {
        const cursor = getNextCursor(previousPage)
        if (!cursor) return null
        params.set("cursor", cursor)
      }

      return `/api/posts?${params.toString()}`
    },
    fetcher,
    {
      fallbackData: initialPage ? [initialPage] : undefined,
      revalidateOnFocus: false,
      revalidateFirstPage: false,
      revalidateIfStale: false,
      revalidateOnReconnect: true,
    }
  )

  const pages = useMemo(() => data ?? (initialPage ? [initialPage] : []), [data, initialPage])
  const posts = useMemo(() => pages.flatMap((page) => page?.data?.posts ?? []), [pages])

  const hasMore = pages.length
    ? getHasMore(pages[pages.length - 1])
    : initialPagination.hasNext
  const total = pages.length ? getTotal(pages[0], initialPagination.total) : initialPagination.total
  const isInitialLoading = isLoading && posts.length === 0
  const isLoadingMore = isValidating && size > pages.length
  const displayTotal = total && total > 0 ? total : posts.length

  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const node = sentinelRef.current
    if (!node) return

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry.isIntersecting && hasMore && !isLoadingMore) {
          setSize((current) => current + 1)
        }
      },
      { rootMargin: "240px" }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, isLoadingMore, setSize])

  if (error && posts.length === 0) {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-muted-foreground">加载文章失败</p>
          <Button variant="outline" onClick={() => mutate()}>
            <RefreshCcw className="mr-2 h-4 w-4" />重试
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (isInitialLoading) {
    return <LoadingSkeleton />
  }

  if (!posts.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="mb-4 rounded-full bg-muted p-6">
          <Sparkles className="h-12 w-12 text-muted-foreground" />
        </div>
        <h3 className="mb-2 text-xl font-bold">{normalizedSearch || normalizedTag ? "暂无相关内容" : "这里还很空旷"}</h3>
        <p className="text-muted-foreground mb-6 max-w-sm text-sm">
          {normalizedSearch
            ? "换个关键词试试？"
            : normalizedTag
              ? "换个标签探索其他主题。"
              : "我们正在撰写更多精彩内容，敬请期待。"}
        </p>
        <Button onClick={() => mutate()} variant="outline">
          <RefreshCcw className="mr-2 h-4 w-4" /> 重新加载
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {posts.map((post, index) => (
        <BlogPostCard key={post.id} post={post} index={index} />
      ))}

      {isLoadingMore && (
        <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>加载中…</span>
        </div>
      )}

      <div ref={sentinelRef} aria-hidden />

      {hasMore && (
        <div className="py-4 text-center">
          <Button onClick={() => setSize((current) => current + 1)} disabled={isLoadingMore} variant="outline">
            {isLoadingMore ? "加载中…" : "加载更多"}
          </Button>
          <p className="text-muted-foreground mt-2 text-xs">已加载 {posts.length} / {displayTotal} 篇</p>
        </div>
      )}

      {!hasMore && posts.length > 0 && (
        <p className="text-muted-foreground py-6 text-center text-xs">没有更多内容了</p>
      )}
    </div>
  )
}
