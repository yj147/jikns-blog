"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { FollowButton } from "@/components/follow"
import { ArrowLeft, Users } from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { useFollowers, useFollowStatusBatch } from "@/hooks/use-follow-list"
import { motion } from "framer-motion"
import { useState, useEffect, useMemo } from "react"
import { createLogger } from "@/lib/utils/logger"

const profileFollowersLogger = createLogger("profile-followers-page")

interface FollowersPageProps {
  params: {
    userId: string
  }
}

export default function FollowersPage({ params }: FollowersPageProps) {
  const { user: currentUser } = useAuth()
  const [userName, setUserName] = useState<string>("")

  const {
    items: followers,
    isLoading,
    isError,
    error,
    hasMore,
    loadMore,
    isLoadingMore,
    pagination,
    refresh,
  } = useFollowers(params.userId, {
    limit: 20,
    autoLoad: true,
    includeTotal: true, // 请求总数以显示在页面抬头
  })

  const followerIds = useMemo(() => followers.map((follower) => follower.id), [followers])
  const { statusMap: followerStatusMap } = useFollowStatusBatch(followerIds, currentUser?.id)

  // Linus 原则：数据结构驱动设计
  // 使用公开资料接口，避免拉取完整用户对象（包含 email 等敏感信息）
  useEffect(() => {
    const fetchUserName = async () => {
      try {
        const response = await fetch(`/api/users/${params.userId}/public`)
        if (response.ok) {
          const result = await response.json()
          setUserName(result.data?.name || "用户")
        }
      } catch (error) {
        profileFollowersLogger.error("获取用户信息失败", { userId: params.userId }, error)
        setUserName("用户")
      }
    }
    fetchUserName()
  }, [params.userId])

  if (isError) {
    return (
      <div className="bg-background min-h-screen">
        <div className="container mx-auto px-4 py-6">
          <div className="py-12 text-center">
            <div className="mb-4 text-6xl">😵</div>
            <h3 className="mb-2 text-xl font-semibold">加载失败</h3>
            <p className="text-muted-foreground mb-6">{error?.message || "请稍后重试"}</p>
            <Button onClick={() => window.location.reload()}>重新加载</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background min-h-screen">

      <div className="container mx-auto px-4 py-6">
        <div className="mx-auto max-w-2xl">
          {/* Header */}
          <div className="mb-6 flex items-center space-x-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/profile/${params.userId}`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">粉丝</h1>
              <p className="text-muted-foreground text-sm">
                {userName} 的 {pagination.total} 位关注者
              </p>
            </div>
          </div>

          {/* Followers List */}
          {isLoading && followers.length === 0 ? (
            // 加载状态
            <div className="space-y-4">
              {[...Array(5)].map((_, index) => (
                <Card key={index} className="animate-pulse">
                  <CardContent className="pt-6">
                    <div className="flex items-center space-x-4">
                      <div className="bg-muted h-12 w-12 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <div className="bg-muted h-4 w-1/3 rounded" />
                        <div className="bg-muted h-3 w-1/2 rounded" />
                        <div className="bg-muted h-3 w-3/4 rounded" />
                      </div>
                      <div className="bg-muted h-9 w-20 rounded" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : followers.length === 0 ? (
            // 空状态
            <Card>
              <CardContent className="pt-8 text-center">
                <Users className="text-muted-foreground mx-auto mb-4 h-16 w-16" />
                <h3 className="mb-2 text-lg font-semibold">还没有粉丝</h3>
                <p className="text-muted-foreground mb-6">
                  当有用户关注 {userName} 时，他们会显示在这里
                </p>
              </CardContent>
            </Card>
          ) : (
            // 关注者列表
            <div className="space-y-4">
              {followers.map((follower, index) => {
                // Linus 原则：数据结构驱动设计
                // 使用 name 或 id 作为显示标识，绝不暴露 email
                const displayName = follower.name || "未命名用户"
                const handle = (follower.name || follower.id).toLowerCase().replace(/\s+/g, "_")
                const isInitiallyFollowing = currentUser
                  ? (followerStatusMap.get(follower.id)?.isFollowing ?? follower.isMutual)
                  : follower.isMutual

                return (
                  <motion.div
                    key={follower.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    <Card className="transition-shadow hover:shadow-md">
                      <CardContent className="pt-6">
                        <div className="flex items-start space-x-4">
                          <Link href={`/profile/${follower.id}`}>
                            <Avatar className="h-12 w-12 transition-transform hover:scale-105">
                              <AvatarImage
                                src={follower.avatarUrl || "/placeholder.svg"}
                                alt={displayName}
                              />
                              <AvatarFallback>{displayName[0]}</AvatarFallback>
                            </Avatar>
                          </Link>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center space-x-2">
                              <Link href={`/profile/${follower.id}`}>
                                <p className="text-sm font-semibold hover:underline">
                                  {displayName}
                                </p>
                              </Link>
                              {follower.status === "ACTIVE" && (
                                <div className="bg-primary flex h-3 w-3 items-center justify-center rounded-full">
                                  <div className="h-1.5 w-1.5 rounded-full bg-white" />
                                </div>
                              )}
                              {(followerStatusMap.get(follower.id)?.isMutual ??
                                follower.isMutual) && (
                                <Badge variant="secondary" className="text-xs">
                                  互相关注
                                </Badge>
                              )}
                            </div>

                            <Link href={`/profile/${follower.id}`}>
                              <p className="text-muted-foreground text-xs hover:underline">
                                @{handle}
                              </p>
                            </Link>

                            {follower.bio && (
                              <p className="text-muted-foreground mt-2 line-clamp-2 text-sm">
                                {follower.bio}
                              </p>
                            )}

                            <p className="text-muted-foreground mt-2 text-xs">
                              关注于 {new Date(follower.followedAt).toLocaleDateString("zh-CN")}
                            </p>
                          </div>

                          {/* 关注按钮 */}
                          {currentUser && currentUser.id !== follower.id && (
                            <FollowButton
                              targetUserId={follower.id}
                              size="sm"
                              initialFollowing={isInitiallyFollowing}
                              onFollowSuccess={() => refresh()}
                              onUnfollowSuccess={() => refresh()}
                            />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </div>
          )}

          {/* 加载更多按钮 */}
          {hasMore && !isLoading && (
            <div className="mt-8 text-center">
              <Button
                onClick={loadMore}
                disabled={isLoadingMore}
                variant="outline"
                className="w-full"
              >
                {isLoadingMore ? "加载中..." : "加载更多"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
