"use client"

import Image from "next/image"
import { useState, useRef, useCallback, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/app/providers/auth-provider"
import { toast } from "sonner"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, Image as ImageIcon, X, MapPin, Hash, Smile } from "lucide-react"
import { useActivityMutations, useImageUpload } from "@/hooks/use-activities"
import { activityCreateSchema, ActivityCreateData, ActivityWithAuthor } from "@/types/activity"
import { getOptimizedImageUrl } from "@/lib/images/optimizer"
import { compressImage } from "@/lib/upload/image-utils"

interface ActivityFormProps {
  mode?: "create" | "edit"
  initialData?: ActivityWithAuthor
  onSuccess?: (activity: ActivityWithAuthor) => void
  onCancel?: () => void
  placeholder?: string
  maxImages?: number
  showPinOption?: boolean
}

export function ActivityForm({
  mode = "create",
  initialData,
  onSuccess,
  onCancel,
  placeholder = "分享你的想法...",
  maxImages = 9,
  showPinOption = false,
}: ActivityFormProps) {
  const router = useRouter()
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [images, setImages] = useState<string[]>(initialData?.imageUrls || [])
  const [previewImages, setPreviewImages] = useState<File[]>([])
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  const { createActivity, updateActivity, isLoading } = useActivityMutations()
  const { uploadImages, isUploading } = useImageUpload()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ActivityCreateData>({
    resolver: zodResolver(activityCreateSchema),
    defaultValues: {
      content: initialData?.content || "",
      imageUrls: initialData?.imageUrls || [],
      isPinned: initialData?.isPinned || false,
    },
  })

  const content = watch("content")
  const isPinned = watch("isPinned")
  const charCount = content?.length || 0

  const canShowPinOption =
    showPinOption &&
    !!user &&
    (user.role === "ADMIN" || !initialData || initialData.authorId === user.id)

  const previewImageUrls = useMemo(
    () => previewImages.map((file) => URL.createObjectURL(file)),
    [previewImages]
  )

  useEffect(() => {
    return () => {
      previewImageUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [previewImageUrls])

  useEffect(() => {
    if (mode === "edit" && initialData) {
      reset({
        content: initialData.content || "",
        imageUrls: initialData.imageUrls || [],
        isPinned: initialData.isPinned || false,
      })
      setImages(initialData.imageUrls || [])
      setPreviewImages([])
      return
    }

    if (mode === "create") {
      reset({ content: "", imageUrls: [], isPinned: false })
      setImages([])
      setPreviewImages([])
    }
  }, [initialData, mode, reset])

  // 处理图片选择
  const handleImageSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || [])
      const remainingSlots = maxImages - images.length - previewImages.length

      if (remainingSlots <= 0) {
        toast.error(`最多只能上传${maxImages}张图片`)
        return
      }

      const validFiles = files.slice(0, remainingSlots).filter((file) => {
        // 验证文件类型
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} 不是有效的图片文件`)
          return false
        }

        // 验证文件大小 (10MB)
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} 超过10MB大小限制`)
          return false
        }

        return true
      })

      setPreviewImages((prev) => [...prev, ...validFiles])
    },
    [images.length, previewImages.length, maxImages]
  )

  // 移除图片
  const removeImage = useCallback((index: number, isPreview: boolean) => {
    if (isPreview) {
      setPreviewImages((prev) => prev.filter((_, i) => i !== index))
    } else {
      setImages((prev) => prev.filter((_, i) => i !== index))
    }
  }, [])

  // 提交表单
  const onSubmit = async (data: ActivityCreateData) => {
    if (!user) {
      toast.error("请先登录")
      router.push("/login")
      return
    }

    try {
      // 上传新图片
      let uploadedUrls: string[] = []
      if (previewImages.length > 0) {
        const compressedFiles = await Promise.all(
          previewImages.map((file) => compressImage(file, 1920, 1080, 0.8))
        )
        uploadedUrls = await uploadImages(compressedFiles)
      }

      // 合并所有图片URL
      const allImageUrls = [...images, ...uploadedUrls]

      const normalizedImageUrls = allImageUrls.length > 0 ? allImageUrls : []
      setValue("imageUrls", normalizedImageUrls)

      const activityData: ActivityCreateData = {
        ...data,
        imageUrls: normalizedImageUrls,
      }

      let result: ActivityWithAuthor
      if (mode === "edit" && initialData) {
        result = await updateActivity(initialData.id, activityData)
      } else {
        result = await createActivity(activityData)
      }

      // 重置表单
      setValue("content", "")
      setValue("imageUrls", [])
      setValue("isPinned", false)
      setImages([])
      setPreviewImages([])

      onSuccess?.(result)
    } catch (error) {
      // 错误已在 hook 中处理
    }
  }

  // 插入表情
  const insertEmoji = (emoji: string) => {
    const currentContent = content || ""
    setValue("content", currentContent + emoji)
    setShowEmojiPicker(false)
  }

  const isSubmitDisabled =
    isLoading ||
    isUploading ||
    (!content?.trim() && images.length === 0 && previewImages.length === 0)

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="flex gap-4">
            {/* 用户头像 */}
            <div className="shrink-0">
                <Avatar className="h-10 w-10">
                    <AvatarImage src={user?.avatarUrl || "/placeholder.svg"} alt={user?.name || "用户"} />
                    <AvatarFallback>{user?.name?.[0] || "U"}</AvatarFallback>
                </Avatar>
            </div>

            <div className="flex-1 min-w-0">
                {/* 文本输入区 */}
                <Textarea
                    {...register("content")}
                    placeholder={placeholder}
                    className="min-h-[100px] w-full resize-none border-none bg-transparent p-0 text-lg placeholder:text-muted-foreground focus-visible:ring-0 leading-relaxed"
                    maxLength={5000}
                    autoFocus
                />

                {errors.content && <p className="text-sm text-red-500 mt-2">{errors.content.message}</p>}

                {/* 图片预览区 */}
                {(images.length > 0 || previewImages.length > 0) && (
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {/* 已上传的图片 */}
                        {images.map((url, index) => (
                            <div key={`uploaded-${index}`} className="group relative aspect-square">
                                <Image
                                    src={
                                    getOptimizedImageUrl(url, {
                                        width: 600,
                                        height: 600,
                                        quality: 80,
                                        format: "webp",
                                    }) ?? url
                                    }
                                    alt={`图片 ${index + 1}`}
                                    fill
                                    className="rounded-xl object-cover border border-border/50"
                                    sizes="200px"
                                    loading={index === 0 ? "eager" : "lazy"}
                                />
                                <button
                                    type="button"
                                    onClick={() => removeImage(index, false)}
                                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/80"
                                >
                                    <X className="h-3.5 w-3.5 text-white" />
                                </button>
                            </div>
                        ))}

                        {/* 待上传的图片 */}
                        {previewImages.map((file, index) => {
                            const previewUrl = previewImageUrls[index]
                            if (!previewUrl) return null
                            return (
                            <div key={`preview-${index}`} className="group relative aspect-square">
                                <Image
                                    src={previewUrl}
                                    alt={`预览 ${index + 1}`}
                                    fill
                                    className="rounded-xl object-cover border border-border/50 opacity-80"
                                    sizes="200px"
                                />
                                <button
                                    type="button"
                                    onClick={() => removeImage(index, true)}
                                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/80"
                                >
                                    <X className="h-3.5 w-3.5 text-white" />
                                </button>
                            </div>
                            )
                        })}
                    </div>
                )}
                
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                    <div className="flex items-center gap-1 -ml-2">
                        {/* 图片上传按钮 */}
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-primary rounded-full hover:bg-primary/10"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={images.length + previewImages.length >= maxImages}
                        >
                            <ImageIcon className="h-5 w-5" />
                        </Button>

                        {/* 表情按钮 */}
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-primary rounded-full hover:bg-primary/10"
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        >
                            <Smile className="h-5 w-5" />
                        </Button>

                        {/* 置顶选项 (Compact) */}
                        {canShowPinOption && (
                            <div className="flex items-center gap-2 ml-2">
                                <Switch
                                    id="pin"
                                    checked={isPinned}
                                    onCheckedChange={(checked) => setValue("isPinned", checked)}
                                />
                                <Label htmlFor="pin" className="text-xs text-muted-foreground cursor-pointer">
                                    置顶
                                </Label>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        {/* 字符计数 */}
                        {charCount > 0 && (
                             <span className={`text-xs ${charCount > 4900 ? "text-red-500" : "text-muted-foreground"}`}>
                                {charCount}/5000
                            </span>
                        )}

                        {/* 取消按钮 */}
                        {onCancel && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="rounded-full text-muted-foreground hover:text-foreground"
                                onClick={onCancel}
                                disabled={isLoading || isUploading}
                            >
                                取消
                            </Button>
                        )}

                        {/* 发布按钮 */}
                        <Button type="submit" size="sm" disabled={isSubmitDisabled} className="rounded-full font-bold px-5">
                            {isLoading || isUploading ? (
                                <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {isUploading ? "上传" : "发布"}
                                </>
                            ) : mode === "edit" ? (
                                "更新"
                            ) : (
                                "发布"
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
      </form>

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleImageSelect}
      />

      {/* 简单的表情选择器 */}
      <Dialog open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>选择表情</DialogTitle>
            <DialogDescription>点击表情将其添加到动态中</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-8 gap-2 p-4">
            {[
              "😀",
              "😃",
              "😄",
              "😁",
              "😆",
              "😅",
              "🤣",
              "😂",
              "🙂",
              "🙃",
              "😉",
              "😊",
              "😇",
              "🥰",
              "😍",
              "🤩",
              "😘",
              "😗",
              "😚",
              "😙",
              "😋",
              "😛",
              "😜",
              "🤪",
              "😝",
              "🤑",
              "🤗",
              "🤭",
              "🤫",
              "🤔",
              "🤐",
              "🤨",
              "😐",
              "😑",
              "😶",
              "😏",
              "😒",
              "🙄",
              "😬",
              "🤥",
              "😌",
              "😔",
              "😪",
              "🤤",
              "😴",
              "😷",
              "🤒",
              "🤕",
              "🤢",
              "🤮",
              "🤧",
              "🥵",
              "🥶",
              "🥴",
              "😵",
              "🤯",
              "🤠",
              "🥳",
              "😎",
              "🤓",
              "🧐",
              "😕",
              "😟",
              "🙁",
            ].map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => insertEmoji(emoji)}
                className="hover:bg-accent rounded p-1 text-2xl"
              >
                {emoji}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
