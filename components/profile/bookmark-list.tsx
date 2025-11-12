"use client"

import { useState, useTransition } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import { Bookmark, BookmarkCheck, Calendar, ChevronRight, Loader2 } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { format } from "date-fns"
import { zhCN } from "date-fns/locale"
import type { BookmarkListItem } from "@/lib/interactions/bookmarks"
import { fetchGet, fetchJson, FetchError } from "@/lib/api/fetch-json"
import { getOptimizedImageUrl } from "@/lib/images/optimizer"

interface BookmarkListProps {
  userId: string
  initialBookmarks: BookmarkListItem[]
  initialHasMore: boolean
  initialCursor: string | null
}

export function BookmarkList({
  userId,
  initialBookmarks,
  initialHasMore,
  initialCursor,
}: BookmarkListProps) {
  const [bookmarks, setBookmarks] = useState<BookmarkListItem[]>(initialBookmarks)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [cursor, setCursor] = useState(initialCursor)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  // 加载更多
  const handleLoadMore = async () => {
    if (!cursor || isLoadingMore) return

    setIsLoadingMore(true)
    try {
      const payload = await fetchGet("/api/bookmarks", {
        action: "list",
        userId,
        cursor,
        limit: 20,
      })

      // 包裹兼容策略：支持 { data, meta } 和直接返回数组两种格式
      const list = payload?.data ?? payload
      const pg = payload?.meta?.pagination ?? payload?.pagination

      if (Array.isArray(list)) {
        setBookmarks((prev) => [...prev, ...list])
        setHasMore(pg?.hasMore ?? false)
        setCursor(pg?.nextCursor ?? null)
      } else {
        // 错误提示优先级：payload.error?.message → payload.message → 固定兜底
        const errorMessage = payload?.error?.message || payload?.message || "无法加载更多收藏"

        toast({
          title: "加载失败",
          description: errorMessage,
          variant: "destructive",
        })
      }
    } catch (error) {
      if (error instanceof FetchError && error.statusCode === 401) {
        toast({
          title: "请先登录",
          description: "您需要登录才能查看收藏列表",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "加载失败",
        description: "无法加载更多收藏，请稍后重试",
        variant: "destructive",
      })
    } finally {
      setIsLoadingMore(false)
    }
  }

  // 取消收藏（乐观更新）
  const handleUnbookmark = async (postId: string, index: number) => {
    // 保存原始状态用于回滚
    const originalBookmarks = [...bookmarks]

    // 乐观更新：立即从列表中移除
    startTransition(() => {
      setBookmarks((prev) => prev.filter((_, i) => i !== index))
    })

    try {
      const payload = await fetchJson("/api/bookmarks", {
        method: "DELETE",
        body: JSON.stringify({ postId }),
      })
      const success = payload?.success !== false
      const data = payload?.data ?? payload

      if (success && data && !data.isBookmarked) {
        toast({
          title: "已取消收藏",
          description: "该文章已从您的收藏列表中移除",
        })
      } else {
        // 如果后端返回仍然是收藏状态，回滚
        setBookmarks(originalBookmarks)
      }
    } catch (error) {
      if (error instanceof FetchError && error.statusCode === 401) {
        toast({
          title: "请先登录",
          description: "您需要登录才能取消收藏",
          variant: "destructive",
        })
        setBookmarks(originalBookmarks)
        return
      }

      // 失败时回滚
      setBookmarks(originalBookmarks)
      toast({
        title: "操作失败",
        description: "无法取消收藏，请稍后重试",
        variant: "destructive",
      })
    }
  }

  // 空态
  if (bookmarks.length === 0 && !isLoadingMore) {
    return (
      <Card>
        <CardContent className="pb-12 pt-12 text-center">
          <Bookmark className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <h3 className="mb-2 text-lg font-semibold">还没有收藏的文章</h3>
          <p className="text-muted-foreground mb-4">您收藏的文章会在这里显示</p>
          <Button asChild>
            <Link href="/blog">
              探索文章 <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* 收藏列表 */}
      {bookmarks.map((bookmark, index) => (
        <Card
          key={bookmark.id}
          className="transition-all hover:shadow-md"
          data-testid="bookmark-item"
          style={{
            opacity: isPending ? 0.8 : 1,
          }}
        >
          <CardContent className="p-6">
            <div className="flex items-start space-x-4">
              {/* 封面图 */}
              {bookmark.post.coverImage && (
                <div className="flex-shrink-0">
                  <Link href={`/blog/${bookmark.post.slug}`}>
                    <Image
                      src={
                        getOptimizedImageUrl(bookmark.post.coverImage, {
                          width: 256,
                          height: 256,
                          quality: 70,
                          format: "webp",
                        }) ?? bookmark.post.coverImage
                      }
                      alt={bookmark.post.title}
                      width={96}
                      height={96}
                      className="h-24 w-24 rounded-lg object-cover transition-opacity hover:opacity-90"
                      sizes="96px"
                      loading={index === 0 ? "eager" : "lazy"}
                      priority={index === 0}
                    />
                  </Link>
                </div>
              )}

              {/* 内容区域 */}
              <div className="min-w-0 flex-1">
                {/* 标题 */}
                <h3 className="mb-2 text-lg font-semibold">
                  <Link
                    href={`/blog/${bookmark.post.slug}`}
                    className="hover:text-primary line-clamp-2 transition-colors"
                  >
                    {bookmark.post.title}
                  </Link>
                </h3>

                {/* 作者和时间信息 */}
                <div className="text-muted-foreground mb-3 flex items-center space-x-4 text-sm">
                  {/* 作者 */}
                  <div className="flex items-center space-x-2">
                    <Avatar className="h-5 w-5">
                      <AvatarImage
                        src={bookmark.post.author.avatarUrl || "/placeholder.svg"}
                        alt={bookmark.post.author.name || "作者"}
                      />
                      <AvatarFallback className="text-xs">
                        {(bookmark.post.author.name || "U")[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span>{bookmark.post.author.name || "匿名用户"}</span>
                  </div>

                  {/* 收藏时间 */}
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>
                      收藏于{" "}
                      {format(new Date(bookmark.createdAt), "MM月dd日", {
                        locale: zhCN,
                      })}
                    </span>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUnbookmark(bookmark.post.id, index)}
                    disabled={isPending}
                    data-testid="remove-bookmark"
                  >
                    <BookmarkCheck className="mr-1 h-3.5 w-3.5" />
                    取消收藏
                  </Button>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/blog/${bookmark.post.slug}`}>
                      阅读文章 <ChevronRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* 加载更多按钮 */}
      {hasMore && (
        <div className="pt-4 text-center">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="min-w-[120px]"
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                加载中...
              </>
            ) : (
              "加载更多"
            )}
          </Button>
        </div>
      )}

      {/* 加载骨架屏 */}
      {isLoadingMore && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={`skeleton-${i}`}>
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <Skeleton className="h-24 w-24 flex-shrink-0 rounded-lg" />
                  <div className="flex-1 space-y-3">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-8 w-24" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
