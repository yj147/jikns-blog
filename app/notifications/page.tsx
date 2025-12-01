import { redirect } from "next/navigation"
import { Suspense } from "react"
import { NotificationType } from "@/lib/generated/prisma"
import { getCurrentUser } from "@/lib/actions/auth"
import { NotificationList } from "@/components/notifications/notification-list"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

type FilterValue = NotificationType | "ALL"

function parseFilter(value?: string): FilterValue {
  if (!value) return "ALL"
  const upper = value.toUpperCase()
  if (upper in NotificationType) {
    return upper as NotificationType
  }
  return "ALL"
}

interface NotificationsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function NotificationsPage(props: NotificationsPageProps) {
  const searchParams = (await props.searchParams) || {}
  const initialType = parseFilter(typeof searchParams.type === "string" ? searchParams.type : undefined)

  const user = await getCurrentUser()
  if (!user) {
    redirect("/login")
  }

  return (
    <div className="container space-y-6 px-4 py-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold leading-tight">通知中心</h1>
        <p className="text-muted-foreground text-sm">查看最新动态、评论、关注与系统通知</p>
      </div>

      <Suspense
        fallback={
          <Card>
            <CardContent className="space-y-3 py-6">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        }
      >
        <NotificationList initialType={initialType} />
      </Suspense>
    </div>
  )
}
