"use client"

import useSWRInfinite from "swr/infinite"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BookOpen, Calendar, Clock } from "lucide-react"
import { fetchJson } from "@/lib/api/fetch-json"

interface UserPostTag {
  id: string
  name: string
  slug: string
}

interface UserPostRecord {
  id: string
  title: string
  slug: string
  excerpt: string | null
  coverImage: string | null
  signedCoverImage?: string | null
  publishedAt: string | null
  viewCount: number
  readTimeMinutes: number
  tags: UserPostTag[]
  _count: {
    likes: number
    comments: number
  }
}

interface UserPostsResponse {
  success: boolean
  data: UserPostRecord[]
  pagination: {
    page: number
    limit: number
    total: number
    hasMore: boolean
  }
}

interface ProfilePostsTabProps {
  userId: string
}

const PAGE_SIZE = 5
const numberFormatter = new Intl.NumberFormat("zh-CN")

const fetcher = (url: string) => fetchJson<UserPostsResponse>(url)

function formatPublishedDate(value: string | null) {
  if (!value) {
    return "未发布"
  }

  try {
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(value))
  } catch {
    return "时间未知"
  }
}

function formatReadTime(minutes?: number) {
  const safeMinutes = Number.isFinite(minutes) && minutes ? Math.max(1, Math.round(minutes)) : 1
  return `≈${safeMinutes}分钟阅读`
}

export function ProfilePostsTab({ userId }: ProfilePostsTabProps) {
  const getKey = (pageIndex: number, previousPageData: UserPostsResponse | null) => {
    if (previousPageData && !previousPageData.pagination?.hasMore) {
      return null
    }

    const page = pageIndex + 1
    return `/api/users/${userId}/posts?page=${page}&limit=${PAGE_SIZE}`
  }

  const { data, error, isLoading, isValidating, mutate, size, setSize } = useSWRInfinite(
    getKey,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  )

  const posts = data ? data.flatMap((page) => page.data ?? []) : []
  const lastPage = data?.[data.length - 1]
  const hasMore = lastPage?.pagination?.hasMore ?? false

  const isInitialLoading = isLoading && size === 1 && posts.length === 0
  const isLoadingMore = isValidating && size > 1

  if (isInitialLoading) {
    return (
      <div className="space-y-6">
        {[...Array(3)].map((_, index) => (
          <Card key={index} className="animate-pulse">
            <CardHeader>
              <div className="bg-muted mb-2 h-4 w-24 rounded" />
              <div className="bg-muted mb-2 h-6 w-3/4 rounded" />
              <div className="bg-muted h-4 w-full rounded" />
              <div className="bg-muted mt-2 h-4 w-5/6 rounded" />
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <div className="bg-muted h-4 w-24 rounded" />
                <div className="bg-muted h-4 w-32 rounded" />
                <div className="bg-muted h-4 w-20 rounded" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <BookOpen className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <p className="text-muted-foreground mb-4">加载文章失败</p>
          <Button onClick={() => mutate()} variant="outline">
            重新加载
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (posts.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <BookOpen className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <p className="text-muted-foreground">还没有发布博客文章</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {posts.map((post) => (
        <div key={post.id} className="animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Card className="transition-shadow hover:shadow-lg">
            <CardHeader>
              {post.tags.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <Badge key={tag.id} variant="secondary" className="text-xs">
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              )}
              <CardTitle className="line-clamp-2 text-xl">
                <Link href={`/blog/${post.slug}`} className="hover:underline">
                  {post.title}
                </Link>
              </CardTitle>
              {post.excerpt && (
                <CardDescription className="line-clamp-3 text-base">{post.excerpt}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-4 text-sm">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="flex items-center">
                    <Calendar className="mr-1 h-3 w-3" />
                    {formatPublishedDate(post.publishedAt)}
                  </span>
                  <span className="flex items-center">
                    <Clock className="mr-1 h-3 w-3" />
                    {formatReadTime(post.readTimeMinutes)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <span>{numberFormatter.format(post.viewCount)} 阅读</span>
                  <span>{numberFormatter.format(post._count.likes)} 点赞</span>
                  <span>{numberFormatter.format(post._count.comments)} 评论</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ))}

      {hasMore && (
        <div className="py-4 text-center">
          <Button
            onClick={() => setSize((prev) => prev + 1)}
            disabled={isLoadingMore}
            variant="outline"
          >
            {isLoadingMore ? "加载中..." : "加载更多"}
          </Button>
        </div>
      )}
    </div>
  )
}
