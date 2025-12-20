import { getCurrentUser } from "@/lib/actions/auth"
import { getUserBookmarks } from "@/lib/interactions/bookmarks"
import { redirect } from "next/navigation"
import { BookmarkList } from "@/components/profile/bookmark-list"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Bookmark } from "lucide-react"
import Link from "next/link"
import { logger } from "@/lib/utils/logger"

export default async function BookmarksPage() {
  // 获取当前登录用户
  const user = await getCurrentUser()

  // 未登录重定向到登录页
  if (!user) {
    redirect("/login?redirect=/profile/bookmarks")
  }

  // 使用服务层直接获取初始数据
  let initialData
  try {
    const result = await getUserBookmarks(user.id, { limit: 20 })
    initialData = {
      bookmarks: result.items,
      hasMore: result.hasMore,
      nextCursor: result.nextCursor || null,
    }
  } catch (error) {
    logger.error("Error fetching initial bookmarks:", error)
    initialData = { error: "server" }
  }

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-4xl">
          {/* 页面标题 */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="icon" asChild>
                <Link href="/profile">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div className="flex items-center space-x-2">
                <Bookmark className="text-primary h-6 w-6" />
                <h1 className="text-2xl font-bold">我的收藏</h1>
              </div>
            </div>
          </div>

          {/* 收藏列表内容 */}
          {initialData.error === "server" ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-muted-foreground">
                  <p className="mb-2">加载收藏列表时出错</p>
                  <p className="text-sm">请刷新页面重试</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <BookmarkList
              userId={user.id}
              initialBookmarks={initialData.bookmarks || []}
              initialHasMore={initialData.hasMore ?? false}
              initialCursor={initialData.nextCursor ?? null}
            />
          )}
        </div>
      </div>
    </div>
  )
}
