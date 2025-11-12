/**
 * 博客列表页面 - Phase 5.2
 * 连接真实数据的博客文章展示页面
 */

import { Suspense } from "react"
import { Metadata } from "next"
import { getPosts } from "@/lib/actions/posts"
import { getPopularTags } from "@/lib/actions/tags"
import { BlogPostCard } from "@/components/blog/blog-post-card"
import { BlogPagination } from "@/components/blog/blog-pagination"
import { BlogSearchFilter } from "@/components/blog/blog-search-filter"
import { TagFilter } from "@/components/blog/tag-filter"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
// motion 组件将在客户端组件中使用，服务器组件不导入
import { BlogPageSearchParams, PostListItem } from "@/types/blog"
import {
  generatePageTitle,
  generatePageDescription,
  parseSearchParams,
} from "@/lib/utils/blog-helpers"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ClientPagination } from "@/components/blog/client-pagination"
import { logger } from "@/lib/utils/logger"

// 页面参数接口
interface BlogPageProps {
  searchParams: Promise<BlogPageSearchParams>
}

// 生成页面元数据
export async function generateMetadata({ searchParams }: BlogPageProps): Promise<Metadata> {
  const params = await searchParams
  const { q, tag, page } = parseSearchParams(new URLSearchParams(params as any))

  const title = generatePageTitle("技术博客", q, tag, page)
  const description = generatePageDescription(q, tag)

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

// 博客列表页面主组件
export default async function BlogPage({ searchParams }: BlogPageProps) {
  const params = await searchParams
  const { page, q, tag, sort } = parseSearchParams(new URLSearchParams(params as any))

  // 获取博客文章数据与热门标签
  const [result, popularTagsResult] = await Promise.all([
    getPosts({
      page,
      limit: 10,
      q: q || undefined,
      tag: tag || undefined,
      published: true,
      orderBy: sort === "viewCount" ? "viewCount" : "publishedAt",
      order: "desc",
    }),
    getPopularTags(12),
  ])

  // 处理数据获取失败
  if (!result.success) {
    logger.error("获取博客文章失败", { module: "app/blog/page" }, result.error)
    // 可以显示错误页面或者空状态
  }

  const posts: PostListItem[] = result.success
    ? result.data.map((post) => ({
        ...post,
        tags: post.tags.map((tag) => ({
          ...tag,
          id: `${post.id}_${tag.slug}`, // 为标签生成ID
        })),
      }))
    : []
  const pagination = result.pagination || {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  }

  const popularTags = popularTagsResult.success ? (popularTagsResult.data?.tags ?? []) : undefined

  return (
    <div className="bg-background min-h-screen">

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="mb-4 text-4xl font-bold">
            {q ? `"${q}" 搜索结果` : tag ? `${tag} 标签文章` : "博客文章"}
          </h1>
          <p className="text-muted-foreground text-lg">
            {q || tag
              ? `找到 ${pagination.total} 篇相关文章`
              : "探索技术前沿，分享深度思考，与你一起成长"}
          </p>
        </div>

        {/* Search and Filter */}
        <Suspense fallback={<div className="bg-muted/50 mb-8 h-16 animate-pulse rounded-lg" />}>
          <BlogSearchFilter className="mb-8" popularTags={popularTags} />
        </Suspense>

        <div className="grid gap-8 lg:grid-cols-4">
          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* 文章列表 */}
            {posts.length > 0 ? (
              <div className="space-y-6">
                {posts.map((post, index) => (
                  <BlogPostCard key={post.id} post={post} index={index} />
                ))}
              </div>
            ) : (
              <div className="py-16 text-center">
                <div className="mb-4 text-6xl">📝</div>
                <h3 className="mb-2 text-xl font-semibold">
                  {q || tag ? "没有找到相关文章" : "还没有发布任何文章"}
                </h3>
                <p className="text-muted-foreground mb-6">
                  {q && `尝试搜索其他关键词，或者`}
                  {tag && `浏览其他标签的文章，或者`}
                  {"回到首页浏览所有内容"}
                </p>
                <Button asChild>
                  <Link href={q || tag ? "/blog" : "/"}>
                    {q || tag ? "浏览所有文章" : "回到首页"}
                  </Link>
                </Button>
              </div>
            )}

            {/* Pagination */}
            {posts.length > 0 && (
              <Suspense
                fallback={
                  <div className="mt-12 flex justify-center">
                    <div className="bg-muted/50 h-10 w-64 animate-pulse rounded" />
                  </div>
                }
              >
                <ClientPagination pagination={pagination} className="mt-12" />
              </Suspense>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="space-y-6">
              <TagFilter
                className="transition-shadow hover:shadow-lg"
                limit={popularTags?.length ?? 12}
                initialTags={popularTags}
              />

              {/* Recent Posts */}
              <Card className="transition-shadow hover:shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg">最新文章</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {posts.slice(0, 3).map((post) => (
                      <div key={post.id} className="flex space-x-3">
                        <div className="min-w-0 flex-1">
                          <Link href={`/blog/${post.slug}`}>
                            <p className="hover:text-primary line-clamp-2 cursor-pointer text-sm font-medium transition-colors">
                              {post.title}
                            </p>
                          </Link>
                          <p className="text-muted-foreground mt-1 text-xs">
                            {new Date(post.publishedAt || post.createdAt).toLocaleDateString(
                              "zh-CN"
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Newsletter */}
              <Card className="transition-shadow hover:shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg">订阅更新</CardTitle>
                  <CardDescription>获取最新文章推送</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <Input placeholder="输入邮箱地址" type="email" />
                    <Button className="w-full">订阅</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
