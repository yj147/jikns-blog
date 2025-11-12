"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import dynamic from "next/dynamic"
import type { PostFormData, PostFormProps } from "@/components/admin/post-form"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { createPost } from "@/lib/actions/posts"
import { logger } from "@/lib/utils/logger"
import type { CreatePostRequest } from "@/types/api"

const PostForm = dynamic<PostFormProps>(
  () => import("@/components/admin/post-form").then((mod) => mod.PostForm),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[520px] w-full" />
      </div>
    ),
  }
)

export default function CreatePostPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 处理表单提交（创建并发布）
  const handleSubmit = async (data: PostFormData) => {
    setIsSubmitting(true)
    try {
      // 转换数据格式
      const createData: CreatePostRequest = {
        title: data.title,
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

      const result = await createPost(createData)

      if (result.success) {
        // 显示成功提示
        if (data.isPublished) {
          toast.success("文章创建并发布成功！")
        } else {
          toast.success("文章已保存为草稿！")
        }

        // 重定向到文章列表页面
        router.push("/admin/blog")
      } else {
        toast.error("创建文章失败: " + result.error?.message)
      }
    } catch (error) {
      logger.error("创建文章失败", { module: "app/admin/blog/create", operation: "submit" }, error)
      toast.error("创建文章失败，请重试")
    } finally {
      setIsSubmitting(false)
    }
  }

  // 处理保存草稿
  const handleSave = async (data: PostFormData) => {
    try {
      // 转换数据格式（保存草稿时强制设为未发布）
      const saveData: CreatePostRequest = {
        title: data.title,
        content: data.content,
        excerpt: data.summary || undefined,
        published: false, // 草稿强制为未发布
        canonicalUrl: undefined,
        seoTitle: data.metaTitle || undefined,
        seoDescription: data.metaDescription || undefined,
        coverImage: data.coverImage || undefined,
        tagNames: data.tags,
        seriesId: undefined,
      }

      const result = await createPost(saveData)

      if (result.success) {
        toast.success("草稿保存成功！")
      } else {
        toast.error("保存草稿失败: " + result.error?.message)
      }
    } catch (error) {
      logger.error(
        "保存草稿失败",
        { module: "app/admin/blog/create", operation: "saveDraft" },
        error
      )
      toast.error("保存草稿失败，请重试")
    }
  }

  return (
    <div className="bg-background min-h-screen">

      <div className="container mx-auto px-4 py-8">
        {/* 头部导航 */}
        <div className="mb-8">
          <div className="mb-4 flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/blog">
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回文章列表
              </Link>
            </Button>
          </div>

          <div>
            <h1 className="mb-2 text-3xl font-bold">创建新文章</h1>
            <p className="text-muted-foreground">
              使用 Markdown 语法编写您的文章内容，支持图片上传和 SEO 优化设置
            </p>
          </div>
        </div>

        {/* 文章表单 */}
        <div className="max-w-4xl">
          <PostForm
            mode="create"
            onSubmit={handleSubmit}
            onSave={handleSave}
            isSubmitting={isSubmitting}
          />
        </div>
      </div>
    </div>
  )
}
