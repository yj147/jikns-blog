import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import Link from "next/link"
import {
  Users,
  BookOpen,
  MessageSquare,
  TrendingUp,
  Eye,
  Heart,
  AlertTriangle,
  Clock,
  BarChart3,
  Settings,
  Shield,
} from "lucide-react"

// Mock admin data
const adminStats = {
  totalUsers: 12456,
  totalPosts: 1234,
  totalComments: 5678,
  totalViews: 234567,
  monthlyGrowth: {
    users: 12.5,
    posts: 8.3,
    comments: 15.7,
    views: 23.4,
  },
}

const recentActivities = [
  {
    id: 1,
    type: "user_registered",
    user: "新用户 李明",
    action: "注册了账户",
    timestamp: "5分钟前",
    status: "success",
  },
  {
    id: 2,
    type: "post_published",
    user: "张三",
    action: "发布了新文章《React 18 新特性详解》",
    timestamp: "15分钟前",
    status: "success",
  },
  {
    id: 3,
    type: "comment_reported",
    user: "系统",
    action: "检测到可疑评论需要审核",
    timestamp: "30分钟前",
    status: "warning",
  },
  {
    id: 4,
    type: "user_banned",
    user: "管理员",
    action: "封禁了用户 @spammer123",
    timestamp: "1小时前",
    status: "error",
  },
]

const pendingTasks = [
  {
    id: 1,
    title: "审核待发布文章",
    count: 3,
    priority: "high",
    link: "/admin/blog",
  },
  {
    id: 2,
    title: "处理用户举报",
    count: 7,
    priority: "medium",
    link: "/admin/content",
  },
  {
    id: 3,
    title: "系统更新通知",
    count: 1,
    priority: "low",
    link: "/admin/settings",
  },
]

const topContent = [
  {
    id: 1,
    title: "现代Web开发的最佳实践与思考",
    author: "张三",
    views: 12500,
    likes: 890,
    comments: 234,
  },
  {
    id: 2,
    title: "AI时代的设计思维转变",
    author: "李四",
    views: 9800,
    likes: 670,
    comments: 156,
  },
  {
    id: 3,
    title: "构建可持续的开源项目",
    author: "王五",
    views: 7560,
    likes: 450,
    comments: 123,
  },
]

export default function AdminDashboard() {
  return (
    <div className="bg-background min-h-screen">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="mb-2 text-3xl font-bold">管理后台</h1>
              <p className="text-muted-foreground">欢迎回来，管理员</p>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="outline" asChild>
                <Link href="/admin/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  系统设置
                </Link>
              </Button>
              <Button asChild>
                <Link href="/admin/blog">
                  <BookOpen className="mr-2 h-4 w-4" />
                  管理内容
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总用户数</CardTitle>
              <Users className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{adminStats.totalUsers.toLocaleString()}</div>
              <p className="text-muted-foreground text-xs">
                <span className="text-green-600">+{adminStats.monthlyGrowth.users}%</span> 较上月
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总文章数</CardTitle>
              <BookOpen className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{adminStats.totalPosts.toLocaleString()}</div>
              <p className="text-muted-foreground text-xs">
                <span className="text-green-600">+{adminStats.monthlyGrowth.posts}%</span> 较上月
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总评论数</CardTitle>
              <MessageSquare className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{adminStats.totalComments.toLocaleString()}</div>
              <p className="text-muted-foreground text-xs">
                <span className="text-green-600">+{adminStats.monthlyGrowth.comments}%</span> 较上月
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总浏览量</CardTitle>
              <Eye className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{adminStats.totalViews.toLocaleString()}</div>
              <p className="text-muted-foreground text-xs">
                <span className="text-green-600">+{adminStats.monthlyGrowth.views}%</span> 较上月
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="space-y-8 lg:col-span-2">
            {/* Pending Tasks */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <AlertTriangle className="mr-2 h-5 w-5" />
                  待处理任务
                </CardTitle>
                <CardDescription>需要您关注的重要事项</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {pendingTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div className="flex items-center space-x-3">
                        <div
                          className={`h-3 w-3 rounded-full ${
                            task.priority === "high"
                              ? "bg-red-500"
                              : task.priority === "medium"
                                ? "bg-yellow-500"
                                : "bg-green-500"
                          }`}
                        />
                        <div>
                          <p className="font-medium">{task.title}</p>
                          <p className="text-muted-foreground text-sm">{task.count} 项待处理</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={task.link}>处理</Link>
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Activities */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="mr-2 h-5 w-5" />
                  最近活动
                </CardTitle>
                <CardDescription>系统最新动态</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentActivities.map((activity) => (
                    <div key={activity.id} className="flex items-start space-x-3">
                      <div
                        className={`mt-2 h-2 w-2 rounded-full ${
                          activity.status === "success"
                            ? "bg-green-500"
                            : activity.status === "warning"
                              ? "bg-yellow-500"
                              : "bg-red-500"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">
                          <span className="font-medium">{activity.user}</span> {activity.action}
                        </p>
                        <p className="text-muted-foreground text-xs">{activity.timestamp}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Top Content */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="mr-2 h-5 w-5" />
                  热门内容
                </CardTitle>
                <CardDescription>本月表现最佳的文章</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topContent.map((content, index) => (
                    <div key={content.id} className="flex items-center space-x-4">
                      <div className="bg-primary text-primary-foreground flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold">
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 font-medium">{content.title}</p>
                        <p className="text-muted-foreground text-sm">作者：{content.author}</p>
                      </div>
                      <div className="text-muted-foreground flex items-center space-x-4 text-sm">
                        <span className="flex items-center">
                          <Eye className="mr-1 h-3 w-3" />
                          {content.views.toLocaleString()}
                        </span>
                        <span className="flex items-center">
                          <Heart className="mr-1 h-3 w-3" />
                          {content.likes}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>快捷操作</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Button className="w-full justify-start" asChild>
                    <Link href="/admin/blog/new">
                      <BookOpen className="mr-2 h-4 w-4" />
                      创建新文章
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full justify-start bg-transparent" asChild>
                    <Link href="/admin/users">
                      <Users className="mr-2 h-4 w-4" />
                      用户管理
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full justify-start bg-transparent" asChild>
                    <Link href="/admin/content">
                      <Shield className="mr-2 h-4 w-4" />
                      内容审核
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full justify-start bg-transparent" asChild>
                    <Link href="/admin/analytics">
                      <BarChart3 className="mr-2 h-4 w-4" />
                      数据分析
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* System Status */}
            <Card>
              <CardHeader>
                <CardTitle>系统状态</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm">服务器负载</span>
                      <span className="text-muted-foreground text-sm">45%</span>
                    </div>
                    <Progress value={45} className="h-2" />
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm">存储使用</span>
                      <span className="text-muted-foreground text-sm">67%</span>
                    </div>
                    <Progress value={67} className="h-2" />
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm">内存使用</span>
                      <span className="text-muted-foreground text-sm">32%</span>
                    </div>
                    <Progress value={32} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Users */}
            <Card>
              <CardHeader>
                <CardTitle>新注册用户</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center space-x-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage
                          src={`/author-writing.png?height=32&width=32&query=new user ${i}`}
                        />
                        <AvatarFallback>用{i}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">新用户 {i}</p>
                        <p className="text-muted-foreground text-xs">{i} 小时前注册</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
