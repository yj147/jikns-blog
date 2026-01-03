import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "@/components/app-link"
import { ArrowRight, RefreshCw } from "lucide-react"
import { getPosts } from "@/lib/actions/posts"
import { logger } from "@/lib/utils/logger"
import { BlogPostCard } from "@/components/blog/blog-post-card"
import { PostListItem } from "@/types/blog"

const MAX_POSTS = 10

type PostsResult = Awaited<ReturnType<typeof getPosts>>
type LatestPost = NonNullable<PostsResult["data"]>[number]

export async function LatestContentSection() {
  const result = await getPosts({
    page: 1,
    limit: MAX_POSTS,
    published: true,
    orderBy: "publishedAt",
    order: "desc",
  })

  if (!result.success) {
    logger.error("最新内容加载失败", { module: "components/latest-content-section" }, result.error)
  }

  const posts: LatestPost[] = result.success && result.data ? result.data : []
  const hasError = !result.success
  const isEmpty = !hasError && posts.length === 0

  return (
    <div className="border-border bg-background/50 min-h-screen w-full border-x">
      <div className="bg-background/80 border-border sticky top-16 z-30 flex items-center justify-between border-b px-4 py-3 backdrop-blur-md">
        <h2 className="text-lg font-bold">主页</h2>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Composer Placeholder - 模拟发帖框 */}
      <div className="border-border hidden border-b px-4 py-4 md:block">
        <div className="flex gap-4">
          <div className="bg-muted h-10 w-10 animate-pulse rounded-full" />
          <div className="flex-1">
            <div className="bg-muted/30 text-muted-foreground flex h-10 w-full cursor-not-allowed items-center rounded-full px-4 text-sm">
              有什么新鲜事？
            </div>
          </div>
        </div>
      </div>

      {hasError && (
        <div className="p-4">
          <SectionState
            variant="error"
            title="无法加载动态"
            description={result.error?.message ?? "请检查网络连接"}
          />
        </div>
      )}

      {isEmpty && (
        <div className="p-4">
          <SectionState variant="empty" title="暂无动态" description="关注更多人来充实你的时间线" />
        </div>
      )}

      {!hasError && !isEmpty && (
        <div className="divide-border divide-y">
          {posts.map((post, index) => (
            <BlogPostCard key={post.id} post={post as unknown as PostListItem} index={index} />
          ))}
          <div className="p-8 text-center">
            <Button variant="ghost" asChild className="text-primary hover:bg-primary/10">
              <Link href="/blog">查看更多历史文章</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

type SectionStateProps = {
  variant: "error" | "empty"
  title: string
  description: string
}

function SectionState({ variant, title, description }: SectionStateProps) {
  const borderClass = variant === "error" ? "border-destructive/40" : "border-muted/40"
  const textClass = variant === "error" ? "text-destructive" : "text-muted-foreground"

  return (
    <Card className={`border-dashed ${borderClass} bg-muted/20 shadow-none`}>
      <CardHeader className="py-8 text-center">
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription className={textClass}>{description}</CardDescription>
      </CardHeader>
    </Card>
  )
}

export function LatestContentSectionSkeleton() {
  return (
    <div className="border-border w-full border-x">
      <div className="border-border border-b px-4 py-3">
        <div className="bg-muted h-6 w-24 animate-pulse rounded" />
      </div>
      <div className="divide-border divide-y">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex gap-4 p-4">
            <div className="bg-muted h-10 w-10 shrink-0 animate-pulse rounded-full" />
            <div className="flex-1 space-y-3">
              <div className="flex gap-2">
                <div className="bg-muted h-4 w-24 animate-pulse rounded" />
                <div className="bg-muted h-4 w-12 animate-pulse rounded" />
              </div>
              <div className="bg-muted h-4 w-3/4 animate-pulse rounded" />
              <div className="bg-muted h-4 w-1/2 animate-pulse rounded" />
              <div className="bg-muted mt-2 h-48 w-full animate-pulse rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
