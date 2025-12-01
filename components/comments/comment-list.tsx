"use client"

import React, { useState, useCallback, useMemo, useEffect, useRef } from "react"
import useSWRInfinite from "swr/infinite"
import { fetchGet, fetchDelete, FetchError } from "@/lib/api/fetch-json"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import Image from "next/image"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import { Trash2, MessageCircle } from "lucide-react"
import CommentForm, { CommentFormSuccessContext } from "./comment-form"
import { getOptimizedImageUrl } from "@/lib/images/optimizer"
import { useRealtimeComments } from "@/hooks/use-realtime-comments"
import type { Comment as CommentModel } from "@/types/comments"

const PAGE_SIZE = 10
const REPLY_PAGE_SIZE = 20

export type Comment = CommentModel

type CommentsApiResponse = {
  success: boolean
  data: Comment[]
  meta?: {
    pagination?: {
      total?: number
      hasMore?: boolean
      nextCursor?: string | null
    }
  }
}

type ReplyState = {
  data: Comment[]
  loading: boolean
  error: string | null
  hasMore: boolean
  nextCursor: string | null
}

export interface CommentListProps {
  targetType: "post" | "activity"
  targetId: string
  className?: string
  onCommentDeleted?: () => void
  onCommentAdded?: () => void
  showComposer?: boolean
  showTitle?: boolean
  initialCount?: number
}

type ReplyCache = Record<string, ReplyState>

const EMPTY_REPLIES: Comment[] = []

function useReplyManager(targetType: CommentListProps["targetType"], targetId: string) {
  const [replyCache, setReplyCache] = useState<ReplyCache>({})
  const [openReplies, setOpenReplies] = useState<Set<string>>(new Set())
  const cacheRef = useRef(replyCache)

  useEffect(() => {
    cacheRef.current = replyCache
  }, [replyCache])

  const resetAll = useCallback(() => {
    setReplyCache({})
    setOpenReplies(new Set())
  }, [])

  const invalidate = useCallback((commentId: string) => {
    setReplyCache((prev) => {
      if (!prev[commentId]) {
        return prev
      }
      const next = { ...prev }
      delete next[commentId]
      return next
    })
  }, [])

  const loadReplies = useCallback(
    async (commentId: string, options?: { cursor?: string | null; append?: boolean }) => {
      const { cursor, append = false } = options ?? {}

      setReplyCache((prev) => {
        const previous = prev[commentId]
        return {
          ...prev,
          [commentId]: {
            data: previous?.data ?? [],
            loading: true,
            error: null,
            hasMore: previous?.hasMore ?? false,
            nextCursor: previous?.nextCursor ?? null,
          },
        }
      })

      try {
        const params = new URLSearchParams({
          targetType,
          targetId,
          parentId: commentId,
          limit: REPLY_PAGE_SIZE.toString(),
        })

        if (cursor) {
          params.set("cursor", cursor)
        }

        const response = (await fetchGet(
          `/api/comments?${params.toString()}`
        )) as CommentsApiResponse
        const newReplies = response.data ?? []
        const pagination = response.meta?.pagination

        setReplyCache((prev) => {
          const previous = prev[commentId]
          const base = append ? (previous?.data ?? []) : []

          return {
            ...prev,
            [commentId]: {
              data: append ? [...base, ...newReplies] : newReplies,
              loading: false,
              error: null,
              hasMore: pagination?.hasMore ?? false,
              nextCursor: pagination?.nextCursor ?? null,
            },
          }
        })
      } catch (err) {
        setReplyCache((prev) => {
          const previous = prev[commentId]
          return {
            ...prev,
            [commentId]: {
              data: previous?.data ?? [],
              loading: false,
              error: err instanceof Error ? err.message : "加载失败",
              hasMore: previous?.hasMore ?? false,
              nextCursor: previous?.nextCursor ?? null,
            },
          }
        })
      }
    },
    [targetType, targetId]
  )

  const isShowing = useCallback((commentId: string) => openReplies.has(commentId), [openReplies])

  const toggleReplies = useCallback(
    (comment: Comment) => {
      let opened = false
      setOpenReplies((prev) => {
        const next = new Set(prev)
        if (next.has(comment.id)) {
          next.delete(comment.id)
        } else {
          next.add(comment.id)
          opened = true
        }
        return next
      })

      if (opened) {
        const state = cacheRef.current[comment.id]
        const shouldFetch = !state || state.data.length === 0 || !!state.error
        if (shouldFetch) {
          void loadReplies(comment.id)
        }
      }
    },
    [loadReplies]
  )

  // 当展开集合变更时，确保已展开的评论会自动加载/补齐回复（避免某些环境下事件未触发导致不请求）
  useEffect(() => {
    openReplies.forEach((commentId) => {
      const state = cacheRef.current[commentId]
      const shouldFetch = !state || state.data.length === 0 || !!state.error
      if (shouldFetch) {
        void loadReplies(commentId)
      }
    })
  }, [openReplies, loadReplies])

  const prependReply = useCallback((parentId: string, reply: Comment) => {
    setReplyCache((prev) => {
      const existing = prev[parentId]
      if (existing?.data?.some((item) => item.id === reply.id)) {
        return prev
      }

      const nextState: ReplyState = existing
        ? {
            ...existing,
            data: [reply, ...existing.data],
            loading: false,
            error: null,
          }
        : {
            data: [reply],
            loading: false,
            error: null,
            hasMore: false,
            nextCursor: null,
          }

      return {
        ...prev,
        [parentId]: nextState,
      }
    })
  }, [])

  const removeReply = useCallback((replyId: string) => {
    setReplyCache((prev) => {
      let changed = false
      const next: ReplyCache = {}

      Object.entries(prev).forEach(([key, state]) => {
        if (!state) {
          return
        }

        const filtered = state.data.filter((reply) => reply.id !== replyId)
        if (filtered.length !== state.data.length) {
          changed = true
          next[key] = {
            ...state,
            data: filtered,
          }
        } else {
          next[key] = state
        }
      })

      return changed ? next : prev
    })
  }, [])

  return {
    replyCache,
    loadReplies,
    toggleReplies,
    isShowing,
    resetAll,
    invalidate,
    prependReply,
    removeReply,
  }
}

const CommentList: React.FC<CommentListProps> = ({
  targetType,
  targetId,
  className = "",
  onCommentDeleted,
  onCommentAdded,
  showComposer = true,
  showTitle = false,
  initialCount = 0,
}) => {
  const { user } = useAuth()
  const [replyingTo, setReplyingTo] = useState<string | null>(null)

  const {
    replyCache,
    loadReplies: loadRepliesForComment,
    toggleReplies,
    isShowing,
    resetAll: resetReplies,
    invalidate,
    prependReply,
    removeReply,
  } = useReplyManager(targetType, targetId)

  const fetcher = useCallback(async (url: string) => fetchGet(url), [])

  const getKey = useCallback(
    (pageIndex: number, previousPageData: CommentsApiResponse | null) => {
      if (previousPageData && !previousPageData.meta?.pagination?.hasMore) {
        return null
      }

      const params = new URLSearchParams({
        targetType,
        targetId,
        limit: PAGE_SIZE.toString(),
      })

      const cursor = previousPageData?.meta?.pagination?.nextCursor
      if (cursor) {
        params.set("cursor", cursor)
      }

      return `/api/comments?${params.toString()}`
    },
    [targetType, targetId]
  )

  const { data, error, isLoading, isValidating, size, setSize, mutate } =
    useSWRInfinite<CommentsApiResponse>(getKey, fetcher, {
      revalidateOnFocus: false,
      revalidateAll: false,
    })

  const pages = data ?? []
  const comments = useMemo(() => pages.flatMap((page) => page?.data ?? []), [pages])

  // 计算当前评论总数（用于标题显示）
  const totalComments = useMemo(() => {
    const total = pages[0]?.meta?.pagination?.total

    if (typeof total === "number") {
      return total
    }

    if (comments.length > 0) {
      return comments.length
    }

    return initialCount
  }, [comments.length, pages, initialCount])

  const hasMore = useMemo(() => {
    if (pages.length === 0) return false
    return pages[pages.length - 1]?.meta?.pagination?.hasMore ?? false
  }, [pages])

  const isInitialLoading = !data && !error
  const isLoadingMore = isValidating && size > (data?.length ?? 0)
  const isEmpty = !isInitialLoading && comments.length === 0

  const resetList = useCallback(
    async (preserveSize = false) => {
      if (!preserveSize) {
        await setSize(1)
      }
      await mutate()
    },
    [mutate, setSize]
  )

  const loadMore = useCallback(() => {
    if (hasMore && !isLoadingMore) {
      setSize((current) => current + 1)
    }
  }, [hasMore, isLoadingMore, setSize])

  const handleDelete = useCallback(
    async (commentId: string) => {
      if (!user) {
        toast({
          title: "请先登录",
          variant: "destructive",
        })
        return
      }

      try {
        await fetchDelete(`/api/comments/${commentId}`)
        await resetList()
        resetReplies()
        onCommentDeleted?.()
        toast({ title: "删除成功" })
      } catch (err) {
        const message = err instanceof FetchError ? err.message : "删除失败，请稍后重试"
        toast({ title: message, variant: "destructive" })
      }
    },
    [user, resetList, resetReplies, onCommentDeleted]
  )

  const handleCommentAdded = useCallback(
    async (context?: CommentFormSuccessContext) => {
      const parentId = context?.parentId ?? null

      if (parentId) {
        await resetList(true)
        invalidate(parentId)

        if (isShowing(parentId)) {
          await loadRepliesForComment(parentId)
        }
      } else {
        await resetList()
        resetReplies()
      }

      setReplyingTo(null)
      onCommentAdded?.()
    },
    [resetList, invalidate, isShowing, loadRepliesForComment, resetReplies, onCommentAdded]
  )

  const handleReplyToggle = useCallback(
    (comment: Comment) => {
      toggleReplies(comment)
    },
    [toggleReplies]
  )

  const handleReplyClick = useCallback((commentId: string) => {
    setReplyingTo((current) => (current === commentId ? null : commentId))
  }, [])

  const handleReplyCancel = useCallback(() => {
    setReplyingTo(null)
  }, [])

  const handleLoadReplies = useCallback(
    (comment: Comment, options?: { cursor?: string | null; append?: boolean }) => {
      return loadRepliesForComment(comment.id, {
        cursor: options?.cursor ?? undefined,
        append: options?.append ?? false,
      })
    },
    [loadRepliesForComment]
  )

  const addTopLevelComment = useCallback(
    (incoming: Comment) => {
      mutate((currentPages) => {
        if (!currentPages || currentPages.length === 0) {
          return [
            {
              success: true,
              data: [incoming],
              meta: {
                pagination: {
                  total: 1,
                  hasMore: false,
                  nextCursor: null,
                },
              },
            },
          ]
        }

        const exists = currentPages.some((page) => page?.data?.some((comment) => comment.id === incoming.id))
        if (exists) {
          return currentPages
        }

        let updated = false
        const nextPages = currentPages.map((page, index) => {
          if (!page?.data) {
            return page
          }
          if (index === 0) {
            updated = true
            return {
              ...page,
              data: [incoming, ...page.data],
            }
          }
          return page
        })

        return updated ? nextPages : currentPages
      }, false)
    },
    [mutate]
  )

  const removeTopLevelComment = useCallback(
    (commentId: string) => {
      mutate((currentPages) => {
        if (!currentPages) {
          return currentPages
        }

        let removed = false
        const nextPages = currentPages.map((page) => {
          if (!page?.data) {
            return page
          }
          const filtered = page.data.filter((comment) => comment.id !== commentId)
          if (filtered.length !== page.data.length) {
            removed = true
            return {
              ...page,
              data: filtered,
            }
          }
          return page
        })

        return removed ? nextPages : currentPages
      }, false)
    },
    [mutate]
  )

  const handleRealtimeInsert = useCallback(
    (incoming: Comment) => {
      if (incoming.parentId) {
        prependReply(incoming.parentId, incoming)
        return
      }

      addTopLevelComment(incoming)
    },
    [addTopLevelComment, prependReply]
  )

  const handleRealtimeDelete = useCallback(
    (commentId: string) => {
      removeTopLevelComment(commentId)
      removeReply(commentId)
    },
    [removeReply, removeTopLevelComment]
  )

  const { isSubscribed: isCommentsSubscribed, error: commentsRealtimeError } = useRealtimeComments({
    targetType,
    targetId,
    enabled: Boolean(targetId),
    onInsert: handleRealtimeInsert,
    onDelete: handleRealtimeDelete,
  })

  if (isInitialLoading) {
    return (
      <div className={`space-y-4 ${className}`} data-testid="loading-skeleton">
        <div className="animate-pulse">
          <div className="mb-4 h-20 rounded bg-gray-200" />
          <div className="mb-4 h-16 rounded bg-gray-200" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={className} data-testid="error-state">
        <p className="text-sm text-red-500">加载评论失败，请稍后重试。</p>
        <Button variant="outline" size="sm" className="mt-2" onClick={() => mutate()}>
          重试
        </Button>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {showTitle && (
        <h2 className="mb-6 text-2xl font-bold">评论 ({totalComments})</h2>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <span>
          实时评论：
          <span className={isCommentsSubscribed ? "text-emerald-600" : "text-amber-600"}>
            {isCommentsSubscribed ? "已连接" : "连接中..."}
          </span>
        </span>
        {commentsRealtimeError && (
          <span className="text-red-500">
            订阅失败：{commentsRealtimeError.message || "请稍后重试"}
          </span>
        )}
      </div>

      {isEmpty && <p className="text-sm text-gray-500">暂无评论，快来抢沙发吧！</p>}

      {comments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          currentUserId={user?.id}
          currentUserRole={user?.role}
          onDelete={handleDelete}
          onReplyClick={handleReplyClick}
          onReplyCancel={handleReplyCancel}
          isReplying={replyingTo === comment.id}
          replyState={replyCache[comment.id]}
          replies={replyCache[comment.id]?.data ?? EMPTY_REPLIES}
          isRepliesOpen={isShowing(comment.id)}
          onToggleReplies={handleReplyToggle}
          onLoadReplies={handleLoadReplies}
          targetType={targetType}
          targetId={targetId}
          onCommentAdded={handleCommentAdded}
        />
      ))}

      {hasMore && (
        <div className="mt-6 flex justify-center">
          <Button onClick={loadMore} disabled={isLoadingMore} variant="outline">
            {isLoadingMore ? "加载中..." : "加载更多"}
          </Button>
        </div>
      )}

      {showComposer && (
        <div className="pt-4">
          <CommentForm targetType={targetType} targetId={targetId} onSuccess={handleCommentAdded} />
        </div>
      )}
    </div>
  )
}

export default CommentList

interface CommentItemProps {
  comment: Comment
  isReply?: boolean
  currentUserId?: string
  currentUserRole?: string
  onDelete: (commentId: string) => void
  onReplyClick: (commentId: string) => void
  onReplyCancel: () => void
  isReplying: boolean
  replyState?: ReplyState
  replies: Comment[]
  isRepliesOpen: boolean
  onToggleReplies: (comment: Comment) => void
  onLoadReplies: (comment: Comment, options?: { cursor?: string | null; append?: boolean }) => void
  targetType: CommentListProps["targetType"]
  targetId: string
  onCommentAdded: (context?: CommentFormSuccessContext) => void
}

// 使用 React.memo 将展开/收起的重渲染限制在当前评论，避免大列表阻塞交互
const CommentItem = React.memo(function CommentItem({
  comment,
  isReply = false,
  currentUserId,
  currentUserRole,
  onDelete,
  onReplyClick,
  onReplyCancel,
  isReplying,
  replyState,
  replies,
  isRepliesOpen,
  onToggleReplies,
  onLoadReplies,
  targetType,
  targetId,
  onCommentAdded,
}: CommentItemProps) {
  // 缓存头像地址和时间文案，避免列表滚动时反复计算
  const avatarUrl = useMemo(
    () =>
      getOptimizedImageUrl(comment.author?.avatarUrl, {
        width: 96,
        height: 96,
        format: "webp",
      }) ?? comment.author?.avatarUrl ?? "/placeholder.svg",
    [comment.author?.avatarUrl]
  )
  // dicebear 返回 SVG，Next Image 优化器不支持，必须跳过以避免 400
  const shouldUnoptimizeAvatar = useMemo(
    () => avatarUrl.includes("api.dicebear.com") || /\.svg(\?|$)/i.test(avatarUrl),
    [avatarUrl]
  )

  const formattedDate = useMemo(
    () =>
      formatDistanceToNow(new Date(comment.createdAt), {
        locale: zhCN,
        addSuffix: true,
      }),
    [comment.createdAt]
  )

  const isAuthor = currentUserId === comment.authorId
  const isAdmin = currentUserRole === "ADMIN"
  const allowDelete = (comment.canDelete ?? false) || isAuthor || isAdmin
  const isDeleted = comment.isDeleted
  const totalReplies = Math.max(comment._count?.replies ?? 0, replies.length)
  const shouldShowToggle =
    !isReply && (totalReplies > 0 || (replyState?.hasMore ?? false) || replies.length > 0)

  return (
    <div className={`${isReply ? "ml-12" : ""} py-4 ${!isReply ? "border-b" : ""}`}>
      <div className="flex items-start space-x-3">
        <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-gray-200">
          <Image
            src={avatarUrl}
            alt={comment.author?.name || comment.author?.email || "用户"}
            fill
            sizes="40px"
            className="object-cover"
            loading="lazy"
            quality={70}
            unoptimized={shouldUnoptimizeAvatar}
          />
        </div>

        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="font-medium">
                {comment.author?.name || comment.author?.email || "匿名用户"}
              </span>
              <span className="text-sm text-gray-500">
                {formattedDate}
              </span>
            </div>

            {allowDelete && !isDeleted && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(comment.id)}
                className="text-red-500 hover:text-red-600"
                aria-label="删除"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          <p
            className={`mt-2 whitespace-pre-wrap ${
              isDeleted ? "italic text-gray-400" : "text-gray-700"
            }`}
          >
            {comment.content}
          </p>

          <div className="mt-3 flex items-center space-x-4">
            {!isReply && !isDeleted && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onReplyClick(comment.id)}
                className="text-gray-500 hover:text-gray-700"
              >
                <MessageCircle className="mr-1 h-4 w-4" />
                回复
              </Button>
            )}

            {shouldShowToggle && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggleReplies(comment)}
                className="text-gray-500 hover:text-gray-700"
              >
                {isRepliesOpen ? "收起" : "展开"} {totalReplies} 条回复
              </Button>
            )}
          </div>

          {isReplying && (
            <div className="mt-4">
              <CommentForm
                targetType={targetType}
                targetId={targetId}
                parentId={comment.id}
                onSuccess={onCommentAdded}
                onCancel={onReplyCancel}
                placeholder={`回复 ${comment.author?.name || comment.author?.email || "匿名用户"}...`}
              />
            </div>
          )}

          {isRepliesOpen && !isReply && (
            <div className="mt-4 space-y-2">
              {replyState?.loading && <p className="text-sm text-gray-500">回复加载中...</p>}
              {replyState?.error && (
                <div className="flex items-center justify-between text-sm text-red-500">
                  <span>{replyState.error}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onLoadReplies(comment)}
                    className="text-red-500 hover:text-red-600"
                  >
                    重试
                  </Button>
                </div>
              )}
              {replies.length > 0 &&
                replies.map((reply) => (
                  <CommentItem
                    key={reply.id}
                    comment={reply}
                    isReply
                    currentUserId={currentUserId}
                    currentUserRole={currentUserRole}
                    onDelete={onDelete}
                    onReplyClick={onReplyClick}
                    onReplyCancel={onReplyCancel}
                    isReplying={false}
                    replies={EMPTY_REPLIES}
                    isRepliesOpen={false}
                    onToggleReplies={onToggleReplies}
                    onLoadReplies={onLoadReplies}
                    targetType={targetType}
                    targetId={targetId}
                    onCommentAdded={onCommentAdded}
                  />
                ))}
              {replyState?.hasMore && !replyState.loading && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-500 hover:text-gray-700"
                  onClick={() =>
                    onLoadReplies(comment, {
                      cursor: replyState.nextCursor ?? null,
                      append: true,
                    })
                  }
                >
                  加载更多回复
                </Button>
              )}
              {replyState && !replyState.loading && replies.length === 0 && (
                <p className="text-sm text-gray-500">暂无回复</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}, areCommentsEqual)

// 谨慎比对关键字段，避免不必要重渲染同时确保状态更新可见
function areCommentsEqual(prevProps: CommentItemProps, nextProps: CommentItemProps) {
  if (prevProps.comment.id !== nextProps.comment.id) return false
  if (prevProps.comment.updatedAt !== nextProps.comment.updatedAt) return false
  if (prevProps.comment.content !== nextProps.comment.content) return false
  if (prevProps.comment.isDeleted !== nextProps.comment.isDeleted) return false
  if ((prevProps.comment.canDelete ?? false) !== (nextProps.comment.canDelete ?? false)) return false
  if ((prevProps.comment._count?.replies ?? 0) !== (nextProps.comment._count?.replies ?? 0))
    return false
  if (prevProps.comment.author?.avatarUrl !== nextProps.comment.author?.avatarUrl) return false
  if (prevProps.comment.author?.name !== nextProps.comment.author?.name) return false
  if (prevProps.comment.author?.email !== nextProps.comment.author?.email) return false
  if (prevProps.comment.createdAt !== nextProps.comment.createdAt) return false

  if (prevProps.isReply !== nextProps.isReply) return false
  if (prevProps.isReplying !== nextProps.isReplying) return false
  if (prevProps.isRepliesOpen !== nextProps.isRepliesOpen) return false
  if (prevProps.currentUserId !== nextProps.currentUserId) return false
  if (prevProps.currentUserRole !== nextProps.currentUserRole) return false

  if (prevProps.replies !== nextProps.replies) return false

  const prevState = prevProps.replyState
  const nextState = nextProps.replyState
  if ((prevState?.loading ?? false) !== (nextState?.loading ?? false)) return false
  if ((prevState?.error ?? null) !== (nextState?.error ?? null)) return false
  if ((prevState?.hasMore ?? false) !== (nextState?.hasMore ?? false)) return false
  if ((prevState?.nextCursor ?? null) !== (nextState?.nextCursor ?? null)) return false

  return true
}
