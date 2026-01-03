"use client"

import Link from "@/components/app-link"
import { UserPlus } from "lucide-react"
import FollowButton from "@/components/follow/follow-button"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import { useFollowStatusBatch } from "@/hooks/use-follow-list"

type ButtonSize = "default" | "sm" | "lg" | "icon"

export interface PostAuthorFollowActionProps {
  authorId: string
  authorName?: string | null
  size?: ButtonSize
  className?: string
}

export function PostAuthorFollowAction({
  authorId,
  authorName,
  size = "sm",
  className,
}: PostAuthorFollowActionProps) {
  const { user, loading } = useAuth()
  const viewerId = user?.id

  const { isFollowing, isLoading: statusLoading } = useFollowStatusBatch([authorId], viewerId)

  if (viewerId === authorId) {
    return null
  }

  if (!viewerId) {
    if (loading) {
      return (
        <Button variant="outline" size={size} className={className} disabled>
          加载中
        </Button>
      )
    }

    return (
      <Button variant="outline" size={size} className={className} asChild>
        <Link href="/login">
          <UserPlus className="mr-1 h-3 w-3" />
          登录后关注
        </Link>
      </Button>
    )
  }

  return (
    <FollowButton
      targetUserId={authorId}
      targetUserName={authorName ?? undefined}
      initialFollowing={isFollowing(authorId)}
      size={size}
      className={className}
      disabled={statusLoading}
    />
  )
}
