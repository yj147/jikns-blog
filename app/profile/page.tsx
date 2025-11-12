import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { getCurrentUser } from "@/lib/actions/auth"
import { logger } from "@/lib/utils/logger"
import { redirect } from "next/navigation"
import Link from "next/link"
import {
  MapPin,
  Calendar,
  LinkIcon,
  Mail,
  Settings,
  Heart,
  MessageCircle,
  Repeat2,
  BookOpen,
  Users,
  Clock,
} from "lucide-react"

// Mock 数据仅用于静态展示
const mockPosts = [
  {
    id: 1,
    title: "现代Web开发的最佳实践与思考",
    excerpt: "探讨现代Web开发中的关键技术栈选择、性能优化策略以及用户体验设计原则...",
    publishedAt: "2024年1月15日",
    readTime: "8分钟阅读",
    views: 1250,
    likes: 89,
    comments: 23,
    tags: ["技术", "Web开发", "最佳实践"],
  },
]

const mockActivities = [
  {
    id: 1,
    content: "刚刚完成了博客系统的用户资料页重构，现在数据完全来自数据库！",
    timestamp: "2小时前",
    likes: 42,
    comments: 8,
    reposts: 3,
  },
]

export default async function ProfilePage() {
  // 获取当前登录用户，数据来源于数据库
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  // 格式化显示数据
  const displayName = user.name || user.email?.split("@")[0] || "用户"
  const joinDate = new Date(user.createdAt).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
  })
  const lastLoginDate = user.lastLoginAt
    ? new Date(user.lastLoginAt).toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null

  // 解析社交链接
  let socialLinks = {}
  try {
    if (user.socialLinks && typeof user.socialLinks === "object") {
      socialLinks = user.socialLinks as any
    }
  } catch (e) {
    logger.warn("解析社交链接失败", {
      module: "ProfilePage",
      userId: user.id,
      error: e instanceof Error ? e.message : String(e),
    })
  }
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
                    <AvatarImage src={user.avatarUrl || "/placeholder.svg"} alt={displayName} />
                    <AvatarFallback className="text-2xl">
                      {displayName[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 space-y-4">
                    <div>
                      <div className="mb-2 flex items-center space-x-3">
                        <h1 className="text-2xl font-bold md:text-3xl">{displayName}</h1>
                        {user.role === "ADMIN" && (
                          <Badge variant="default" className="bg-primary">
                            管理员
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground text-lg">@{displayName.toLowerCase()}</p>
                    </div>

                    <p className="text-foreground max-w-2xl whitespace-pre-wrap leading-relaxed">
                      {user.bio || "这个人很神秘，什么都没有留下..."}
                    </p>

                    <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-sm">
                      <div className="flex items-center">
                        <Mail className="mr-1 h-4 w-4" />
                        {user.email}
                      </div>
                      {(socialLinks as any)?.website && (
                        <div className="flex items-center">
                          <LinkIcon className="mr-1 h-4 w-4" />
                          <Link
                            href={(socialLinks as any).website}
                            className="text-primary hover:underline"
                          >
                            {(socialLinks as any).website}
                          </Link>
                        </div>
                      )}
                      <div className="flex items-center">
                        <Calendar className="mr-1 h-4 w-4" />
                        加入于 {joinDate}
                      </div>
                      {lastLoginDate && (
                        <div className="flex items-center">
                          <Clock className="mr-1 h-4 w-4" />
                          最后登录: {lastLoginDate}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-6">
                      <div className="text-center">
                        <p className="text-lg font-bold">0</p>
                        <p className="text-muted-foreground text-sm">关注</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold">0</p>
                        <p className="text-muted-foreground text-sm">粉丝</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold">0</p>
                        <p className="text-muted-foreground text-sm">博客</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold">0</p>
                        <p className="text-muted-foreground text-sm">动态</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col space-y-2">
                    <Button asChild>
                      <Link href="/settings">
                        <Settings className="mr-2 h-4 w-4" />
                        编辑资料
                      </Link>
                    </Button>
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
                {mockPosts.length === 0 ? (
                  <Card>
                    <CardContent className="pt-6 text-center">
                      <BookOpen className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                      <p className="text-muted-foreground">还没有发布博客文章</p>
                    </CardContent>
                  </Card>
                ) : (
                  mockPosts.map((post) => (
                    <Card key={post.id} className="transition-shadow hover:shadow-lg">
                      <CardHeader>
                        <div className="mb-2 flex flex-wrap gap-2">
                          {post.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        <CardTitle className="line-clamp-2 text-xl">{post.title}</CardTitle>
                        <CardDescription className="line-clamp-3 text-base">
                          {post.excerpt}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-muted-foreground flex items-center justify-between text-sm">
                          <div className="flex items-center space-x-4">
                            <span className="flex items-center">
                              <Calendar className="mr-1 h-3 w-3" />
                              {post.publishedAt}
                            </span>
                            <span className="flex items-center">
                              <Clock className="mr-1 h-3 w-3" />
                              {post.readTime}
                            </span>
                          </div>
                          <div className="flex items-center space-x-4">
                            <span>{post.views} 阅读</span>
                            <span>{post.likes} 点赞</span>
                            <span>{post.comments} 评论</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              {/* Activities Tab */}
              <TabsContent value="activities" className="space-y-6">
                {mockActivities.length === 0 ? (
                  <Card>
                    <CardContent className="pt-6 text-center">
                      <Users className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                      <p className="text-muted-foreground">还没有发布动态</p>
                    </CardContent>
                  </Card>
                ) : (
                  mockActivities.map((activity) => (
                    <Card key={activity.id} className="transition-shadow hover:shadow-md">
                      <CardContent className="pt-6">
                        <p className="text-foreground mb-4 leading-relaxed">{activity.content}</p>
                        <div className="text-muted-foreground flex items-center justify-between text-sm">
                          <span>{activity.timestamp}</span>
                          <div className="flex items-center space-x-4">
                            <span className="flex items-center">
                              <Heart className="mr-1 h-3 w-3" />
                              {activity.likes}
                            </span>
                            <span className="flex items-center">
                              <MessageCircle className="mr-1 h-3 w-3" />
                              {activity.comments}
                            </span>
                            <span className="flex items-center">
                              <Repeat2 className="mr-1 h-3 w-3" />
                              {activity.reposts}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              {/* Likes Tab */}
              <TabsContent value="likes" className="space-y-6">
                <Card>
                  <CardContent className="pt-6 text-center">
                    <Heart className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                    <p className="text-muted-foreground">还没有点赞的内容</p>
                  </CardContent>
                </Card>
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
                        variant={user.status === "ACTIVE" ? "default" : "destructive"}
                        className="text-xs"
                      >
                        {user.status === "ACTIVE" ? "正常" : "已封禁"}
                      </Badge>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">用户角色</span>
                      <Badge
                        variant={user.role === "ADMIN" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {user.role === "ADMIN" ? "管理员" : "普通用户"}
                      </Badge>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">用户ID</span>
                      <span className="font-mono text-xs">{user.id.slice(-8)}</span>
                    </div>
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
                      <span className="font-semibold">0 篇</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">总阅读量</span>
                      <span className="font-semibold">0</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">获得点赞</span>
                      <span className="font-semibold">0</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">评论互动</span>
                      <span className="font-semibold">0</span>
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
