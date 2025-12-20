"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { FormProvider, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useAutoSave } from "@/hooks/use-auto-save"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Eye, Save, Send } from "lucide-react"
import { cn } from "@/lib/utils"
import { normalizeTagSlug } from "@/lib/utils/tag"
import { createSmartSlug } from "@/lib/utils/slug-english"
import { CoverImageUpload } from "@/components/admin/post-form/cover-image-upload"
import { SeoFields } from "@/components/admin/post-form/seo-fields"
import dynamic from "next/dynamic"
import type { MarkdownEditorRef } from "./markdown-editor"

// 动态导入 MarkdownEditor，避免 974KB 的 refractor 被打包到初始 bundle
const MarkdownEditor = dynamic(
  () => import("./markdown-editor").then((mod) => mod.MarkdownEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center rounded-lg border p-8">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2"></div>
        <span className="ml-2">正在加载编辑器...</span>
      </div>
    ),
  }
)
import { TagAutocomplete, type TagAutocompleteItem } from "./tag-autocomplete"

// Post 表单验证 Schema
function mapTagNamesToItems(tagNames: string[]): TagAutocompleteItem[] {
  return tagNames.map((name, index) => {
    const normalized = normalizeTagSlug(name)
    const safeSlug = normalized || `tag-${index}`
    return {
      id: `existing-${safeSlug}-${index}`,
      name,
      slug: safeSlug,
      color: null,
    }
  })
}

const slugSchema = z
  .string()
  .min(1, "URL路径不能为空")
  .max(100, "URL路径最多100个字符")
  .regex(/^[a-zA-Z0-9\-_]+$/, "URL路径只能包含字母、数字、连字符和下划线")
  .refine((value) => !/^[-_]|[-_]$/.test(value), {
    message: "URL路径不能以连字符或下划线开头或结尾",
  })
  .refine((value) => !/[-_]{2,}/.test(value), {
    message: "URL路径不能包含连续的分隔符",
  })

const coverImageSchema = z
  .string()
  .max(500, "封面图片地址过长")
  .refine(
    (value) => {
      if (!value) return true
      const isUrl = /^https?:\/\//.test(value)
      const isStoragePath = /^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)+$/.test(value)
      return isUrl || isStoragePath
    },
    { message: "请输入有效的图片URL或存储路径" }
  )
  .optional()
  .or(z.literal(""))

const postFormSchema = z.object({
  title: z.string().min(1, "标题不能为空").max(200, "标题最多200个字符"),
  slug: slugSchema,
  content: z.string().min(1, "内容不能为空"),
  summary: z.string().max(500, "摘要最多500个字符").optional(),
  coverImage: coverImageSchema,
  tags: z.array(z.string()),
  isPublished: z.boolean(),
  isPinned: z.boolean(),
  // SEO 字段
  metaTitle: z.string().max(60, "SEO标题最多60个字符").optional(),
  metaDescription: z.string().max(160, "SEO描述最多160个字符").optional(),
  metaKeywords: z.string().max(200, "SEO关键词最多200个字符").optional(),
})

export type PostFormData = z.infer<typeof postFormSchema>

export interface PostFormProps {
  initialData?: Partial<PostFormData> & { coverImageSigned?: string | null }
  onSubmit: (data: PostFormData) => Promise<void>
  onSave?: (data: PostFormData) => Promise<void> // 保存草稿
  mode?: "create" | "edit"
  isSubmitting?: boolean
  className?: string
  enableAutoSave?: boolean // 是否启用自动保存
}

export function PostForm({
  initialData,
  onSubmit,
  onSave,
  mode = "create",
  isSubmitting = false,
  className,
  enableAutoSave = true,
}: PostFormProps) {
  const editorRef = useRef<MarkdownEditorRef>(null)
  const [selectedTags, setSelectedTags] = useState<TagAutocompleteItem[]>(() =>
    mapTagNamesToItems(initialData?.tags || [])
  )
  const [activeTab, setActiveTab] = useState("basic")

  // 表单配置
  const form = useForm<PostFormData>({
    resolver: zodResolver(postFormSchema),
    defaultValues: {
      title: initialData?.title || "",
      slug: initialData?.slug || "",
      content: initialData?.content || "",
      summary: initialData?.summary || "",
      coverImage: initialData?.coverImage || "",
      tags: initialData?.tags || [],
      isPublished: initialData?.isPublished || false,
      isPinned: initialData?.isPinned || false,
      metaTitle: initialData?.metaTitle || "",
      metaDescription: initialData?.metaDescription || "",
      metaKeywords: initialData?.metaKeywords || "",
    },
  })

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = form

  // 获取当前表单值
  const formValues = watch()
  const tagNames = useMemo(() => selectedTags.map((tag) => tag.name), [selectedTags])

  const handleTagsChange = (tags: TagAutocompleteItem[]) => {
    setSelectedTags(tags)
    setValue(
      "tags",
      tags.map((tag) => tag.name),
      { shouldDirty: true }
    )
  }

  const initialTagsKey = useMemo(() => JSON.stringify(initialData?.tags ?? []), [initialData])

  useEffect(() => {
    let parsedTags: string[] = []
    try {
      const raw = JSON.parse(initialTagsKey)
      if (Array.isArray(raw)) {
        parsedTags = raw.filter((value): value is string => typeof value === "string")
      }
    } catch (error) {
      parsedTags = []
    }
    const nextTags = mapTagNamesToItems(parsedTags)
    setSelectedTags(nextTags)
    setValue(
      "tags",
      nextTags.map((tag) => tag.name)
    )
  }, [initialTagsKey, setValue])

  // 自动保存配置
  const { isSaving: isAutoSaving, lastSavedAt } = useAutoSave({
    data: { ...formValues, tags: tagNames, content: watch("content") },
    onSave: async (data) => {
      if (onSave && mode === "create") {
        const editorContent = editorRef.current?.getValue()
        if (editorContent !== undefined) {
          data.content = editorContent
        }
        await onSave({ ...data, tags: tagNames, isPublished: false })
      }
    },
    enabled: enableAutoSave && !!onSave && mode === "create",
    ignoreKeys: ["isPublished"], // 忽略发布状态变化，避免自动保存时误发布
    delay: 3000, // 3秒延迟
  })

  // 监听标题变化，自动生成 slug
  const generateSlug = (title: string) => createSmartSlug(title, 100)

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value
    setValue("title", newTitle)

    // 只在创建模式下自动生成 slug
    if (mode === "create" && !watch("slug")) {
      setValue("slug", generateSlug(newTitle))
    }
  }

  // 表单提交处理
  const handleFormSubmit = async (data: PostFormData) => {
    // 获取编辑器的最新内容
    const editorContent = editorRef.current?.getValue()
    if (editorContent !== undefined) {
      data.content = editorContent
    }

    // 更新标签数据
    data.tags = tagNames

    await onSubmit(data)
  }

  // 保存草稿
  const handleSaveDraft = async () => {
    const data = form.getValues()
    const editorContent = editorRef.current?.getValue()
    if (editorContent !== undefined) {
      data.content = editorContent
    }
    data.tags = tagNames
    data.isPublished = false

    await onSave?.(data)
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit(handleFormSubmit)} className={cn("space-y-6", className)}>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">基本信息</TabsTrigger>
            <TabsTrigger value="content">内容编辑</TabsTrigger>
            <TabsTrigger value="seo">SEO设置</TabsTrigger>
          </TabsList>

          {/* 基本信息标签页 */}
          <TabsContent value="basic" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>文章基本信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 标题 */}
                <div className="space-y-2">
                  <Label htmlFor="title">文章标题 *</Label>
                  <Input
                    id="title"
                    {...register("title")}
                    onChange={handleTitleChange}
                    placeholder="输入文章标题..."
                  />
                  {errors.title && <p className="text-sm text-red-500">{errors.title.message}</p>}
                </div>

                {/* URL路径 */}
                <div className="space-y-2">
                  <Label htmlFor="slug">URL路径 *</Label>
                  <Input id="slug" {...register("slug")} placeholder="url-path-example" />
                  {errors.slug && <p className="text-sm text-red-500">{errors.slug.message}</p>}
                </div>

                {/* 摘要 */}
                <div className="space-y-2">
                  <Label htmlFor="summary">文章摘要</Label>
                  <Textarea
                    id="summary"
                    {...register("summary")}
                    placeholder="输入文章摘要，用于首页展示..."
                    rows={3}
                  />
                  {errors.summary && (
                    <p className="text-sm text-red-500">{errors.summary.message}</p>
                  )}
                </div>

                {/* 封面图片 */}
                <CoverImageUpload
                  initialCoverImage={initialData?.coverImage}
                  initialSignedUrl={initialData?.coverImageSigned}
                />

                {/* 标签 */}
                <div className="space-y-2">
                  <Label>标签</Label>
                  <TagAutocomplete
                    selectedTags={selectedTags}
                    onTagsChange={handleTagsChange}
                    placeholder="搜索或创建标签..."
                  />
                  {errors.tags && <p className="text-sm text-red-500">{errors.tags.message}</p>}
                </div>

                <Separator />

                {/* 发布选项 */}
                <div className="flex items-center justify-between space-x-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="isPublished"
                      {...register("isPublished")}
                      onCheckedChange={(checked) => setValue("isPublished", checked)}
                    />
                    <Label htmlFor="isPublished">立即发布</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="isPinned"
                      {...register("isPinned")}
                      onCheckedChange={(checked) => setValue("isPinned", checked)}
                    />
                    <Label htmlFor="isPinned">置顶文章</Label>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 内容编辑标签页 */}
          <TabsContent value="content" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Markdown 内容编辑</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label>文章内容 *</Label>
                  <MarkdownEditor
                    ref={editorRef}
                    value={watch("content")}
                    onChange={(value) => setValue("content", value || "")}
                    height={600}
                    placeholder="使用 Markdown 语法编写你的文章内容..."
                    enableImageUpload={true}
                  />
                  {errors.content && (
                    <p className="text-status-error text-sm">{errors.content.message}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SEO设置标签页 */}
          <TabsContent value="seo" className="space-y-6">
            <SeoFields />
          </TabsContent>
        </Tabs>

        {/* 操作按钮 */}
        <div className="flex flex-col gap-4 pt-6">
          {/* 自动保存状态 */}
          {enableAutoSave && onSave && mode === "create" && (
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              {isAutoSaving ? (
                <>
                  <div className="border-primary h-3 w-3 animate-spin rounded-full border-b-2"></div>
                  <span>正在自动保存...</span>
                </>
              ) : lastSavedAt ? (
                <>
                  <div className="bg-status-success h-2 w-2 rounded-full"></div>
                  <span>已自动保存于 {lastSavedAt.toLocaleTimeString()}</span>
                </>
              ) : null}
            </div>
          )}

          <div className="flex gap-4">
            {onSave && (
              <Button
                type="button"
                variant="outline"
                onClick={handleSaveDraft}
                disabled={isSubmitting || isAutoSaving}
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                手动保存草稿
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={() => setActiveTab("content")}
              className="flex items-center gap-2"
            >
              <Eye className="h-4 w-4" />
              预览内容
            </Button>

            <Button
              type="submit"
              disabled={isSubmitting || isAutoSaving}
              className="flex items-center gap-2"
            >
              <Send className="h-4 w-4" />
              {isSubmitting ? "提交中..." : mode === "create" ? "创建文章" : "更新文章"}
            </Button>
          </div>
        </div>
      </form>
    </FormProvider>
  )
}
