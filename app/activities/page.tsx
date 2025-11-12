import { Suspense } from "react"
import { Metadata } from "next"
import { ActivityList } from "@/components/activity/activity-list"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"

export const metadata: Metadata = {
  title: "动态 - 现代化博客",
  description: "查看最新的动态、分享和讨论",
}

function ActivityListSkeleton() {
  return (
    <div className="space-y-6">
      {/* 发布器骨架 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex space-x-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1">
              <Skeleton className="mb-4 h-20 w-full" />
              <div className="flex items-center justify-between">
                <div className="flex space-x-2">
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-8 w-8" />
                </div>
                <Skeleton className="h-8 w-16" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 工具栏骨架 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-16" />
        </div>
      </div>

      {/* 动态列表骨架 */}
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="pt-6">
            <div className="flex space-x-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center space-x-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-16 w-full" />
                <div className="flex space-x-4">
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default function ActivitiesPage() {
  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto max-w-4xl px-4 py-8">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold">动态</h1>
          <p className="text-muted-foreground">分享你的想法，与大家交流互动</p>
        </div>

        {/* 动态列表 */}
        <Suspense fallback={<ActivityListSkeleton />}>
          <ActivityList showComposer={true} showFilters={true} limit={20} />
        </Suspense>
      </div>
    </div>
  )
}
