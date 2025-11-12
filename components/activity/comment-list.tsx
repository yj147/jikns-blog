"use client"

/**
 * Activity 评论列表包装组件
 * 使用通用评论组件，保持原有导出和接口不变
 */

import React from "react"
import CommonCommentList from "@/components/comments/comment-list"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { MessageSquare } from "lucide-react"

interface CommentListProps {
  activityId: string
  className?: string
  onCommentAdded?: () => void
  onCommentDeleted?: () => void
  showComposer?: boolean
}

/**
 * Activity 评论列表组件
 * 内部使用通用评论组件实现，保持原有接口不变
 */
export function CommentList({
  activityId,
  className,
  onCommentAdded,
  onCommentDeleted,
  showComposer = true,
}: CommentListProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          <h3 className="font-medium">评论</h3>
        </div>
      </CardHeader>
      <CardContent>
        <CommonCommentList
          targetType="activity"
          targetId={activityId}
          onCommentAdded={onCommentAdded}
          onCommentDeleted={onCommentDeleted}
          showComposer={showComposer}
        />
      </CardContent>
    </Card>
  )
}

export default CommentList
