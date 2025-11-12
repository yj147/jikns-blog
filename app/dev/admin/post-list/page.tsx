"use client"

import { notFound } from "next/navigation"
import { PostList } from "@/components/admin/post-list"
import { useAdminPosts } from "@/hooks/use-admin-posts"
import { useRouter } from "next/navigation"
import { type Post } from "@/components/admin/post-card"

export default function AdminPostListPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  const router = useRouter()
  const { posts, isLoading, handleDelete, handleTogglePin, handleTogglePublish } = useAdminPosts()

  const handleEdit = (post: Post) => {
    router.push(`/admin/blog/edit/${post.id}`)
  }

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <PostList
          posts={posts}
          isLoading={isLoading}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onTogglePin={handleTogglePin}
          onTogglePublish={handleTogglePublish}
          onCreateNew={() => router.push("/admin/blog/create")}
        />
      </div>
    </div>
  )
}
