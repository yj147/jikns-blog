/**
 * 标签云页面
 * Phase 10 - M3 阶段
 */

import { Metadata } from "next"
import { getTags, type TagData, type TagListPagination } from "@/lib/actions/tags"
import { TagCard } from "@/components/blog/tag-card"
import { Input } from "@/components/ui/input"
import { Search, Hash, AlertCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { logger } from "@/lib/utils/logger"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from "@/components/ui/pagination"

const PAGE_SIZE = 60

// 页面元数据
export const metadata: Metadata = {
  title: "标签云 - 探索所有主题",
  description: "浏览所有博客标签，发现感兴趣的主题和内容分类",
  openGraph: {
    title: "标签云 - 探索所有主题",
    description: "浏览所有博客标签，发现感兴趣的主题和内容分类",
    type: "website",
  },
}

interface TagsPageProps {
  searchParams: Promise<{ q?: string; page?: string }>
}

export default async function TagsPage({ searchParams }: TagsPageProps) {
  const params = await searchParams
  const searchQuery = params.q?.trim() ?? ""
  const parsedPage = Number.parseInt(params.page ?? "", 10)
  const requestedPage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1

  const firstPage = await getTags({
    page: requestedPage,
    limit: PAGE_SIZE,
    orderBy: "postsCount",
    order: "desc",
    search: searchQuery || undefined,
  })

  let requestError: { code: string; message: string } | null = null

  if (!firstPage.success) {
    requestError = {
      code: firstPage.error?.code ?? "UNKNOWN_ERROR",
      message: firstPage.error?.message ?? "获取标签列表失败",
    }
    logger.warn("Tags page failed to load tag list", {
      code: requestError.code,
      message: requestError.message,
      details: firstPage.error?.details,
      searchQuery: searchQuery || undefined,
      requestedPage,
    })
  }

  let tags: TagData[] = []
  let pagination: TagListPagination | null = null

  if (firstPage.success && firstPage.data) {
    tags = firstPage.data.tags ?? []
    pagination = firstPage.data.pagination
  }

  const totalTags = pagination?.total ?? tags.length
  const activePage = pagination?.page ?? requestedPage
  const rawTotalPages = pagination?.totalPages ?? 1
  const totalPages = Math.max(1, rawTotalPages)
  const hasPrev = activePage > 1
  const hasNext = pagination?.hasMore ?? activePage < totalPages

  const buildPageHref = (page: number) => {
    const query = new URLSearchParams()
    if (searchQuery) {
      query.set("q", searchQuery)
    }
    if (page > 1) {
      query.set("page", String(page))
    }
    const qs = query.toString()
    return qs ? `/tags?${qs}` : "/tags"
  }

  const pageNumbers = (() => {
    if (!pagination || totalPages <= 1) {
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
          <form action="/tags" method="get">
            <div className="relative">
              <Search className="text-muted-foreground absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2" />
              <Input
                type="search"
                name="q"
                placeholder="搜索标签..."
                defaultValue={searchQuery}
                className="pl-10 pr-4"
              />
            </div>
          </form>
        </div>

        {/* 标签网格 */}
        {requestError ? (
          <Card className="mx-auto max-w-2xl">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <AlertCircle className="text-destructive mb-4 h-12 w-12" />
              <h3 className="mb-2 text-lg font-semibold">无法加载标签列表</h3>
              <p className="text-muted-foreground mb-2">{requestError.message}</p>
              <p className="text-muted-foreground text-sm">
                错误代码 {requestError.code} · 请稍后重试或联系管理员
              </p>
            </CardContent>
          </Card>
        ) : tags.length === 0 ? (
          <Card className="mx-auto max-w-2xl">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <AlertCircle className="text-muted-foreground mb-4 h-12 w-12" />
              <h3 className="mb-2 text-lg font-semibold">
                {searchQuery ? "未找到匹配的标签" : "还没有标签"}
              </h3>
              <p className="text-muted-foreground">
                {searchQuery
                  ? "尝试使用不同的搜索词"
                  : "标签由管理员统一创建，文章发布后会逐步补齐"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {tags.map((tag, index) => (
              <TagCard key={tag.id} tag={tag} index={index} />
            ))}
          </div>
        )}

        {/* 统计信息 */}
        {tags.length > 0 && (
          <div className="mt-12 space-y-4 text-center">
            {pagination && totalPages > 1 && (
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
            )}

            <p className="text-muted-foreground text-sm">
              第 <span className="font-semibold">{activePage}</span> /{" "}
              <span className="font-semibold">{totalPages}</span> 页 · 共{" "}
              <span className="font-semibold">{totalTags}</span> 个标签
              {searchQuery && (
                <>
                  ，匹配搜索词 &ldquo;<span className="font-semibold">{searchQuery}</span>&rdquo;
                </>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
