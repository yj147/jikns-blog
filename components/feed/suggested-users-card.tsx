"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { FollowButton } from "@/components/follow"
import { useSuggestedUsers } from "@/hooks/use-suggested-users"

interface SuggestedUsersCardProps {
  limit?: number
  onFollowChange?: () => void
}

export default function SuggestedUsersCard({ limit = 3, onFollowChange }: SuggestedUsersCardProps) {
  const { suggestedUsers, isLoading, isError, refresh } = useSuggestedUsers(limit)

  const handleFollowChange = () => {
    onFollowChange?.()
    refresh()
  }

  return (
    <Card className="transition-shadow hover:shadow-lg">
      <CardHeader>
        <CardTitle className="text-lg">推荐关注</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(limit)].map((_, index) => (
              <div key={index} className="flex animate-pulse items-start space-x-3">
                <div className="bg-muted h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="bg-muted h-4 w-3/4 rounded" />
                  <div className="bg-muted h-3 w-1/2 rounded" />
                  <div className="bg-muted h-3 w-full rounded" />
                </div>
                <div className="bg-muted h-8 w-16 rounded" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="py-4 text-center text-sm text-muted-foreground">暂时无法加载推荐用户</div>
        ) : suggestedUsers.length === 0 ? (
          <div className="py-4 text-center text-sm text-muted-foreground">暂无推荐用户</div>
        ) : (
          <div className="space-y-4">
            {suggestedUsers.map((suggestedUser) => (
              <div
                key={suggestedUser.id}
                className="flex items-start space-x-3"
                data-hover-scale=""
                data-hover-shift=""
              >
                <div data-hover-scale="">
                  <Avatar className="h-10 w-10">
                    <AvatarImage
                      src={suggestedUser.avatarUrl || "/placeholder.svg"}
                      alt={suggestedUser.name}
                    />
                    <AvatarFallback>{suggestedUser.name?.[0] || "匿"}</AvatarFallback>
                  </Avatar>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center space-x-1">
                    <p className="text-sm font-medium">{suggestedUser.name}</p>
                    {suggestedUser.isVerified && (
                      <div className="bg-primary flex h-3 w-3 items-center justify-center rounded-full">
                        <div className="h-1.5 w-1.5 rounded-full bg-white" />
                      </div>
                    )}
                  </div>
                  <p className="text-muted-foreground text-xs">{suggestedUser.username}</p>
                  {suggestedUser.bio && (
                    <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">{suggestedUser.bio}</p>
                  )}
                  <p className="text-muted-foreground mt-1 text-xs">
                    {suggestedUser.followers.toLocaleString()} 关注者
                  </p>
                </div>
                <FollowButton
                  targetUserId={suggestedUser.id}
                  size="sm"
                  onFollowSuccess={handleFollowChange}
                  onUnfollowSuccess={handleFollowChange}
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

