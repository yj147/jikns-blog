"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { FollowButton } from "@/components/follow"
import { ArrowLeft, UserPlus } from "lucide-react"
import Link from "@/components/app-link"
import { useAuth } from "@/hooks/use-auth"
import { useFollowing } from "@/hooks/use-follow-list"
import { use, useState, useEffect } from "react"
import { createLogger } from "@/lib/utils/logger"

const profileFollowingLogger = createLogger("profile-following-page")

interface FollowingPageProps {
  params: Promise<{
    userId: string
  }>
}

export default function FollowingPage({ params }: FollowingPageProps) {
  const { userId } = use(params)
  const { user: currentUser } = useAuth()
  const [userName, setUserName] = useState<string>("")
  const [totalFollowing, setTotalFollowing] = useState<number | null>(null)

  const {
    items: following,
    isLoading,
    isError,
    error,
    accessDenied,
    deniedReason,
    hasMore,
    loadMore,
    isLoadingMore,
    pagination,
    refresh,
  } = useFollowing(userId, {
    limit: 20,
    autoLoad: true,
    includeTotal: false, // 总数来自 /api/users/[id]/public 的 counts.following，避免 COUNT(*)
  })

  // Linus 原则：数据结构驱动设计
  // 使用公开资料接口，避免拉取完整用户对象（包含 email 等敏感信息）
  useEffect(() => {
    const fetchUserName = async () => {
      try {
        const response = await fetch(`/api/users/${userId}/public`)
        if (response.ok) {
          const result = await response.json()
          setUserName(result.data?.name || "用户")
          const count = result.data?.counts?.following
          setTotalFollowing(typeof count === "number" ? count : null)
        }
      } catch (error) {
        profileFollowingLogger.error("获取用户信息失败", { userId }, error)
        setUserName("用户")
        setTotalFollowing(null)
      }
    }
    fetchUserName()
  }, [userId])

  if (accessDenied) {
    return (
      <div className="bg-background min-h-screen">
        <div className="container mx-auto px-4 py-6">
          <div className="py-12 text-center">
            <div className="mb-4 text-6xl">🚫</div>
            <h3 className="mb-2 text-xl font-semibold">无法访问关注列表</h3>
            <p className="text-muted-foreground mb-6">
              {deniedReason === "NOT_FOUND"
                ? "目标用户不存在"
                : deniedReason === "UNAUTHORIZED"
                  ? "请登录后查看该关注列表"
                  : "该用户限制了关注列表的可见性"}
            </p>
            {deniedReason === "UNAUTHORIZED" ? (
              <Button asChild>
                <Link href="/login">登录后重试</Link>
              </Button>
            ) : (
              <Button variant="outline" onClick={() => history.back()}>
                返回上一页
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

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
              <Link href={`/profile/${userId}`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">正在关注</h1>
              <p className="text-muted-foreground text-sm">
                {userName} 关注的{" "}
                {hasMore
                  ? (totalFollowing ?? pagination.total ?? following.length)
                  : following.length}{" "}
                位用户
              </p>
            </div>
          </div>

          {/* Following List */}
          {isLoading && following.length === 0 ? (
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
          ) : following.length === 0 ? (
            // 空状态
            <Card>
              <CardContent className="pt-8 text-center">
                <UserPlus className="text-muted-foreground mx-auto mb-4 h-16 w-16" />
                <h3 className="mb-2 text-lg font-semibold">还没有关注任何人</h3>
                <p className="text-muted-foreground mb-6">
                  当 {userName} 关注其他用户时，他们会显示在这里
                </p>
                {currentUser?.id === userId && (
                  <Button asChild>
                    <Link href="/feed">去发现有趣的用户</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            // 正在关注列表
            <div className="space-y-4">
              {following.map((user, index) => {
                // Linus 原则：数据结构驱动设计
                // 使用 name 或 id 作为显示标识，绝不暴露 email
                const displayName = user.name || "未命名用户"
                const handle = (user.name || user.id).toLowerCase().replace(/\s+/g, "_")

                return (
                  <div
                    key={user.id}
                    className="animate-in fade-in slide-in-from-bottom-2 duration-200"
                  >
                    <Card className="transition-shadow hover:shadow-md">
                      <CardContent className="pt-6">
                        <div className="flex items-start space-x-4">
                          <Link href={`/profile/${user.id}`}>
                            <Avatar className="h-12 w-12 transition-transform hover:scale-105">
                              <AvatarImage
                                src={user.avatarUrl || "/placeholder.svg"}
                                alt={displayName}
                              />
                              <AvatarFallback>{displayName[0]}</AvatarFallback>
                            </Avatar>
                          </Link>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center space-x-2">
                              <Link href={`/profile/${user.id}`}>
                                <p className="text-sm font-semibold hover:underline">
                                  {displayName}
                                </p>
                              </Link>
                              {user.status === "ACTIVE" && (
                                <div className="bg-primary flex h-3 w-3 items-center justify-center rounded-full">
                                  <div className="h-1.5 w-1.5 rounded-full bg-white" />
                                </div>
                              )}
                              {user.isMutual && (
                                <Badge variant="secondary" className="text-xs">
                                  互相关注
                                </Badge>
                              )}
                            </div>

                            <Link href={`/profile/${user.id}`}>
                              <p className="text-muted-foreground text-xs hover:underline">
                                @{handle}
                              </p>
                            </Link>

                            {user.bio && (
                              <p className="text-muted-foreground mt-2 line-clamp-2 text-sm">
                                {user.bio}
                              </p>
                            )}

                            <p className="text-muted-foreground mt-2 text-xs">
                              关注于 {new Date(user.followedAt).toLocaleDateString("zh-CN")}
                            </p>
                          </div>

                          {/* 关注按钮 */}
                          {currentUser && currentUser.id !== user.id && (
                            <FollowButton
                              targetUserId={user.id}
                              size="sm"
                              initialFollowing={true}
                              onFollowSuccess={() => refresh()}
                              onUnfollowSuccess={() => refresh()}
                            />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
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
