/**
 * 博客列表页面 - Social Feed Style
 * 连接真实数据的博客文章展示页面
 */

import { Suspense } from "react"
import { Metadata } from "next"
import { getPosts } from "@/lib/actions/posts"
import { getPopularTags } from "@/lib/actions/tags"
import { BlogSearchFilter } from "@/components/blog/blog-search-filter"
import { TagFilter } from "@/components/blog/tag-filter"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { BlogPageSearchParams, PostListItem } from "@/types/blog"
import {
  generatePageTitle,
  generatePageDescription,
  parseSearchParams,
} from "@/lib/utils/blog-helpers"
import Link from "next/link"
import { logger } from "@/lib/utils/logger"
import { Sparkles, Newspaper } from "lucide-react"
import { BlogListClient } from "@/components/blog/blog-list-client"

// 页面参数接口
interface BlogPageProps {
  searchParams: Promise<BlogPageSearchParams>
}

// 生成页面元数据
export async function generateMetadata({ searchParams }: BlogPageProps): Promise<Metadata> {
  const params = await searchParams
  const { q, tag, page } = parseSearchParams(new URLSearchParams(params as any))

  const title = generatePageTitle("博客动态", q, tag, page)
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
  }

  const posts: PostListItem[] = result.success
    ? result.data.map((post) => ({
        ...post,
        tags: post.tags.map((tag) => ({
          ...tag,
          id: `${post.id}_${tag.slug}`,
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
      <div className="container mx-auto grid grid-cols-1 gap-8 px-4 py-6 lg:grid-cols-12">
        
        {/* Main Feed Column */}
        <main className="col-span-1 lg:col-span-8">
            {/* Sticky Header */}
            <div className="sticky top-16 z-30 mb-0 border-b border-border bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <Newspaper className="h-5 w-5 text-primary" />
                        {q ? `搜索: ${q}` : tag ? `标签: ${tag}` : "博客动态"}
                    </h1>
                     {/* Mobile Search Toggle or simple info could go here */}
                     <span className="text-xs text-muted-foreground font-medium">
                         {pagination.total} 篇文章
                     </span>
                </div>
                
                {/* Compact Filter Bar */}
                 <div className="mt-4">
                    <Suspense fallback={<div className="h-10 animate-pulse bg-muted rounded" />}>
                        <BlogSearchFilter className="" popularTags={popularTags} />
                    </Suspense>
                </div>
            </div>

            {/* Posts Feed */}
            <div className="min-h-[50vh]">
              <BlogListClient
                initialPosts={posts}
                initialPagination={{
                  total: pagination.total,
                  hasNext: pagination.hasNext,
                  nextCursor: pagination.hasNext ? String((pagination.page ?? 1) + 1) : null,
                }}
                searchQuery={q || undefined}
                tagFilter={tag || undefined}
                sortBy={sort || undefined}
              />
            </div>
        </main>

        {/* Sidebar Column */}
        <aside className="hidden lg:col-span-4 lg:block">
          <div className="sticky top-24 space-y-6">
            
            {/* Tags Widget */}
            <Card className="border-none bg-muted/30 shadow-none">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-purple-500" />
                        热门话题
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <TagFilter
                        className="shadow-none p-0"
                        limit={popularTags?.length ?? 12}
                        initialTags={popularTags}
                    />
                </CardContent>
            </Card>

            {/* Newsletter Widget */}
            <Card className="border-none bg-muted/30 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold">订阅更新</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Input placeholder="your@email.com" type="email" className="bg-background" />
                  <Button className="w-full font-bold">订阅周刊</Button>
                  <p className="text-xs text-muted-foreground text-center">
                      每周一发送，随时取消订阅
                  </p>
                </div>
              </CardContent>
            </Card>

             {/* Footer Links */}
             <div className="px-4 text-xs text-muted-foreground">
                <div className="flex flex-wrap gap-2">
                    <Link href="#" className="hover:underline">关于</Link>
                    <Link href="#" className="hover:underline">帮助</Link>
                    <Link href="#" className="hover:underline">API</Link>
                    <Link href="#" className="hover:underline">隐私</Link>
                    <Link href="#" className="hover:underline">条款</Link>
                </div>
                <p className="mt-2">&copy; 2025 现代博客平台</p>
             </div>

          </div>
        </aside>
      </div>
    </div>
  )
}
