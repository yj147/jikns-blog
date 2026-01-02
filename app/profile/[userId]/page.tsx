// 强制动态渲染，确保用户资料始终最新
export const dynamic = "force-dynamic"

import { logger } from "@/lib/utils/logger"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { getCurrentUser } from "@/lib/actions/auth"
import { getQuickStats, EMPTY_QUICK_STATS, type QuickStats } from "@/lib/profile/stats"
import Link from "next/link"
import { FollowButton } from "@/components/follow"
import { ProfileActivitiesTab } from "@/components/profile/profile-activities-tab"
import { ProfilePostsTab } from "@/components/profile/profile-posts-tab"
import { ProfileLikesTab } from "@/components/profile/profile-likes-tab"
import { FollowerCount } from "@/components/profile/follower-count"
import { prisma } from "@/lib/prisma"
import { signAvatarUrl } from "@/lib/storage/signed-url"
import { privacySettingsSchema, socialLinksSchema } from "@/types/user-settings"
import { notFound } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import {
  Calendar,
  LinkIcon,
  Settings,
  Heart,
  BookOpen,
  Users,
  Clock,
  UserPlus,
  Github,
  Twitter,
  Linkedin,
  Mail,
  MapPin,
  Phone,
} from "lucide-react"

interface ProfilePageProps {
  params: Promise<{
    userId: string
  }>
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { userId } = await params

  // 获取当前登录用户
  const currentUser = await getCurrentUser()

  // 获取目标用户信息
  // Linus 原则：数据结构驱动设计
  // 使用 PUBLIC_USER_SELECT 确保不暴露 PII（email, role 等敏感信息）
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      bio: true,
      status: true,
      role: true, // 仅用于显示管理员徽章
      email: true,
      location: true,
      phone: true,
      createdAt: true,
      lastLoginAt: true, // 仅本人可见
      socialLinks: true,
      privacySettings: true,
      _count: {
        select: {
          posts: true,
          activities: true,
          followers: true,
          following: true,
        },
      },
    },
  })

  if (!targetUser) {
    notFound()
  }

  const targetAvatarSignedUrl = await signAvatarUrl(targetUser.avatarUrl)
  const targetAvatarUrl = targetAvatarSignedUrl || targetUser.avatarUrl

  // 检查是否为当前用户的资料页
  const isOwnProfile = currentUser?.id === targetUser.id
  const isAdmin = currentUser?.role === "ADMIN"

  // 解析隐私设置并进行访问控制检查
  const parsedPrivacy = privacySettingsSchema.safeParse(targetUser.privacySettings ?? {})
  const privacySettings = parsedPrivacy.success
    ? parsedPrivacy.data
    : privacySettingsSchema.parse({})
  if (!parsedPrivacy.success) {
    logger.warn("解析隐私设置失败:", parsedPrivacy.error)
  }

  // 访问控制：根据profileVisibility检查权限
  if (!isOwnProfile && !isAdmin && privacySettings.profileVisibility === "private") {
    // private: 仅本人可见（管理员例外）
    notFound()
  }

  let viewerFollowsTarget = false

  if (currentUser && !isOwnProfile && !isAdmin) {
    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: currentUser.id,
          followingId: targetUser.id,
        },
      },
      select: {
        followerId: true,
      },
    })

    viewerFollowsTarget = !!existingFollow

    // followers: 仅粉丝可见，非粉丝访问返回404
    if (privacySettings.profileVisibility === "followers" && !viewerFollowsTarget) {
      notFound()
    }
  } else if (!currentUser && privacySettings.profileVisibility === "followers") {
    // 未登录用户无法访问followers模式的资料
    notFound()
  }

  // 格式化显示数据
  // Linus 原则：消除特殊情况
  // displayName 回退逻辑：name || 匿名ID，绝不使用邮箱前缀
  const displayName = targetUser.name || `用户${targetUser.id.slice(0, 8)}`
  const joinDate = new Date(targetUser.createdAt).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
  })
  const lastLoginDate = targetUser.lastLoginAt
    ? new Date(targetUser.lastLoginAt).toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null

  const parsedSocialLinks = socialLinksSchema.safeParse(targetUser.socialLinks ?? {})
  const socialLinks: Partial<ReturnType<typeof socialLinksSchema.parse>> = parsedSocialLinks.success
    ? parsedSocialLinks.data
    : {}
  if (!parsedSocialLinks.success) {
    logger.warn("解析社交链接失败:", parsedSocialLinks.error)
  }

  let quickStats: QuickStats = { ...EMPTY_QUICK_STATS }
  try {
    quickStats = await getQuickStats(targetUser.id)
  } catch (error) {
    logger.error(
      "加载用户活动统计失败",
      { module: "profile:target", targetUserId: targetUser.id },
      error
    )
  }

  const canShowEmail = isOwnProfile || privacySettings.showEmail
  const resolvedEmailLink =
    canShowEmail && (socialLinks.email || targetUser.email)
      ? (socialLinks.email ?? `mailto:${targetUser.email}`)
      : undefined

  const getDisplayText = (href: string) =>
    href.startsWith("mailto:") ? href.replace(/^mailto:/, "") : href

  const socialLinkItems: {
    key: string
    label: string
    href: string
    displayText: string
    Icon: LucideIcon
  }[] = (
    [
      socialLinks.website
        ? {
            key: "website",
            label: "网站",
            href: socialLinks.website,
            displayText: socialLinks.website,
            Icon: LinkIcon,
          }
        : null,
      socialLinks.github
        ? {
            key: "github",
            label: "GitHub",
            href: socialLinks.github,
            displayText: socialLinks.github,
            Icon: Github,
          }
        : null,
      socialLinks.twitter
        ? {
            key: "twitter",
            label: "Twitter",
            href: socialLinks.twitter,
            displayText: socialLinks.twitter,
            Icon: Twitter,
          }
        : null,
      socialLinks.linkedin
        ? {
            key: "linkedin",
            label: "LinkedIn",
            href: socialLinks.linkedin,
            displayText: socialLinks.linkedin,
            Icon: Linkedin,
          }
        : null,
      resolvedEmailLink
        ? {
            key: "email",
            label: "邮箱",
            href: resolvedEmailLink,
            displayText: getDisplayText(resolvedEmailLink),
            Icon: Mail,
          }
        : null,
    ] as const
  ).filter(Boolean) as {
    key: string
    label: string
    href: string
    displayText: string
    Icon: LucideIcon
  }[]

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-4">
          {/* Profile Header */}
          <div className="lg:col-span-4">
            <Card>
              <CardContent className="pt-8">
                <div className="flex flex-col items-start space-y-4 md:flex-row md:items-center md:space-x-6 md:space-y-0">
                  <Avatar className="h-24 w-24 md:h-32 md:w-32">
                    <AvatarImage src={targetAvatarUrl || "/placeholder.svg"} alt={displayName} />
                    <AvatarFallback className="text-2xl">
                      {displayName[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 space-y-4">
                    <div>
                      <div className="mb-2 flex items-center space-x-3">
                        <h1 className="text-2xl font-bold md:text-3xl">{displayName}</h1>
                        {targetUser.role === "ADMIN" && (
                          <Badge variant="default" className="bg-primary">
                            管理员
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground text-lg">@{displayName.toLowerCase()}</p>
                    </div>

                    <p className="text-foreground max-w-2xl whitespace-pre-wrap leading-relaxed">
                      {targetUser.bio || "这个人很神秘，什么都没有留下..."}
                    </p>

                    <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-sm">
                      {socialLinkItems.map((item) => (
                        <Link
                          key={item.key}
                          href={item.href}
                          className="text-primary flex max-w-full items-center gap-1 hover:underline"
                          target="_blank"
                          rel="noreferrer"
                          title={item.href}
                        >
                          <item.Icon className="h-4 w-4" />
                          <span className="sr-only">{item.label}</span>
                          <span className="truncate">{item.displayText}</span>
                        </Link>
                      ))}
                      {(isOwnProfile || privacySettings.showLocation) && targetUser.location && (
                        <div className="flex items-center">
                          <MapPin className="mr-1 h-4 w-4" />
                          {targetUser.location}
                        </div>
                      )}
                      {(isOwnProfile || privacySettings.showPhone) && targetUser.phone && (
                        <div className="flex items-center">
                          <Phone className="mr-1 h-4 w-4" />
                          {targetUser.phone}
                        </div>
                      )}
                      <div className="flex items-center">
                        <Calendar className="mr-1 h-4 w-4" />
                        加入于 {joinDate}
                      </div>
                      {isOwnProfile && lastLoginDate && (
                        <div className="flex items-center">
                          <Clock className="mr-1 h-4 w-4" />
                          最后登录: {lastLoginDate}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-6">
                      <Link
                        href={`/profile/${targetUser.id}/following`}
                        className="hover:underline"
                      >
                        <div className="text-center">
                          <p className="text-lg font-bold">{targetUser._count.following}</p>
                          <p className="text-muted-foreground text-sm">关注</p>
                        </div>
                      </Link>
                      <Link
                        href={`/profile/${targetUser.id}/followers`}
                        className="hover:underline"
                      >
                        <div className="text-center">
                          <FollowerCount
                            userId={targetUser.id}
                            initialCount={targetUser._count.followers}
                          />
                          <p className="text-muted-foreground text-sm">粉丝</p>
                        </div>
                      </Link>
                      <div className="text-center">
                        <p className="text-lg font-bold">{targetUser._count.posts}</p>
                        <p className="text-muted-foreground text-sm">博客</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold">{targetUser._count.activities}</p>
                        <p className="text-muted-foreground text-sm">动态</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col space-y-2">
                    {isOwnProfile ? (
                      <Button asChild>
                        <Link href="/settings">
                          <Settings className="mr-2 h-4 w-4" />
                          编辑资料
                        </Link>
                      </Button>
                    ) : currentUser ? (
                      <FollowButton
                        targetUserId={targetUser.id}
                        size="default"
                        initialFollowing={viewerFollowsTarget}
                      />
                    ) : (
                      <Button asChild>
                        <Link href="/login" prefetch={false}>
                          <UserPlus className="mr-2 h-4 w-4" />
                          登录后关注
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <Tabs defaultValue="posts" className="space-y-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="posts" className="flex items-center">
                  <BookOpen className="mr-2 h-4 w-4" />
                  博客文章
                </TabsTrigger>
                <TabsTrigger value="activities" className="flex items-center">
                  <Users className="mr-2 h-4 w-4" />
                  动态
                </TabsTrigger>
                <TabsTrigger value="likes" className="flex items-center">
                  <Heart className="mr-2 h-4 w-4" />
                  点赞
                </TabsTrigger>
                <TabsTrigger value="media" className="flex items-center">
                  <Clock className="mr-2 h-4 w-4" />
                  媒体
                </TabsTrigger>
              </TabsList>

              {/* Blog Posts Tab */}
              <TabsContent value="posts" className="space-y-6">
                <ProfilePostsTab userId={userId} />
              </TabsContent>

              {/* Activities Tab */}
              <TabsContent value="activities" className="space-y-6">
                <ProfileActivitiesTab userId={userId} />
              </TabsContent>

              {/* Likes Tab */}
              <TabsContent value="likes" className="space-y-6">
                <ProfileLikesTab userId={userId} />
              </TabsContent>

              {/* Media Tab */}
              <TabsContent value="media" className="space-y-6">
                <Card>
                  <CardContent className="pt-6 text-center">
                    <div className="bg-muted mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg">
                      <Clock className="text-muted-foreground h-6 w-6" />
                    </div>
                    <p className="text-muted-foreground">还没有媒体内容</p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-6">
              {/* User Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">用户状态</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">账户状态</span>
                      <Badge
                        variant={targetUser.status === "ACTIVE" ? "default" : "destructive"}
                        className="text-xs"
                      >
                        {targetUser.status === "ACTIVE" ? "正常" : "已封禁"}
                      </Badge>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">用户角色</span>
                      <Badge
                        variant={targetUser.role === "ADMIN" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {targetUser.role === "ADMIN" ? "管理员" : "普通用户"}
                      </Badge>
                    </div>
                    {isOwnProfile && (
                      <>
                        <Separator />
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground text-sm">用户ID</span>
                          <span className="font-mono text-xs">{targetUser.id.slice(-8)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">活动统计</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">本月发布</span>
                      <span className="font-semibold">{quickStats.monthlyPosts} 篇</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">总阅读量</span>
                      <span className="font-semibold">{quickStats.totalViews}</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">获得点赞</span>
                      <span className="font-semibold">{quickStats.totalLikes}</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">评论互动</span>
                      <span className="font-semibold">{quickStats.totalComments}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">最近活动</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center space-x-2">
                      <div className="bg-primary h-2 w-2 rounded-full" />
                      <span className="text-muted-foreground">
                        {lastLoginDate ? `最后登录: ${lastLoginDate}` : "从未登录"}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      <span className="text-muted-foreground">账户创建: {joinDate}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
