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

const PAGE_SIZE = 10
const REPLY_PAGE_SIZE = 20

export interface Comment {
  id: string
  content: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  isDeleted: boolean
  authorId: string
  postId?: string | null
  activityId?: string | null
  author: {
    id: string
    name: string | null
    email: string
    avatarUrl: string | null
    role: "USER" | "ADMIN"
  } | null
  targetType: "post" | "activity"
  targetId: string
  parentId?: string | null
  replies?: Comment[]
  _count?: {
    replies: number
  }
  childrenCount?: number
  canDelete?: boolean
}

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
}

type ReplyCache = Record<string, ReplyState>

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

  return {
    replyCache,
    loadReplies,
    toggleReplies,
    isShowing,
    resetAll,
    invalidate,
  }
}

const CommentList: React.FC<CommentListProps> = ({
  targetType,
  targetId,
  className = "",
  onCommentDeleted,
  onCommentAdded,
  showComposer = true,
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
          replies={replyCache[comment.id]?.data ?? []}
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

function CommentItem({
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
            src={
              getOptimizedImageUrl(comment.author?.avatarUrl, {
                width: 96,
                height: 96,
                format: "webp",
              }) ?? comment.author?.avatarUrl ?? "/placeholder.svg"
            }
            alt={comment.author?.name || comment.author?.email || "用户"}
            fill
            sizes="40px"
            className="object-cover"
            loading="lazy"
            quality={70}
          />
        </div>

        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="font-medium">
                {comment.author?.name || comment.author?.email || "匿名用户"}
              </span>
              <span className="text-sm text-gray-500">
                {formatDistanceToNow(new Date(comment.createdAt), {
                  locale: zhCN,
                  addSuffix: true,
                })}
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
                    replies={[]}
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
}
