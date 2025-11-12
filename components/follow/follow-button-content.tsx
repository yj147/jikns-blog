/**
 * FollowButton 内容组件
 * 负责渲染按钮的图标和文本
 */

import { UserPlus, UserMinus, Loader2 } from "lucide-react"

interface FollowButtonContentProps {
  isFollowing: boolean
  isLoading: boolean
  iconOnly: boolean
}

export function FollowButtonContent({
  isFollowing,
  isLoading,
  iconOnly,
}: FollowButtonContentProps) {
  if (isLoading) {
    return (
      <>
        <Loader2 className="h-4 w-4 animate-spin" />
        {!iconOnly && (isFollowing ? "关注中..." : "取消关注中...")}
      </>
    )
  }

  if (isFollowing) {
    return (
      <>
        <UserMinus className="h-4 w-4" />
        {!iconOnly && "已关注"}
      </>
    )
  }

  return (
    <>
      <UserPlus className="h-4 w-4" />
      {!iconOnly && "关注"}
    </>
  )
}
