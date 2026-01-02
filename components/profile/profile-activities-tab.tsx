"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ActivityCard } from "@/components/activity-card"
import { useActivities } from "@/hooks/use-activities"
import { Users } from "lucide-react"

interface ProfileActivitiesTabProps {
  userId: string
}

export function ProfileActivitiesTab({ userId }: ProfileActivitiesTabProps) {
  const { activities, isLoading, isError, hasMore, loadMore } = useActivities({
    authorId: userId,
    orderBy: "latest",
    limit: 10,
  })

  if (isLoading && activities.length === 0) {
    return (
      <div className="space-y-6">
        {[...Array(3)].map((_, index) => (
          <Card key={index} className="animate-pulse">
            <CardContent className="pt-6">
              <div className="mb-4 flex items-center space-x-3">
                <div className="bg-muted h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="bg-muted h-4 w-1/4 rounded" />
                  <div className="bg-muted h-3 w-1/6 rounded" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="bg-muted h-4 w-full rounded" />
                <div className="bg-muted h-4 w-5/6 rounded" />
                <div className="bg-muted h-4 w-4/6 rounded" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <Users className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <p className="text-muted-foreground mb-4">加载动态失败</p>
          <Button onClick={() => window.location.reload()} variant="outline">
            重新加载
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (activities.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <Users className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <p className="text-muted-foreground">还没有发布动态</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {activities.map((activity) => (
        <div key={activity.id} className="animate-in fade-in slide-in-from-bottom-2 duration-200">
          <ActivityCard activity={activity} showActions={true} />
        </div>
      ))}

      {hasMore && (
        <div className="py-6 text-center">
          <Button onClick={loadMore} disabled={isLoading} variant="outline">
            {isLoading ? "加载中..." : "加载更多"}
          </Button>
        </div>
      )}
    </div>
  )
}
