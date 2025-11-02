"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useState } from "react"
import { Heart, MessageCircle, Repeat2, Share, MoreHorizontal } from "lucide-react"

interface User {
  name: string
  username: string
  avatar: string
  verified: boolean
}

interface Activity {
  id: number
  user: User
  content: string
  images: string[]
  timestamp: string
  likes: number
  comments: number
  reposts: number
  isLiked: boolean
  isReposted: boolean
}

interface ActivityCardProps {
  activity: Activity
  onLike?: (id: number) => void
  onComment?: (id: number) => void
  onRepost?: (id: number) => void
  onShare?: (id: number) => void
}

export function ActivityCard({
  activity,
  onLike,
  onComment,
  onRepost,
  onShare,
}: ActivityCardProps) {
  const [isLiked, setIsLiked] = useState(activity.isLiked)
  const [isReposted, setIsReposted] = useState(activity.isReposted)
  const [likesCount, setLikesCount] = useState(activity.likes)
  const [repostsCount, setRepostsCount] = useState(activity.reposts)

  const handleLike = () => {
    setIsLiked(!isLiked)
    setLikesCount((prev) => (isLiked ? prev - 1 : prev + 1))
    onLike?.(activity.id)
  }

  const handleRepost = () => {
    setIsReposted(!isReposted)
    setRepostsCount((prev) => (isReposted ? prev - 1 : prev + 1))
    onRepost?.(activity.id)
  }

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="pt-6">
        {/* User Info */}
        <div className="mb-4 flex items-start space-x-3">
          <Avatar className="h-10 w-10">
            <AvatarImage
              src={activity.user.avatar || "/placeholder.svg"}
              alt={activity.user.name}
            />
            <AvatarFallback>{activity.user.name[0]}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-2">
              <p className="text-sm font-semibold">{activity.user.name}</p>
              {activity.user.verified && (
                <div className="bg-primary flex h-4 w-4 items-center justify-center rounded-full">
                  <div className="h-2 w-2 rounded-full bg-white" />
                </div>
              )}
              <p className="text-muted-foreground text-sm">{activity.user.username}</p>
              <span className="text-muted-foreground text-sm">·</span>
              <p className="text-muted-foreground text-sm">{activity.timestamp}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="mb-4">
          <p className="text-foreground whitespace-pre-wrap leading-relaxed">{activity.content}</p>
        </div>

        {/* Images */}
        {activity.images.length > 0 && (
          <div
            className={`mb-4 grid gap-2 ${activity.images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}
          >
            {activity.images.map((image, index) => (
              <div key={index} className="overflow-hidden rounded-lg">
                <img
                  src={image || "/placeholder.svg"}
                  alt={`Activity image ${index + 1}`}
                  className="h-auto w-full cursor-pointer object-cover transition-opacity hover:opacity-90"
                />
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between border-t pt-2">
          <div className="flex items-center space-x-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLike}
              className={isLiked ? "text-red-500 hover:text-red-600" : "hover:text-red-500"}
            >
              <Heart className={`mr-2 h-4 w-4 ${isLiked ? "fill-current" : ""}`} />
              {likesCount}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onComment?.(activity.id)}
              className="hover:text-blue-500"
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              {activity.comments}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRepost}
              className={
                isReposted ? "text-green-500 hover:text-green-600" : "hover:text-green-500"
              }
            >
              <Repeat2 className="mr-2 h-4 w-4" />
              {repostsCount}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onShare?.(activity.id)}
              className="hover:text-blue-500"
            >
              <Share className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
