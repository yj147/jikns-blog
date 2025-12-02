"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useParams } from "next/navigation"
import Link from "next/link"
import dynamic from "next/dynamic"
import type { PostFormData, PostFormProps } from "@/components/admin/post-form"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "sonner"
import { getPost, updatePost } from "@/lib/actions/posts"
import type { UpdatePostRequest } from "@/types/api"
import { logger } from "@/lib/utils/logger"

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

export default function EditPostPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [initialData, setInitialData] = useState<PostFormData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 获取文章数据
  useEffect(() => {
    const fetchPost = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const result = await getPost(id)

        if (result.success && result.data) {
          // 转换 API 响应为表单数据格式
          const postData = result.data
          const formData: PostFormData & { coverImageSigned?: string | null } = {
            title: postData.title,
            slug: postData.slug,
            content: postData.content,
            summary: postData.excerpt || "",
            coverImage: postData.coverImage || "",
            coverImageSigned: postData.signedCoverImage ?? postData.coverImage ?? null,
            tags: postData.tags.map((tag) => tag.name),
            isPublished: postData.published,
            isPinned: postData.isPinned,
            metaTitle: postData.seoTitle || "",
            metaDescription: postData.seoDescription || "",
            metaKeywords: "", // 暂时没有存储关键词
          }
          setInitialData(formData)
        } else {
          setError(result.error?.message || "文章未找到")
        }
      } catch (err) {
        logger.error("获取文章数据失败", { module: "app/admin/blog/edit", postId: id }, err)
        setError("获取文章数据失败")
      } finally {
        setIsLoading(false)
      }
    }

    if (id) {
      fetchPost()
    }
  }, [id])

  // 处理表单提交（更新）
  const handleSubmit = async (data: PostFormData) => {
    setIsSubmitting(true)
    try {
      // 转换数据格式
      const updateData: UpdatePostRequest = {
        id,
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
        // 显示成功提示
        if (data.isPublished) {
          toast.success("文章更新并发布成功！")
        } else {
          toast.success("文章已更新并保存为草稿！")
        }

        // 重定向到文章列表页面
        router.push("/admin/blog")
      } else {
        toast.error("更新文章失败: " + result.error?.message)
      }
    } catch (error) {
      logger.error("更新文章失败", { module: "app/admin/blog/edit", postId: id }, error)
      toast.error("更新文章失败，请重试")
    } finally {
      setIsSubmitting(false)
    }
  }

  // 处理保存草稿
  const handleSave = async (data: PostFormData) => {
    try {
      // 转换数据格式（保存草稿时强制设为未发布）
      const saveData: UpdatePostRequest = {
        id,
        title: data.title,
        slug: data.slug,
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

      const result = await updatePost(saveData)

      if (result.success) {
        toast.success("草稿保存成功！")
      } else {
        toast.error("保存草稿失败: " + result.error?.message)
      }
    } catch (error) {
      logger.error("保存草稿失败", { module: "app/admin/blog/edit", postId: id }, error)
      toast.error("保存草稿失败，请重试")
    }
  }

  // 错误状态
  if (error) {
    return (
      <div className="bg-background min-h-screen">

        <div className="container mx-auto px-4 py-8">
          <div className="mb-8 flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/blog">
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回文章列表
              </Link>
            </Button>
          </div>

          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }

  // 加载状态
  if (isLoading || !initialData) {
    return (
      <div className="bg-background min-h-screen">

        <div className="container mx-auto px-4 py-8">
          <div className="mb-8 flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/blog">
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回文章列表
              </Link>
            </Button>
          </div>

          <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </div>
    )
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
            <h1 className="mb-2 text-3xl font-bold">编辑文章</h1>
            <p className="text-muted-foreground">
              修改文章内容，支持 Markdown 语法、图片上传和 SEO 设置
            </p>
          </div>
        </div>

        {/* 文章表单 */}
        <div className="max-w-4xl">
          <PostForm
            mode="edit"
            initialData={initialData}
            onSubmit={handleSubmit}
            onSave={handleSave}
            isSubmitting={isSubmitting}
          />
        </div>
      </div>
    </div>
  )
}
