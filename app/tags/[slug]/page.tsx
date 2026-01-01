/**
 * 标签详情页
 * Phase 10 - M3 阶段
 */

import { cache, Suspense } from "react"
import { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"

import { getTag } from "@/lib/actions/tags/queries-cacheable"
import { getPosts } from "@/lib/actions/posts"
import { BlogPostCard } from "@/components/blog/blog-post-card"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { cn } from "@/lib/utils"
import { Hash, FileText, ArrowLeft, AlertCircle, SortDesc } from "lucide-react"
import { PostListItem } from "@/types/blog"
import { logger } from "@/lib/utils/logger"
import { TagPostsClient } from "./tag-posts-client"

export const revalidate = 120

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  return []
}

interface TagDetailPageProps {
  params: Promise<{ slug: string }>
}

const resolveTag = cache(async (slug: string) => {
  const result = await getTag(slug)
  if (!result.success || !result.data) {
    return null
  }
  return result.data.tag
})

export async function generateMetadata({ params }: TagDetailPageProps): Promise<Metadata> {
  const { slug } = await params
  const tag = await resolveTag(slug)

  if (!tag) {
    return {
      title: "标签不存在",
    }
  }

  const title = `${tag.name} - 标签详情`
  const description = tag.description || `浏览所有关于 ${tag.name} 的文章，共 ${tag.postsCount} 篇`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
    },
  }
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

function buildTagHref(slug: string, sort: "publishedAt" | "viewCount", page: number) {
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

export default async function TagDetailPage({ params }: TagDetailPageProps) {
  const { slug } = await params

  const tag = await resolveTag(slug)
  if (!tag) {
    notFound()
  }

  const postsResult = await getPosts({
    page: 1,
    limit: 10,
    tag: slug,
    published: true,
    orderBy: "publishedAt",
    order: "desc",
  })

  let initialPosts: PostListItem[] = []
  const initialPagination = postsResult.success ? postsResult.pagination : null
  let initialError: { code?: string; message: string } | null = null

  if (postsResult.success && postsResult.data) {
    initialPosts = postsResult.data.map((post) => ({
      ...post,
      publishedAt: post.publishedAt || post.createdAt,
      tags: post.tags.map((tag) => ({
        ...tag,
        id: `${post.id}_${tag.slug}`,
      })),
    }))
  } else {
    initialError = {
      code: postsResult.error?.code,
      message: postsResult.error?.message || "获取文章列表失败",
    }
    logger.error("标签详情文章列表加载失败", {
      slug,
      code: postsResult.error?.code,
    })
  }

  const fallback = (() => {
    const currentPage = 1
    const sortValue = "publishedAt" as const
    const totalPages = Math.max(1, initialPagination?.totalPages || 1)
    const pageNumbers = buildPageNumbers(currentPage, totalPages)

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

        {initialError ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <AlertCircle className="text-destructive mb-2 h-12 w-12" />
              <h3 className="text-lg font-semibold">文章加载失败</h3>
              <p className="text-muted-foreground">
                {initialError.message}
                {initialError.code ? `（错误代码：${initialError.code}）` : ""}
              </p>
              <Button asChild variant="outline" size="sm">
                <Link href={buildTagHref(slug, sortValue, currentPage)} prefetch={false}>
                  重新加载
                </Link>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link href="/blog" prefetch={false}>
                  浏览全部文章
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : initialPosts.length === 0 ? (
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
              {initialPosts.map((post, index) => (
                <BlogPostCard key={post.id} post={post} index={index} />
              ))}
            </div>

            {totalPages > 1 && initialPagination && (
              <div className="mt-12">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href={
                          initialPagination.hasPrev
                            ? buildTagHref(slug, sortValue, Math.max(1, currentPage - 1))
                            : "#"
                        }
                        aria-disabled={!initialPagination.hasPrev}
                        className={
                          !initialPagination.hasPrev ? "pointer-events-none opacity-50" : ""
                        }
                        tabIndex={initialPagination.hasPrev ? undefined : -1}
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
                        href={initialPagination.hasNext ? buildTagHref(slug, sortValue, 2) : "#"}
                        aria-disabled={!initialPagination.hasNext}
                        className={
                          !initialPagination.hasNext ? "pointer-events-none opacity-50" : ""
                        }
                        tabIndex={initialPagination.hasNext ? undefined : -1}
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
  })()

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-12">
        {/* 返回按钮 */}
        <div className="mb-8">
          <Link href="/tags" prefetch={false}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回标签云
            </Button>
          </Link>
        </div>

        {/* 标签信息头部 */}
        <div className="mb-12">
          <Card className="border-2">
            <CardContent className="p-8">
              <div className="flex flex-col items-center text-center md:flex-row md:text-left">
                {/* 标签图标 */}
                <div
                  className="mb-4 rounded-full p-6 md:mb-0 md:mr-6"
                  style={{
                    backgroundColor: tag.color ? `${tag.color}20` : "#3B82F620",
                  }}
                >
                  <Hash
                    className="h-12 w-12"
                    style={{
                      color: tag.color || "#3B82F6",
                    }}
                  />
                </div>

                {/* 标签信息 */}
                <div className="flex-1">
                  <div className="mb-2 flex flex-wrap items-center justify-center gap-2 md:justify-start">
                    <h1 className="text-3xl font-bold">{tag.name}</h1>
                    <Badge variant="secondary" className="text-sm">
                      <FileText className="mr-1 h-3 w-3" />
                      {tag.postsCount} 篇文章
                    </Badge>
                  </div>

                  {tag.description && (
                    <p className="text-muted-foreground mt-2 text-lg">{tag.description}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Suspense fallback={fallback}>
          <TagPostsClient
            slug={slug}
            initialPosts={initialPosts}
            initialPagination={initialPagination}
            initialError={initialError}
          />
        </Suspense>
      </div>
    </div>
  )
}
