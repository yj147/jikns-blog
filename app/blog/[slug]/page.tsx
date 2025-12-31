/**
 * 博客文章详情页面 - Social Style
 * 连接真实数据的文章详情展示页面
 */

import { Suspense } from "react"
import { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getPost } from "@/lib/actions/posts"
import { getCurrentUser } from "@/lib/actions/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { FollowButton } from "@/components/follow"
import { prisma } from "@/lib/prisma"
import {
  ArrowLeft,
  Calendar,
  Clock,
  Eye,
  Share2,
  ThumbsUp,
  MessageSquare,
  UserPlus,
} from "lucide-react"
import { PostDetail } from "@/types/blog"
import {
  formatDate,
  formatRelativeTime,
  calculateReadTime,
  formatNumber,
} from "@/lib/utils/blog-helpers"
import { interactionStyles } from "@/lib/styles/interaction-styles"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"
import CommentList from "@/components/comments/comment-list"
import { LikeButton } from "@/components/blog/like-button"
import { BookmarkButton } from "@/components/blog/bookmark-button"
import SubscribeForm from "@/components/subscribe-form"
import CommentCount from "@/components/comments/comment-count"
import { TableOfContents, TocItem } from "@/components/blog/table-of-contents"
import { cn } from "@/lib/utils"

// 强制动态渲染，避免缓存新文章的 404 响应
export const dynamic = "force-dynamic"

// 页面参数接口
interface BlogPostPageProps {
  params: Promise<{ slug: string }>
}

// 简单的 ID 生成器，需要与 rehype-slug 的逻辑尽量保持一致
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function extractHeadings(content: string): TocItem[] {
  const regex = /^(#{2,3})\s+(.+)$/gm
  const headings: TocItem[] = []
  const seenIds = new Map<string, number>()
  let match

  while ((match = regex.exec(content)) !== null) {
    const level = match[1].length
    const text = match[2].trim()
    let id = slugify(text)

    // Fallback for empty slugs (e.g. only special chars)
    if (!id) {
      id = `heading`
    }

    // Ensure uniqueness
    if (seenIds.has(id)) {
      const count = seenIds.get(id)!
      seenIds.set(id, count + 1)
      id = `${id}-${count}`
    } else {
      seenIds.set(id, 1)
    }

    headings.push({
      id,
      text,
      level,
    })
  }

  return headings
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
  const coverImage = post.signedCoverImage ?? post.coverImage
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
      images: coverImage ? [coverImage] : undefined,
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

  const [result, currentUser] = await Promise.all([getPost(slug), getCurrentUser()])

  // 处理文章不存在的情况
  if (!result.success || !result.data) {
    notFound()
  }

  const post: PostDetail = result.data

  // 检查文章是否已发布（防止访问草稿）
  if (!post.published) {
    notFound()
  }

  const isOwnPost = currentUser?.id === post.author.id

  // 异步增加浏览量（不阻塞首屏渲染）
  void prisma.post
    .update({
      where: { id: post.id },
      data: { viewCount: { increment: 1 } },
    })
    .catch(() => null)

  let viewerFollowsAuthor = false

  if (currentUser && !isOwnPost) {
    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: currentUser.id,
          followingId: post.author.id,
        },
      },
      select: { followerId: true },
    })
    viewerFollowsAuthor = !!existingFollow
  }

  const content = post.contentSigned ?? post.content
  const toc = extractHeadings(content)

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto grid grid-cols-1 gap-8 px-4 py-8 lg:grid-cols-12">
        {/* Back Button Area - Optional, maybe top left? */}

        {/* Main Content */}
        <main className="border-border col-span-1 lg:col-span-8 lg:border-r lg:pr-8">
          <article>
            {/* Navigation Breadcrumb */}
            <div className="mb-6">
              <Link
                href="/blog"
                prefetch={false}
                className="text-muted-foreground hover:text-primary flex items-center gap-1 text-sm transition-colors"
              >
                <ArrowLeft className="h-3 w-3" />
                返回动态
              </Link>
            </div>

            {/* 文章头部 */}
            <header className="mb-8">
              <h1 className="mb-4 text-3xl font-bold leading-tight tracking-tight lg:text-4xl">
                {post.title}
              </h1>

              <div className="mb-6 flex items-center gap-3">
                <Link href={`/profile/${post.author.id ?? "#"}`} prefetch={false}>
                  <Avatar className="ring-background h-10 w-10 ring-2">
                    <AvatarImage
                      src={post.author.avatarUrl || "/placeholder.svg"}
                      alt={post.author.name || "匿名用户"}
                    />
                    <AvatarFallback>
                      {(post.author.name || "匿名用户")[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Link>
                <div>
                  <p className="text-sm font-bold">
                    {post.author.name || "匿名用户"}
                    <span className="text-muted-foreground ml-2 text-xs font-normal">
                      · {formatRelativeTime(post.publishedAt)}
                    </span>
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {calculateReadTime(post.content)} · {formatNumber(post.viewCount)} 阅读
                  </p>
                </div>
              </div>

              {/* Action Bar */}
              <div className="border-border flex items-center gap-4 border-y py-3">
                <LikeButton
                  targetId={post.id}
                  targetType="post"
                  initialCount={post.stats.likesCount}
                  variant="ghost"
                  size="sm"
                  className={cn("text-muted-foreground", interactionStyles.like)}
                />
                <div className="text-muted-foreground flex items-center gap-1 text-sm">
                  <MessageSquare className="h-4 w-4" />
                  <CommentCount
                    targetType="post"
                    targetId={post.id}
                    initialCount={post.stats.commentsCount}
                  />
                </div>
                <BookmarkButton
                  postId={post.id}
                  initialCount={post.stats.bookmarksCount}
                  variant="ghost"
                  size="sm"
                  className={cn("text-muted-foreground ml-auto", interactionStyles.bookmark)}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn("text-muted-foreground", interactionStyles.share)}
                >
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            </header>

            {/* 文章内容 */}
            <div className="mb-16">
              <MarkdownRenderer content={content} className="text-foreground leading-relaxed" />
            </div>

            {/* 文章底部作者卡片 */}
            <div className="border-border mb-12 rounded-xl border p-6">
              <div className="flex items-start gap-4">
                <Avatar className="h-14 w-14">
                  <AvatarImage
                    src={post.author.avatarUrl || "/placeholder.svg"}
                    alt={post.author.name || "匿名用户"}
                  />
                  <AvatarFallback>
                    {(post.author.name || "匿名用户")[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold">{post.author.name || "匿名用户"}</h3>
                    {!isOwnPost &&
                      (currentUser ? (
                        <FollowButton
                          targetUserId={post.author.id}
                          size="sm"
                          initialFollowing={viewerFollowsAuthor}
                          className="rounded-full"
                        />
                      ) : (
                        <Button variant="outline" size="sm" className="rounded-full" asChild>
                          <Link href="/login">
                            <UserPlus className="mr-1 h-3 w-3" />
                            登录后关注
                          </Link>
                        </Button>
                      ))}
                  </div>
                  {post.author.bio && (
                    <p className="text-muted-foreground text-sm">{post.author.bio}</p>
                  )}
                </div>
              </div>
            </div>
          </article>

          {/* 评论区域 */}
          <section className="border-border mt-12 border-t pt-8">
            <h3 className="mb-6 text-xl font-bold">
              评论 (
              <CommentCount
                targetType="post"
                targetId={post.id}
                initialCount={post.stats.commentsCount}
              />
              )
            </h3>
            <CommentList
              targetType="post"
              targetId={post.id}
              showComposer
              showTitle={false}
              initialCount={post.stats.commentsCount}
            />
          </section>
        </main>

        {/* 侧边栏 */}
        <Suspense
          fallback={
            <div className="hidden lg:col-span-4 lg:block">
              <div className="bg-muted/30 h-64 animate-pulse rounded-xl" />
            </div>
          }
        >
          <BlogSidebar post={post} toc={toc} />
        </Suspense>
      </div>
    </div>
  )
}

// 博客侧边栏组件
function BlogSidebar({ post, toc }: { post: PostDetail; toc: TocItem[] }) {
  return (
    <aside className="hidden pl-4 lg:col-span-4 lg:block">
      <div className="sticky top-24 space-y-8">
        {/* 目录 - 如果有标题则显示 */}
        {toc.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-muted-foreground text-sm font-bold uppercase tracking-wider">
              目录
            </h3>
            <TableOfContents items={toc} />
          </div>
        )}

        {/* 系列信息 */}
        {post.series && (
          <div className="bg-muted/30 rounded-xl border-none p-4">
            <h3 className="mb-2 text-sm font-bold">所属系列</h3>
            <div>
              <Link href={`/blog?series=${post.series.slug}`} prefetch={false}>
                <h4 className="text-primary cursor-pointer font-medium hover:underline">
                  {post.series.title}
                </h4>
              </Link>
            </div>
          </div>
        )}

        {/* 相关标签 */}
        {post.tags.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-muted-foreground text-sm font-bold uppercase tracking-wider">
              标签
            </h3>
            <div className="flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <Link key={tag.id} href={`/blog?tag=${tag.slug}`} prefetch={false}>
                  <Badge
                    variant="secondary"
                    className="hover:bg-primary hover:text-primary-foreground cursor-pointer transition-colors"
                  >
                    {tag.name}
                  </Badge>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* 订阅小部件 */}
        <div className="bg-muted/30 rounded-xl p-4">
          <h3 className="mb-2 text-sm font-bold">订阅更新</h3>
          <SubscribeForm />
        </div>
      </div>
    </aside>
  )
}
