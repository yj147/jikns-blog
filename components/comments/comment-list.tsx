"use client"

import React, { useCallback, useState } from "react"

import CommentItem from "@/components/comments/comment-item"
import {
  useCommentsData,
  type CommentsApiResponse,
} from "@/components/comments/hooks/use-comments-data"
import { useReplyManager } from "@/components/comments/hooks/use-reply-manager"
import CommentForm, { CommentFormSuccessContext } from "@/components/comments/comment-form"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import { useRealtimeComments } from "@/hooks/use-realtime-comments"
import { toast } from "@/hooks/use-toast"
import { fetchDelete, FetchError } from "@/lib/api/fetch-json"
import type { Comment as CommentModel, CommentTargetType } from "@/types/comments"
import { bumpActivityCounts } from "@/lib/activities/cache-update"

export type Comment = CommentModel

const EMPTY_REPLIES: Comment[] = []

export interface CommentListProps {
  targetType: CommentTargetType
  targetId: string
  className?: string
  onCommentDeleted?: () => void
  onCommentAdded?: () => void
  showComposer?: boolean
  showTitle?: boolean
  initialCount?: number
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
    comments,
    totalComments,
    hasMore,
    isInitialLoading,
    isLoadingMore,
    isEmpty,
    error,
    mutate,
    loadMore,
    resetList,
  } = useCommentsData({ targetType, targetId, initialCount })

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

  const hydrateAuthor = useCallback(
    (incoming: Comment): Comment => {
      if (incoming.author) return incoming
      if (user && incoming.authorId === user.id) {
        return {
          ...incoming,
          author: {
            id: user.id,
            name: user.name ?? user.email ?? "当前用户",
            avatarUrl: user.avatarUrl ?? null,
          },
        }
      }
      return incoming
    },
    [user]
  )

  const bumpPaginationTotal = useCallback(
    (page: CommentsApiResponse | null | undefined, delta: number) => {
      if (!page?.meta?.pagination || typeof page.meta.pagination.total !== "number") {
        return page
      }
      return {
        ...page,
        meta: {
          ...page.meta,
          pagination: {
            ...page.meta.pagination,
            total: Math.max(0, page.meta.pagination.total + delta),
          },
        },
      }
    },
    []
  )

  const bumpTotal = useCallback(
    (delta: number) => {
      mutate((currentPages) => {
        if (!currentPages) {
          return currentPages
        }
        const safePages = currentPages.filter((page): page is CommentsApiResponse => Boolean(page))
        return safePages.map((page, index) => {
          if (index !== 0) return page
          const next = bumpPaginationTotal(page, delta)
          return next ?? page
        })
      }, false)

      // 同步动态列表的 commentsCount，避免计数回退
      if (targetType === "activity") {
        bumpActivityCounts(targetId, { comments: delta })
      }
    },
    [mutate, bumpPaginationTotal, targetType, targetId]
  )

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
        bumpTotal(-1)
        toast({ title: "删除成功" })
      } catch (err) {
        const message = err instanceof FetchError ? err.message : "删除失败，请稍后重试"
        toast({ title: message, variant: "destructive" })
      }
    },
    [user, resetList, resetReplies, onCommentDeleted, bumpTotal]
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

      bumpTotal(1)
      setReplyingTo(null)
      onCommentAdded?.()
    },
    [
      resetList,
      invalidate,
      isShowing,
      loadRepliesForComment,
      resetReplies,
      onCommentAdded,
      bumpTotal,
    ]
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

        const exists = currentPages.some((page) =>
          page?.data?.some((comment) => comment.id === incoming.id)
        )
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
              ...bumpPaginationTotal(page, 1),
              success: true,
              data: [incoming, ...(page.data ?? [])],
            }
          }
          return page
        })

        return updated ? nextPages : currentPages
      }, false)
    },
    [mutate, bumpPaginationTotal]
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
              ...bumpPaginationTotal(page, -1),
              success: true,
              data: filtered,
            }
          }
          return page
        })

        return removed ? nextPages : currentPages
      }, false)
    },
    [mutate, bumpPaginationTotal]
  )

  const handleRealtimeInsert = useCallback(
    (incoming: Comment) => {
      const withAuthor = hydrateAuthor(incoming)

      if (incoming.parentId) {
        prependReply(incoming.parentId, withAuthor)
        bumpTotal(1)
        if (!withAuthor.author) {
          void loadRepliesForComment(incoming.parentId, { append: false })
        }
        return
      }

      addTopLevelComment(withAuthor)
      bumpTotal(1)
      if (!withAuthor.author) {
        void mutate(undefined, true)
      }
    },
    [addTopLevelComment, prependReply, bumpTotal, hydrateAuthor, loadRepliesForComment, mutate]
  )

  const handleRealtimeDelete = useCallback(
    (commentId: string) => {
      removeTopLevelComment(commentId)
      removeReply(commentId)
      bumpTotal(-1)
    },
    [removeReply, removeTopLevelComment, bumpTotal]
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
        <p className="text-status-error text-sm">加载评论失败，请稍后重试。</p>
        <Button variant="outline" size="sm" className="mt-2" onClick={() => mutate()}>
          重试
        </Button>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {showTitle && <h2 className="mb-6 text-2xl font-bold">评论 ({totalComments})</h2>}

      {isEmpty && <p className="text-muted-foreground text-sm">暂无评论，快来抢沙发吧！</p>}

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
