"use client"

import { logger } from "@/lib/utils/logger"

import { useState } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import type { PostFormData, PostFormProps } from "@/components/admin/post-form"
import { toast } from "sonner"
import { updatePost } from "@/lib/actions/posts"
import type { UpdatePostRequest } from "@/types/api"

const PostForm = dynamic<PostFormProps>(
  () => import("@/components/admin/post-form").then((mod) => mod.PostForm),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-4">
        <div className="h-10 w-48 animate-pulse rounded-md bg-muted" />
        <div className="h-[520px] w-full animate-pulse rounded-xl bg-muted" />
      </div>
    ),
  }
)

interface EditPostClientProps {
  postId: string
  initialData: PostFormData
}

export function EditPostClient({ postId, initialData }: EditPostClientProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (data: PostFormData) => {
    setIsSubmitting(true)
    try {
      const updateData: UpdatePostRequest = {
        id: postId,
        title: data.title,
        slug: data.slug,
        content: data.content,
        excerpt: data.summary || undefined,
        published: data.isPublished,
        canonicalUrl: undefined,
        seoTitle: data.metaTitle || undefined,
        seoDescription: data.metaDescription || undefined,
        coverImage: data.coverImage || undefined,
        tagNames: data.tags,
        seriesId: undefined,
      }

      const result = await updatePost(updateData)

      if (result.success) {
        if (data.isPublished) {
          toast.success("文章更新并发布成功！")
        } else {
          toast.success("文章已更新并保存为草稿！")
        }
        router.push("/admin/blog")
      } else {
        toast.error("更新文章失败: " + result.error?.message)
      }
    } catch (error) {
      logger.error(
        "更新文章失败:",
        { error: error instanceof Error ? error.message : String(error) },
        error instanceof Error ? error : undefined
      )
      toast.error("更新文章失败，请重试")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSave = async (data: PostFormData) => {
    try {
      const saveData: UpdatePostRequest = {
        id: postId,
        title: data.title,
        slug: data.slug,
        content: data.content,
        excerpt: data.summary || undefined,
        published: false,
        canonicalUrl: undefined,
        seoTitle: data.metaTitle || undefined,
        seoDescription: data.metaDescription || undefined,
        coverImage: data.coverImage || undefined,
        tagNames: data.tags,
        seriesId: undefined,
      }

      const result = await updatePost(saveData)

      if (result.success) {
        toast.success("草稿保存成功！")
      } else {
        toast.error("保存草稿失败: " + result.error?.message)
      }
    } catch (error) {
      logger.error(
        "保存草稿失败:",
        { error: error instanceof Error ? error.message : String(error) },
        error instanceof Error ? error : undefined
      )
      toast.error("保存草稿失败，请重试")
    }
  }

  return (
    <PostForm
      mode="edit"
      initialData={initialData}
      onSubmit={handleSubmit}
      onSave={handleSave}
      isSubmitting={isSubmitting}
    />
  )
}
