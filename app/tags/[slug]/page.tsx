/**
 * 标签详情页
 * Phase 10 - M3 阶段
 */

import { cache } from "react"
import { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { getTag } from "@/lib/actions/tags"
import { getPosts } from "@/lib/actions/posts"
import { BlogPostCard } from "@/components/blog/blog-post-card"
import { ClientPagination } from "@/components/blog/client-pagination"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Hash, FileText, ArrowLeft, AlertCircle } from "lucide-react"
import { PostListItem } from "@/types/blog"
import { logger } from "@/lib/utils/logger"

interface TagDetailPageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string }>
}

const resolveTag = cache(async (slug: string) => {
  const result = await getTag(slug)
  if (!result.success || !result.data) {
    return null
  }
  return result.data.tag
})

// 生成页面元数据
export async function generateMetadata({ params }: TagDetailPageProps): Promise<Metadata> {
  const { slug } = await params
  const tag = await resolveTag(slug)

  if (!tag) {
    return {
      title: "标签不存在",
    }
  }

  const title = `${tag.name} - 标签详情`
  const description = tag.description || `浏览所有关于 ${tag.name} 的文章，共 ${tag.postsCount} 篇`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
    },
  }
}

export default async function TagDetailPage({ params, searchParams }: TagDetailPageProps) {
  const { slug } = await params
  const { page: pageParam } = await searchParams
  const parsedPage = Number.parseInt(pageParam ?? "", 10)
  const currentPage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1

  // 获取标签信息
  const tag = await resolveTag(slug)

  if (!tag) {
    notFound()
  }

  // 获取该标签下的文章列表
  const postsResult = await getPosts({
    page: currentPage,
    limit: 10,
    tag: slug,
    published: true,
    orderBy: "publishedAt",
    order: "desc",
  })

  let posts: PostListItem[] = []
  const pagination = postsResult.success ? postsResult.pagination : null
  let postsError: { code?: string; message: string } | null = null

  if (postsResult.success && postsResult.data) {
    posts = postsResult.data.map((post) => ({
      ...post,
      publishedAt: post.publishedAt || post.createdAt,
      tags: post.tags.map((tag) => ({
        ...tag,
        id: `${post.id}_${tag.slug}`, // 为标签生成复合ID
      })),
    }))
  } else {
    postsError = {
      code: postsResult.error?.code,
      message: postsResult.error?.message || "获取文章列表失败",
    }
    logger.error("标签详情文章列表加载失败", {
      slug,
      code: postsResult.error?.code,
    })
  }

  const totalPages = Math.max(1, pagination?.totalPages || 1)

  return (
    <div className="bg-background min-h-screen">

      <div className="container mx-auto px-4 py-12">
        {/* 返回按钮 */}
        <div className="mb-8">
          <Link href="/tags">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回标签云
            </Button>
          </Link>
        </div>

        {/* 标签信息头部 */}
        <div className="mb-12">
          <Card className="border-2">
            <CardContent className="p-8">
              <div className="flex flex-col items-center text-center md:flex-row md:text-left">
                {/* 标签图标 */}
                <div
                  className="mb-4 rounded-full p-6 md:mb-0 md:mr-6"
                  style={{
                    backgroundColor: tag.color ? `${tag.color}20` : "#3B82F620",
                  }}
                >
                  <Hash
                    className="h-12 w-12"
                    style={{
                      color: tag.color || "#3B82F6",
                    }}
                  />
                </div>

                {/* 标签信息 */}
                <div className="flex-1">
                  <div className="mb-2 flex flex-wrap items-center justify-center gap-2 md:justify-start">
                    <h1 className="text-3xl font-bold">{tag.name}</h1>
                    <Badge variant="secondary" className="text-sm">
                      <FileText className="mr-1 h-3 w-3" />
                      {tag.postsCount} 篇文章
                    </Badge>
                  </div>

                  {tag.description && (
                    <p className="text-muted-foreground mt-2 text-lg">{tag.description}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 文章列表 */}
        {postsError ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <AlertCircle className="text-destructive mb-2 h-12 w-12" />
              <h3 className="text-lg font-semibold">文章加载失败</h3>
              <p className="text-muted-foreground">
                {postsError.message}
                {postsError.code ? `（错误代码：${postsError.code}）` : ""}
              </p>
              <Button asChild variant="outline" size="sm">
                <Link href={`/tags/${slug}?page=${currentPage}`}>重新加载</Link>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link href="/blog">浏览全部文章</Link>
              </Button>
            </CardContent>
          </Card>
        ) : posts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <AlertCircle className="text-muted-foreground mb-4 h-12 w-12" />
              <h3 className="mb-2 text-lg font-semibold">暂无文章</h3>
              <p className="text-muted-foreground mb-4">该标签下还没有发布的文章</p>
              <Link href="/blog">
                <Button>浏览所有文章</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="mb-8 space-y-6">
              {posts.map((post, index) => (
                <BlogPostCard key={post.id} post={post} index={index} />
              ))}
            </div>

            {/* 分页 */}
            {totalPages > 1 && pagination && (
              <div className="mt-12">
                <ClientPagination pagination={pagination} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
