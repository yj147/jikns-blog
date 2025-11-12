/**
 * 博客文章详情页面 - Phase 5.2
 * 连接真实数据的文章详情展示页面
 */

import { Suspense } from "react"
import { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getPost } from "@/lib/actions/posts"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Calendar, Clock, Eye, Heart, Share2, Bookmark, ThumbsUp } from "lucide-react"
import { PostDetail } from "@/types/blog"
import {
  formatDate,
  formatRelativeTime,
  calculateReadTime,
  formatNumber,
} from "@/lib/utils/blog-helpers"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"

// 页面参数接口
interface BlogPostPageProps {
  params: Promise<{ slug: string }>
}

// 生成页面元数据
export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params
  const result = await getPost(slug)

  if (!result.success || !result.data) {
    return {
      title: "文章不存在",
      description: "您查找的文章不存在或已被删除",
    }
  }

  const post = result.data
  const title = post.seoTitle || post.title
  const description =
    post.seoDescription ||
    post.excerpt ||
    `阅读 ${post.title} - ${post.author.name || "匿名用户"} 的文章`

  return {
    title: `${title} | 技术博客`,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      publishedTime: post.publishedAt || undefined,
      modifiedTime: post.updatedAt,
      authors: [post.author.name || "匿名用户"],
      tags: post.tags.map((tag) => tag.name),
      images: post.coverImage ? [post.coverImage] : undefined,
    },
    alternates: {
      canonical: post.canonicalUrl || undefined,
    },
    keywords: post.tags.map((tag) => tag.name).join(", "),
  }
}

// 博客文章详情页面主组件
export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params

  // 获取文章数据并增加浏览量
  const result = await getPost(slug, { incrementView: true })

  // 处理文章不存在的情况
  if (!result.success || !result.data) {
    notFound()
  }

  const post: PostDetail = result.data

  // 检查文章是否已发布（防止访问草稿）
  if (!post.published) {
    notFound()
  }

  return (
    <div className="bg-background min-h-screen">

      <div className="container mx-auto px-4 py-8">
        {/* 返回按钮 */}
        <Button variant="ghost" asChild className="mb-6">
          <Link href="/blog">
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回博客列表
          </Link>
        </Button>

        <div className="grid gap-8 lg:grid-cols-4">
          {/* 主要内容 */}
          <div className="lg:col-span-3">
            <article>
              {/* 文章头部 */}
              <header className="mb-8">
                {/* 文章标签 */}
                {post.tags.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {post.tags.map((tag) => (
                      <Link key={tag.id} href={`/blog?tag=${tag.slug}`}>
                        <Badge
                          variant="secondary"
                          className="hover:bg-primary hover:text-primary-foreground cursor-pointer transition-colors"
                        >
                          {tag.name}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                )}

                {/* 文章标题 */}
                <h1 className="mb-4 text-4xl font-bold leading-tight">{post.title}</h1>

                {/* 作者信息和文章元数据 */}
                <div className="mb-6 flex items-center space-x-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage
                      src={post.author.avatarUrl || "/placeholder.svg"}
                      alt={post.author.name || "匿名用户"}
                    />
                    <AvatarFallback>
                      {(post.author.name || "匿名用户")[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{post.author.name || "匿名用户"}</p>
                    <div className="text-muted-foreground flex items-center space-x-4 text-sm">
                      <span className="flex items-center" title={formatDate(post.publishedAt)}>
                        <Calendar className="mr-1 h-3 w-3" />
                        {formatRelativeTime(post.publishedAt)}
                      </span>
                      <span className="flex items-center">
                        <Clock className="mr-1 h-3 w-3" />
                        {calculateReadTime(post.content)}
                      </span>
                      <span className="flex items-center">
                        <Eye className="mr-1 h-3 w-3" />
                        {formatNumber(post.viewCount)} 阅读
                      </span>
                    </div>
                  </div>
                </div>

                {/* 互动按钮 */}
                <div className="flex items-center space-x-4">
                  <Button variant="outline" size="sm">
                    <Heart className="mr-2 h-4 w-4" />
                    {formatNumber(post.stats.likesCount)}
                  </Button>
                  <Button variant="outline" size="sm">
                    <Bookmark className="mr-2 h-4 w-4" />
                    收藏
                  </Button>
                  <Button variant="outline" size="sm">
                    <Share2 className="mr-2 h-4 w-4" />
                    分享
                  </Button>
                </div>
              </header>

              {/* 文章内容 */}
              <div className="mb-12">
                <MarkdownRenderer
                  content={post.content}
                  className="text-foreground leading-relaxed"
                />
              </div>

              {/* 文章底部 */}
              <footer className="border-t pt-8">
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <Button variant="outline" size="sm">
                      <ThumbsUp className="mr-2 h-4 w-4" />
                      有帮助 ({formatNumber(post.stats.likesCount)})
                    </Button>
                    <Button variant="outline" size="sm">
                      <Share2 className="mr-2 h-4 w-4" />
                      分享文章
                    </Button>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    最后更新：{formatDate(post.updatedAt)}
                  </p>
                </div>

                {/* 作者简介 */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-start space-x-4">
                      <Avatar className="h-16 w-16">
                        <AvatarImage
                          src={post.author.avatarUrl || "/placeholder.svg"}
                          alt={post.author.name || "匿名用户"}
                        />
                        <AvatarFallback>
                          {(post.author.name || "匿名用户")[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <h3 className="mb-2 text-lg font-semibold">
                          {post.author.name || "匿名用户"}
                        </h3>
                        {post.author.bio && (
                          <p className="text-muted-foreground mb-3">{post.author.bio}</p>
                        )}
                        <Button variant="outline" size="sm">
                          关注作者
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </footer>
            </article>

            {/* 评论区域 */}
            <section className="mt-12">
              <h2 className="mb-6 text-2xl font-bold">
                评论 ({formatNumber(post.stats.commentsCount)})
              </h2>

              {/* 评论表单 */}
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle className="text-lg">发表评论</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Textarea placeholder="写下你的想法..." className="min-h-[100px]" />
                    <div className="flex justify-end">
                      <Button>发布评论</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 评论列表占位 - 暂时显示评论功能待实现的提示 */}
              <div className="text-muted-foreground py-12 text-center">
                <p>评论功能即将上线，敬请期待！</p>
              </div>
            </section>
          </div>

          {/* 侧边栏 */}
          <Suspense
            fallback={
              <div className="lg:col-span-1">
                <div className="sticky top-24 space-y-6">
                  <div className="bg-muted/50 h-32 animate-pulse rounded" />
                  <div className="bg-muted/50 h-48 animate-pulse rounded" />
                </div>
              </div>
            }
          >
            <BlogSidebar post={post} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

// 博客侧边栏组件
function BlogSidebar({ post }: { post: PostDetail }) {
  return (
    <div className="lg:col-span-1">
      <div className="sticky top-24 space-y-6">
        {/* 文章信息卡片 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">文章信息</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">发布时间</span>
                <span>{formatDate(post.publishedAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">阅读量</span>
                <span>{formatNumber(post.viewCount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">点赞数</span>
                <span>{formatNumber(post.stats.likesCount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">预计阅读</span>
                <span>{calculateReadTime(post.content)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 系列信息 */}
        {post.series && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">文章系列</CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Link href={`/blog?series=${post.series.slug}`}>
                  <h3 className="hover:text-primary cursor-pointer font-medium transition-colors">
                    {post.series.title}
                  </h3>
                </Link>
                {post.series.description && (
                  <p className="text-muted-foreground mt-1 text-sm">{post.series.description}</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 相关标签 */}
        {post.tags.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">相关标签</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <Link key={tag.id} href={`/blog?tag=${tag.slug}`}>
                    <Badge
                      variant="outline"
                      className="hover:bg-primary hover:text-primary-foreground cursor-pointer transition-colors"
                    >
                      {tag.name}
                    </Badge>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
