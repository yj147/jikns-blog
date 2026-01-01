"use client"

import { useMemo } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import useSWR from "swr"
import { AlertCircle, SortDesc } from "lucide-react"

import { BlogPostCard } from "@/components/blog/blog-post-card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { fetchJson } from "@/lib/api/fetch-json"
import { cn } from "@/lib/utils"
import type { PaginationMeta, PostListItem } from "@/types/blog"

const PAGE_SIZE = 10

type SortValue = "publishedAt" | "viewCount"

type PostsApiResponse = {
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
  error?: {
    code?: string
    message?: string
    details?: unknown
  }
}

interface TagPostsClientProps {
  slug: string
  initialPosts: PostListItem[]
  initialPagination: PaginationMeta | null
  initialError: { code?: string; message: string } | null
}

const fetcher = (url: string) => fetchJson<PostsApiResponse>(url)

function normalizePosts(posts: PostListItem[]) {
  return posts.map((post) => ({
    ...post,
    publishedAt: post.publishedAt || post.createdAt,
  }))
}

function clampSort(value: string | null): SortValue {
  return value === "viewCount" ? "viewCount" : "publishedAt"
}

function clampPage(value: string | null): number {
  const parsed = Number.parseInt(value ?? "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

function buildPageNumbers(currentPage: number, totalPages: number) {
  if (totalPages <= 1) return []

  const pages: Array<number | "ellipsis"> = []
  pages.push(1)

  const start = Math.max(2, currentPage - 2)
  const end = Math.min(totalPages - 1, currentPage + 2)

  if (start > 2) {
    pages.push("ellipsis")
  }

  for (let page = start; page <= end; page += 1) {
    pages.push(page)
  }

  if (end < totalPages - 1) {
    pages.push("ellipsis")
  }

  if (totalPages > 1) {
    pages.push(totalPages)
  }

  return pages
}

function buildTagHref(slug: string, sort: SortValue, page: number) {
  const params = new URLSearchParams()
  if (page > 1) {
    params.set("page", String(page))
  }
  if (sort !== "publishedAt") {
    params.set("sort", sort)
  }
  const query = params.toString()
  return query ? `/tags/${slug}?${query}` : `/tags/${slug}`
}

export function TagPostsClient({
  slug,
  initialPosts,
  initialPagination,
  initialError,
}: TagPostsClientProps) {
  const searchParams = useSearchParams()

  const currentPage = clampPage(searchParams.get("page"))
  const sortValue = clampSort(searchParams.get("sort"))
  const useInitialData = currentPage === 1 && sortValue === "publishedAt"

  const apiUrl = useMemo(() => {
    if (useInitialData) return null
    const params = new URLSearchParams()
    params.set("page", String(currentPage))
    params.set("limit", String(PAGE_SIZE))
    params.set("tag", slug)
    params.set("orderBy", sortValue)
    params.set("order", "desc")
    return `/api/posts?${params.toString()}`
  }, [currentPage, slug, sortValue, useInitialData])

  const { data, error, isLoading, mutate } = useSWR<PostsApiResponse>(apiUrl, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  })

  const view = useMemo(() => {
    if (useInitialData) {
      return {
        posts: normalizePosts(initialPosts),
        pagination: initialPagination,
        requestError: initialError,
        loading: false,
      }
    }

    if (error) {
      return {
        posts: [] as PostListItem[],
        pagination: null as PaginationMeta | null,
        requestError: { code: "NETWORK_ERROR", message: "文章加载失败" },
        loading: false,
      }
    }

    if (!data) {
      return {
        posts: [] as PostListItem[],
        pagination: null as PaginationMeta | null,
        requestError: null as { code?: string; message: string } | null,
        loading: isLoading,
      }
    }

    if (!data.success) {
      return {
        posts: [] as PostListItem[],
        pagination: null as PaginationMeta | null,
        requestError: { code: data.error?.code, message: data.error?.message ?? "文章加载失败" },
        loading: false,
      }
    }

    const normalizedPosts = normalizePosts(data.data?.posts ?? [])
    const apiPagination = data.data?.pagination
    const pagination = apiPagination
      ? ({
          page: apiPagination.currentPage,
          limit: PAGE_SIZE,
          total: apiPagination.totalCount,
          totalPages: apiPagination.totalPages,
          hasNext: apiPagination.hasNext,
          hasPrev: apiPagination.hasPrev,
        } satisfies PaginationMeta)
      : null

    return {
      posts: normalizedPosts,
      pagination,
      requestError: null as { code?: string; message: string } | null,
      loading: false,
    }
  }, [data, error, initialError, initialPagination, initialPosts, isLoading, useInitialData])

  const totalPages = Math.max(1, view.pagination?.totalPages ?? 1)
  const pageNumbers = buildPageNumbers(currentPage, totalPages)

  const hasPrev = view.pagination?.hasPrev ?? currentPage > 1
  const hasNext = view.pagination?.hasNext ?? currentPage < totalPages

  return (
    <>
      <div className="mb-6 flex items-center justify-end">
        <div className="flex items-center gap-2">
          <SortDesc className="text-muted-foreground h-4 w-4" aria-hidden />
          <div className="border-border bg-background flex items-center gap-1 rounded-md border p-1">
            {[
              { value: "publishedAt" as const, label: "最新" },
              { value: "viewCount" as const, label: "热门" },
            ].map((item) => {
              const isActive = item.value === sortValue
              return (
                <Link
                  key={item.value}
                  href={buildTagHref(slug, item.value, 1)}
                  prefetch={false}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    buttonVariants({
                      variant: isActive ? "secondary" : "ghost",
                      size: "sm",
                    }),
                    "h-8"
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      {view.requestError ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <AlertCircle className="text-destructive mb-2 h-12 w-12" />
            <h3 className="text-lg font-semibold">文章加载失败</h3>
            <p className="text-muted-foreground">
              {view.requestError.message}
              {view.requestError.code ? `（错误代码：${view.requestError.code}）` : ""}
            </p>
            <Button variant="outline" size="sm" onClick={() => void mutate()}>
              重新加载
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link href="/blog" prefetch={false}>
                浏览全部文章
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : view.loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="bg-muted h-32 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : view.posts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <AlertCircle className="text-muted-foreground mb-4 h-12 w-12" />
            <h3 className="mb-2 text-lg font-semibold">暂无文章</h3>
            <p className="text-muted-foreground mb-4">该标签下还没有发布的文章</p>
            <Button asChild>
              <Link href="/blog" prefetch={false}>
                浏览所有文章
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mb-8 space-y-6">
            {view.posts.map((post, index) => (
              <BlogPostCard key={post.id} post={post} index={index} />
            ))}
          </div>

          {totalPages > 1 && view.pagination && (
            <div className="mt-12">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href={hasPrev ? buildTagHref(slug, sortValue, currentPage - 1) : "#"}
                      aria-disabled={!hasPrev}
                      className={!hasPrev ? "pointer-events-none opacity-50" : ""}
                      tabIndex={hasPrev ? undefined : -1}
                    />
                  </PaginationItem>
                  {pageNumbers.map((pageNum, pageIndex) =>
                    pageNum === "ellipsis" ? (
                      <PaginationItem key={`ellipsis-${pageIndex}`}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    ) : (
                      <PaginationItem key={pageNum}>
                        <PaginationLink
                          href={buildTagHref(slug, sortValue, pageNum)}
                          isActive={pageNum === currentPage}
                        >
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    )
                  )}
                  <PaginationItem>
                    <PaginationNext
                      href={hasNext ? buildTagHref(slug, sortValue, currentPage + 1) : "#"}
                      aria-disabled={!hasNext}
                      className={!hasNext ? "pointer-events-none opacity-50" : ""}
                      tabIndex={hasNext ? undefined : -1}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </>
      )}
    </>
  )
}
