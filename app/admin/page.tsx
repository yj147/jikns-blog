"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { fetchGet, FetchError } from "@/lib/api/fetch-json"
import { useToast } from "@/components/ui/use-toast"
import {
  Users,
  BookOpen,
  MessageSquare,
  Activity,
  Shield,
  RefreshCw,
  ArrowRight,
  AlertTriangle,
} from "lucide-react"

type AdminStats = {
  totals: {
    users: number
    posts: number
    comments: number
    activities: number
  }
  summary: {
    activeUsers: number
    bannedUsers: number
    adminUsers: number
    draftPosts: number
  }
  trends: {
    newUsers7d: number
    newPosts7d: number
    newComments7d: number
    newActivities7d: number
  }
  topPosts: Array<{
    id: string
    title: string
    authorName: string | null
    viewCount: number
    comments: number
    likes: number
    createdAt: string
  }>
  recentActivities: Array<{
    id: string
    content: string
    authorName: string | null
    authorAvatar: string | null
    createdAt: string
    likes: number
    comments: number
  }>
  pending: {
    reviewPosts: number
    bannedUsers: number
  }
  generatedAt: string
}

interface DashboardState {
  stats: AdminStats | null
  loading: boolean
  error: string | null
}

const numberFormatter = new Intl.NumberFormat("zh-CN")

export default function AdminDashboard() {
  const { toast } = useToast()
  const [state, setState] = useState<DashboardState>({
    stats: null,
    loading: true,
    error: null,
  })

  const loadStats = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const response = await fetchGet<{ data?: AdminStats }>("/api/admin/stats")
      const payload = (response as any)?.data ?? response
      setState({ stats: payload as AdminStats, loading: false, error: null })
    } catch (error) {
      const message = error instanceof FetchError ? error.message : "统计数据获取失败"
      setState({ stats: null, loading: false, error: message })
      toast({ variant: "destructive", title: "加载失败", description: message })
    }
  }, [toast])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  return (
    <div className="bg-background min-h-screen">

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="mb-1 text-3xl font-bold">管理后台</h1>
            <p className="text-muted-foreground">实时掌握用户、内容与动态运行状况</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" asChild>
              <Link href="/admin/settings">
                <Shield className="mr-2 h-4 w-4" /> 系统设置
              </Link>
            </Button>
            <Button onClick={loadStats} variant="secondary" disabled={state.loading}>
              <RefreshCw className="mr-2 h-4 w-4" /> 刷新数据
            </Button>
          </div>
        </div>

        {state.loading ? (
          <DashboardSkeleton />
        ) : state.error ? (
          <ErrorState message={state.error} onRetry={loadStats} />
        ) : state.stats ? (
          <DashboardContent stats={state.stats} />
        ) : null}
      </div>
    </div>
  )
}

function DashboardContent({ stats }: { stats: AdminStats }) {
  const pendingCards = useMemo(
    () => [
      {
        title: "待审核文章",
        value: stats.pending.reviewPosts,
        description: "未发布稿件数量",
        link: "/admin/blog",
      },
      {
        title: "被封禁用户",
        value: stats.pending.bannedUsers,
        description: "需要进一步复核",
        link: "/admin/users",
      },
    ],
    [stats.pending]
  )

  return (
    <div className="space-y-8">
      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="总用户"
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
          value={stats.totals.users}
          helper={`活跃用户 ${numberFormatter.format(stats.summary.activeUsers)}`}
        />
        <StatCard
          title="文章总数"
          icon={<BookOpen className="h-4 w-4 text-muted-foreground" />}
          value={stats.totals.posts}
          helper={`待审核 ${stats.summary.draftPosts}`}
        />
        <StatCard
          title="评论总数"
          icon={<MessageSquare className="h-4 w-4 text-muted-foreground" />}
          value={stats.totals.comments}
          helper={`近7天 +${stats.trends.newComments7d}`}
        />
        <StatCard
          title="动态总数"
          icon={<Activity className="h-4 w-4 text-muted-foreground" />}
          value={stats.totals.activities}
          helper={`近7天 +${stats.trends.newActivities7d}`}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>近期动态</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.recentActivities.length === 0 && (
              <p className="text-muted-foreground text-sm">暂无新的动态。</p>
            )}
            {stats.recentActivities.map((activity) => (
              <RecentActivityItem key={activity.id} activity={activity} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>待处理事项</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingCards.map((item) => (
              <div key={item.title} className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{item.title}</p>
                    <p className="text-2xl font-bold">{item.value}</p>
                  </div>
                  <AlertTriangle className="text-amber-500" />
                </div>
                <p className="text-muted-foreground mb-3 text-xs">{item.description}</p>
                <Button variant="ghost" size="sm" asChild className="w-full justify-start">
                  <Link href={item.link}>
                    立即处理 <ArrowRight className="ml-2 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>高互动文章</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.topPosts.length === 0 && (
              <p className="text-muted-foreground text-sm">暂无文章被收录。</p>
            )}
            {stats.topPosts.map((post) => (
              <div key={post.id} className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-base font-semibold">{post.title}</h4>
                    <p className="text-muted-foreground text-sm">{post.authorName ?? "匿名"}</p>
                  </div>
                  <Badge variant="secondary">{numberFormatter.format(post.viewCount)} 浏览</Badge>
                </div>
                <div className="mt-3 flex gap-4 text-sm text-muted-foreground">
                  <span>评论 {post.comments}</span>
                  <span>点赞 {post.likes}</span>
                  <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>角色分布</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">管理员</p>
              <p className="text-2xl font-bold">{stats.summary.adminUsers}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">封禁用户</p>
              <p className="text-2xl font-bold">{stats.summary.bannedUsers}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">活跃用户</p>
              <p className="text-2xl font-bold">{stats.summary.activeUsers}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <p className="text-muted-foreground text-xs">
        数据更新时间：{new Date(stats.generatedAt).toLocaleString()}
      </p>
    </div>
  )
}

function StatCard({
  title,
  value,
  icon,
  helper,
}: {
  title: string
  value: number
  icon: React.ReactNode
  helper?: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{numberFormatter.format(value)}</div>
        {helper && <p className="text-muted-foreground text-xs">{helper}</p>}
      </CardContent>
    </Card>
  )
}

function RecentActivityItem({
  activity,
}: {
  activity: AdminStats["recentActivities"][number]
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border p-3">
      <Avatar className="h-10 w-10">
        <AvatarImage src={activity.authorAvatar ?? undefined} alt={activity.authorName ?? "用户"} />
        <AvatarFallback>{activity.authorName?.charAt(0) ?? "U"}</AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{activity.authorName ?? "匿名用户"}</p>
          <span className="text-muted-foreground text-xs">
            {new Date(activity.createdAt).toLocaleString()}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{activity.content}</p>
        <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
          <span>点赞 {activity.likes}</span>
          <span>评论 {activity.comments}</span>
        </div>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={`stat-skeleton-${index}`}>
            <CardContent className="space-y-4 pt-6">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </section>
      <Card>
        <CardContent className="space-y-4 pt-6">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={`activity-skeleton-${index}`} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-lg border p-8 text-center">
      <p className="mb-4 text-sm text-muted-foreground">{message}</p>
      <Button onClick={onRetry} variant="secondary">
        重新加载
      </Button>
    </div>
  )
}
