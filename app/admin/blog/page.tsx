import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { getPostsForAdmin } from "@/lib/actions/posts"
import AdminBlogListClient, { type AdminBlogPostDTO } from "./_components/admin-blog-list-client"

export default async function AdminBlogPage() {
  const result = await getPostsForAdmin({ limit: 50, orderBy: "updatedAt" })
  const posts = result.data.map(serializePost)
  const errorMessage = result.success ? null : result.error?.message ?? "获取文章列表失败"

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">文章管理</h1>
        <p className="text-muted-foreground">审阅并维护所有博文内容</p>
      </div>
      {errorMessage && (
        <Alert variant="destructive">
          <AlertTitle>文章列表加载失败</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
      <AdminBlogListClient initialPosts={posts} />
    </section>
  )
}

type AdminPostsResult = Awaited<ReturnType<typeof getPostsForAdmin>>
type AdminPostSource = AdminPostsResult["data"][number]

function serializePost(post: AdminPostSource): AdminBlogPostDTO {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    summary: post.excerpt,
    coverImage: post.signedCoverImage ?? post.coverImage ?? undefined,
    tags: post.tags.map((tag) => tag.name),
    isPublished: post.published,
    isPinned: post.isPinned,
    createdAt: post.createdAt,
    updatedAt: post.publishedAt ?? post.createdAt,
    views: post.viewCount,
    likes: post.stats.likesCount,
    comments: post.stats.commentsCount,
    author: {
      id: post.author.id,
      name: post.author.name,
      avatar: post.author.avatarUrl ?? undefined,
    },
  }
}
