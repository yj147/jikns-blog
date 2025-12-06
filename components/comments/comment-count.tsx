"use client"

import { useCommentsData } from "@/components/comments/hooks/use-comments-data"
import { formatNumber } from "@/lib/utils/blog-helpers"
import type { CommentTargetType } from "@/types/comments"

interface CommentCountProps {
  targetType: CommentTargetType
  targetId: string
  initialCount?: number
  className?: string
}

/**
 * 轻量计数组件，复用 comments SWR 缓存，避免首屏静态计数滞后。
 */
export default function CommentCount({
  targetType,
  targetId,
  initialCount = 0,
  className,
}: CommentCountProps) {
  const { totalComments } = useCommentsData({ targetType, targetId, initialCount })

  return <span className={className}>{formatNumber(totalComments)}</span>
}
