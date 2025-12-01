import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Link from "next/link"
import { ArrowRight, Star } from "lucide-react"
import { getPosts } from "@/lib/actions/posts"
import { formatDate } from "@/lib/utils/blog-helpers"
import { logger } from "@/lib/utils/logger"

const MAX_POSTS = 6
const numberFormatter = new Intl.NumberFormat("zh-CN")

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
    <section className="px-4 py-16">
      <div className="container mx-auto">
        <div className="mb-8 flex flex-col items-center justify-between gap-4 md:flex-row">
          <h2 className="text-3xl font-bold">最新内容</h2>
          <div className="group inline-flex items-center gap-2">
            <Button variant="outline" asChild className="group bg-transparent transition-transform duration-200 group-hover:-translate-y-0.5">
              <Link href="/blog" className="flex items-center gap-2">
                查看全部
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
            </Button>
          </div>
        </div>

        {hasError && (
          <SectionState
            variant="error"
            title="内容加载失败"
            description={result.error?.message ?? "暂时无法获取最新文章，请稍后重试"}
          />
        )}

        {isEmpty && (
          <SectionState
            variant="empty"
            title="暂无已发布文章"
            description="一旦发布新的文章，它们会立即出现在这里。"
          />
        )}

        {!hasError && !isEmpty && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="group block h-full transition-transform duration-300 hover:-translate-y-1.5 hover:shadow-lg"
              >
                <Card className="from-background to-muted/20 h-full border-0 bg-gradient-to-br">
                  <CardHeader>
                    <div className="mb-2 flex items-center space-x-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={post.author.avatarUrl || undefined} alt={post.author.name || "作者头像"} />
                        <AvatarFallback>{getAuthorInitial(post.author.name)}</AvatarFallback>
                      </Avatar>
                      <span className="text-muted-foreground text-sm">{getAuthorName(post.author.name)}</span>
                      <Badge
                        variant="secondary"
                        className="transition-colors group-hover:bg-primary group-hover:text-primary-foreground"
                      >
                        {getPrimaryTag(post)}
                      </Badge>
                    </div>

                    <CardTitle className="line-clamp-2 transition-colors group-hover:text-primary">{post.title}</CardTitle>
                    <CardDescription className="line-clamp-3">
                      {post.excerpt ?? "点击查看完整内容"}
                    </CardDescription>
                  </CardHeader>

                  <CardContent>
                    <div className="text-muted-foreground flex items-center justify-between text-sm">
                      <span>{formatDate(post.publishedAt ?? post.createdAt)}</span>
                      <div className="flex items-center space-x-4">
                        <span className="flex items-center gap-1 transition-transform duration-200 group-hover:scale-105">
                          <Star className="h-3 w-3" />
                          {formatNumber(post.stats.likesCount)}
                        </span>
                        <span className="transition-transform duration-200 group-hover:translate-x-0.5">
                          {formatNumber(post.viewCount)} 阅读
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function getAuthorInitial(name: string | null): string {
  return name?.trim()?.charAt(0)?.toUpperCase() ?? "匿"
}

function getAuthorName(name: string | null): string {
  return name?.trim() || "神秘作者"
}

function getPrimaryTag(post: LatestPost): string {
  return post.tags[0]?.name ?? "未分类"
}

function formatNumber(value: number): string {
  return numberFormatter.format(value)
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
    <Card className={`border-dashed ${borderClass} bg-muted/20`}>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription className={textClass}>{description}</CardDescription>
      </CardHeader>
    </Card>
  )
}

export function LatestContentSectionSkeleton() {
  return (
    <section className="px-4 py-16">
      <div className="container mx-auto">
        <div className="mb-8 flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="h-8 w-32 animate-pulse rounded bg-muted/40" />
          <div className="h-10 w-32 animate-pulse rounded bg-muted/40" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: MAX_POSTS }).map((_, index) => (
            <div
              key={index}
              className="from-background to-muted/30 h-48 animate-pulse rounded-2xl border border-dashed border-muted/40 bg-gradient-to-br"
            />
          ))}
        </div>
      </div>
    </section>
  )
}
