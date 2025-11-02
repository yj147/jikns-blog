"use client"

import { useState, useRef, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useAutoSave } from "@/hooks/use-auto-save"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MarkdownEditor, type MarkdownEditorRef } from "./markdown-editor"
import { Separator } from "@/components/ui/separator"
import { Eye, Save, Send, X, Plus, Hash, Image as ImageIcon, Loader2, Trash2 } from "lucide-react"
import { uploadImage } from "@/lib/actions/upload"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

// Post 表单验证 Schema
const postFormSchema = z.object({
  title: z.string().min(1, "标题不能为空").max(200, "标题最多200个字符"),
  slug: z.string().min(1, "URL路径不能为空").max(100, "URL路径最多100个字符"),
  content: z.string().min(1, "内容不能为空"),
  summary: z.string().max(500, "摘要最多500个字符").optional(),
  coverImage: z.string().url("请输入有效的图片URL").optional().or(z.literal("")),
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
  initialData?: Partial<PostFormData>
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
  const coverImageInputRef = useRef<HTMLInputElement>(null)
  const [tags, setTags] = useState<string[]>(initialData?.tags || [])
  const [tagInput, setTagInput] = useState("")
  const [activeTab, setActiveTab] = useState("basic")
  const [isUploadingCover, setIsUploadingCover] = useState(false)

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

  // 自动保存配置
  const { isSaving: isAutoSaving, lastSavedAt } = useAutoSave({
    data: { ...formValues, tags, content: watch("content") },
    onSave: async (data) => {
      if (onSave && mode === "create") {
        const editorContent = editorRef.current?.getValue()
        if (editorContent !== undefined) {
          data.content = editorContent
        }
        await onSave({ ...data, tags, isPublished: false })
      }
    },
    enabled: enableAutoSave && !!onSave && mode === "create",
    ignoreKeys: ["isPublished"], // 忽略发布状态变化，避免自动保存时误发布
    delay: 3000, // 3秒延迟
  })

  // 监听标题变化，自动生成 slug
  const title = watch("title")
  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
      .replace(/^-+|-+$/g, "")
  }

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value
    setValue("title", newTitle)

    // 只在创建模式下自动生成 slug
    if (mode === "create" && !watch("slug")) {
      setValue("slug", generateSlug(newTitle))
    }
  }

  // 标签管理
  const addTag = () => {
    const trimmedTag = tagInput.trim()
    if (trimmedTag && !tags.includes(trimmedTag)) {
      const newTags = [...tags, trimmedTag]
      setTags(newTags)
      setValue("tags", newTags)
      setTagInput("")
    }
  }

  const removeTag = (tagToRemove: string) => {
    const newTags = tags.filter((tag) => tag !== tagToRemove)
    setTags(newTags)
    setValue("tags", newTags)
  }

  const handleTagInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      addTag()
    }
  }

  // 处理封面图片上传
  const handleCoverImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    const file = files[0]

    // 检查文件类型
    if (!file.type.startsWith("image/")) {
      toast.error("请选择图片文件")
      return
    }

    // 检查文件大小 (10MB = 10 * 1024 * 1024 bytes)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error(`文件过大，请选择小于 ${maxSize / 1024 / 1024}MB 的图片`)
      return
    }

    setIsUploadingCover(true)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await uploadImage(formData)

      if (response.success && response.data) {
        setValue("coverImage", response.data.url)
        toast.success("封面图片上传成功")
      } else {
        toast.error(response.error?.message || "封面图片上传失败")
      }
    } catch (error) {
      console.error("Cover upload error:", error)
      toast.error("封面图片上传失败")
    } finally {
      setIsUploadingCover(false)
    }
  }

  // 清除封面图片
  const handleClearCoverImage = () => {
    setValue("coverImage", "")
    if (coverImageInputRef.current) {
      coverImageInputRef.current.value = ""
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
    data.tags = tags

    await onSubmit(data)
  }

  // 保存草稿
  const handleSaveDraft = async () => {
    const data = form.getValues()
    const editorContent = editorRef.current?.getValue()
    if (editorContent !== undefined) {
      data.content = editorContent
    }
    data.tags = tags
    data.isPublished = false

    await onSave?.(data)
  }

  return (
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
                {errors.summary && <p className="text-sm text-red-500">{errors.summary.message}</p>}
              </div>

              {/* 封面图片 */}
              <div className="space-y-2">
                <Label>封面图片</Label>
                <div className="space-y-3">
                  {/* URL输入 */}
                  <div className="flex gap-2">
                    <Input
                      {...register("coverImage")}
                      placeholder="https://example.com/image.jpg 或点击上传"
                      type="url"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => coverImageInputRef.current?.click()}
                      disabled={isUploadingCover}
                    >
                      {isUploadingCover ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ImageIcon className="h-4 w-4" />
                      )}
                    </Button>
                    {watch("coverImage") && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleClearCoverImage}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {/* 封面预览 */}
                  {watch("coverImage") && (
                    <div className="relative h-40 w-full overflow-hidden rounded-lg border">
                      <img
                        src={watch("coverImage")}
                        alt="封面预览"
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          const img = e.target as HTMLImageElement
                          img.style.display = "none"
                          const parent = img.parentElement
                          if (parent) {
                            parent.innerHTML = `
                              <div class="w-full h-full flex items-center justify-center bg-muted text-muted-foreground">
                                <div class="text-center">
                                  <ImageIcon class="w-8 h-8 mx-auto mb-2 opacity-50" />
                                  <div class="text-sm">图片加载失败</div>
                                </div>
                              </div>
                            `
                          }
                        }}
                      />
                    </div>
                  )}

                  {/* 隐藏的文件输入 */}
                  <input
                    ref={coverImageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleCoverImageUpload(e.target.files)}
                  />

                  {errors.coverImage && (
                    <p className="text-sm text-red-500">{errors.coverImage.message}</p>
                  )}
                </div>
              </div>

              {/* 标签 */}
              <div className="space-y-2">
                <Label>标签</Label>
                <div className="mb-2 flex gap-2">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagInputKeyDown}
                    placeholder="输入标签后按回车添加"
                    className="flex-1"
                  />
                  <Button type="button" onClick={addTag} size="sm" variant="outline">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                      <Hash className="h-3 w-3" />
                      {tag}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="ml-1 h-auto p-0"
                        onClick={() => removeTag(tag)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
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
                {errors.content && <p className="text-sm text-red-500">{errors.content.message}</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SEO设置标签页 */}
        <TabsContent value="seo" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>SEO 优化设置</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="metaTitle">SEO 标题</Label>
                <Input
                  id="metaTitle"
                  {...register("metaTitle")}
                  placeholder="自定义搜索引擎显示的标题..."
                />
                {errors.metaTitle && (
                  <p className="text-sm text-red-500">{errors.metaTitle.message}</p>
                )}
                <p className="text-muted-foreground text-xs">
                  建议控制在50-60个字符内，不填写则使用文章标题
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="metaDescription">SEO 描述</Label>
                <Textarea
                  id="metaDescription"
                  {...register("metaDescription")}
                  placeholder="描述文章内容，用于搜索引擎结果展示..."
                  rows={3}
                />
                {errors.metaDescription && (
                  <p className="text-sm text-red-500">{errors.metaDescription.message}</p>
                )}
                <p className="text-muted-foreground text-xs">建议控制在150-160个字符内</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="metaKeywords">SEO 关键词</Label>
                <Input
                  id="metaKeywords"
                  {...register("metaKeywords")}
                  placeholder="关键词1, 关键词2, 关键词3..."
                />
                {errors.metaKeywords && (
                  <p className="text-sm text-red-500">{errors.metaKeywords.message}</p>
                )}
                <p className="text-muted-foreground text-xs">用逗号分隔多个关键词，建议3-5个</p>
              </div>
            </CardContent>
          </Card>
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
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
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
  )
}
