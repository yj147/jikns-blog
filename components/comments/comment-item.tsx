"use client"

import React, { useMemo } from "react"
import Image from "next/image"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import { MessageCircle, Trash2 } from "lucide-react"

import CommentForm, { CommentFormSuccessContext } from "@/components/comments/comment-form"
import type { ReplyState } from "@/components/comments/hooks/use-reply-manager"
import { Button } from "@/components/ui/button"
import { getOptimizedImageUrl } from "@/lib/images/optimizer"
import type { Comment, CommentTargetType } from "@/types/comments"

const EMPTY_REPLIES: Comment[] = []

export interface CommentItemProps {
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
  targetType: CommentTargetType
  targetId: string
  onCommentAdded: (context?: CommentFormSuccessContext) => void
}

const CommentItemComponent = function CommentItem({
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
  const avatarUrl = useMemo(
    () =>
      getOptimizedImageUrl(comment.author?.avatarUrl, {
        width: 96,
        height: 96,
        format: "webp",
      }) ??
      comment.author?.avatarUrl ??
      "/placeholder.svg",
    [comment.author?.avatarUrl]
  )

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
  const displayName = comment.author?.name || "匿名用户"

  return (
    <div className={`${isReply ? "ml-12" : ""} py-4 ${!isReply ? "border-b" : ""}`}>
      <div className="flex items-start space-x-3">
        <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-gray-200">
          <Image
            src={avatarUrl}
            alt={displayName}
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
              <span className="font-medium">{displayName}</span>
              <span className="text-sm text-gray-500" suppressHydrationWarning>
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
                placeholder={`回复 ${displayName}...`}
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
}

function areCommentsEqual(prevProps: CommentItemProps, nextProps: CommentItemProps) {
  if (prevProps.comment.id !== nextProps.comment.id) return false
  if (prevProps.comment.updatedAt !== nextProps.comment.updatedAt) return false
  if (prevProps.comment.content !== nextProps.comment.content) return false
  if (prevProps.comment.isDeleted !== nextProps.comment.isDeleted) return false
  if ((prevProps.comment.canDelete ?? false) !== (nextProps.comment.canDelete ?? false))
    return false
  if ((prevProps.comment._count?.replies ?? 0) !== (nextProps.comment._count?.replies ?? 0))
    return false
  if (prevProps.comment.author?.avatarUrl !== nextProps.comment.author?.avatarUrl) return false
  if (prevProps.comment.author?.name !== nextProps.comment.author?.name) return false
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

const CommentItem = React.memo(CommentItemComponent, areCommentsEqual)

export default CommentItem
export { areCommentsEqual }
