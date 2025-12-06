"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { FollowButton } from "@/components/follow"
import { useSuggestedUsers } from "@/hooks/use-suggested-users"
import Link from "next/link"

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

  if (isLoading) {
      return (
          <div className="space-y-4 p-4">
             {[...Array(limit)].map((_, index) => (
              <div key={index} className="flex animate-pulse items-center space-x-3">
                <div className="bg-muted h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="bg-muted h-3 w-3/4 rounded" />
                  <div className="bg-muted h-3 w-1/2 rounded" />
                </div>
              </div>
            ))}
          </div>
      )
  }

  if (isError || suggestedUsers.length === 0) {
      return null
  }

  return (
    <div className="py-2">
      <div className="space-y-4">
        {suggestedUsers.map((suggestedUser) => {
          const normalizedUsername = suggestedUser.username?.replace(/^@/, "").trim()
          const normalizedName = suggestedUser.name?.trim()
          const usernameLabel =
            normalizedUsername && normalizedUsername !== normalizedName
              ? suggestedUser.username.startsWith("@")
                ? suggestedUser.username
                : `@${suggestedUser.username}`
              : null

          return (
            <div key={suggestedUser.id} className="group flex items-center justify-between gap-2">
              <Link
                href={`/profile/${suggestedUser.id}`}
                className="hover:bg-muted/50 -ml-1.5 flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1.5 transition-colors"
              >
                <Avatar className="h-10 w-10 ring-2 ring-background group-hover:ring-muted">
                  <AvatarImage
                    src={suggestedUser.avatarUrl || "/placeholder.svg"}
                    alt={suggestedUser.name}
                  />
                  <AvatarFallback>{suggestedUser.name?.[0] || "匿"}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center space-x-1">
                    <p className="truncate text-sm font-bold text-foreground">{suggestedUser.name}</p>
                    {suggestedUser.isVerified && (
                      <div
                        className="flex h-3 w-3 items-center justify-center rounded-full bg-blue-500"
                        title="Verified"
                      >
                        <div className="h-1.5 w-1.5 rounded-full bg-white" />
                      </div>
                    )}
                  </div>
                  {usernameLabel && (
                    <p className="truncate text-xs text-muted-foreground">{usernameLabel}</p>
                  )}
                </div>
              </Link>
              <div className="shrink-0">
                <FollowButton
                  targetUserId={suggestedUser.id}
                  size="sm"
                  onFollowSuccess={handleFollowChange}
                  onUnfollowSuccess={handleFollowChange}
                  className="h-8 px-3 rounded-full font-bold"
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
