"use client"

import Image from "next/image"
import { useEffect, useMemo, useRef, useState } from "react"
import { useFormContext } from "react-hook-form"
import { Image as ImageIcon, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { uploadImage } from "@/lib/actions/upload"
import { getOptimizedImageUrl } from "@/lib/images/optimizer"
import { compressImage } from "@/lib/upload/image-utils"
import type { PostFormData } from "@/components/admin/post-form"

type CoverImageUploadProps = {
  initialCoverImage?: string
  initialSignedUrl?: string | null
  onUpload?: (payload: { path: string; url?: string }) => void
  onRemove?: () => void
}

export function CoverImageUpload({
  initialCoverImage,
  initialSignedUrl,
  onUpload,
  onRemove,
}: CoverImageUploadProps) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<PostFormData>()

  const coverImageInputRef = useRef<HTMLInputElement>(null)
  const [isUploadingCover, setIsUploadingCover] = useState(false)
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | undefined>(
    initialSignedUrl || initialCoverImage || undefined
  )
  const [coverPreviewError, setCoverPreviewError] = useState(false)

  const coverImageValue = watch("coverImage")
  const optimizedCoverImage = useMemo(
    () =>
      coverPreviewUrl
        ? getOptimizedImageUrl(coverPreviewUrl, {
            width: 1600,
            height: 900,
            quality: 80,
            format: "webp",
          })
        : undefined,
    [coverPreviewUrl]
  )

  useEffect(() => {
    if (!coverImageValue) {
      setCoverPreviewUrl(undefined)
      setCoverPreviewError(false)
      return
    }

    if (initialCoverImage && coverImageValue === initialCoverImage && initialSignedUrl) {
      setCoverPreviewUrl(initialSignedUrl || undefined)
      setCoverPreviewError(false)
      return
    }

    if (/^https?:\/\//.test(coverImageValue) || coverImageValue.startsWith("data:")) {
      setCoverPreviewUrl(coverImageValue)
      setCoverPreviewError(false)
      return
    }

    setCoverPreviewError(false)
  }, [coverImageValue, initialCoverImage, initialSignedUrl])

  const handleCoverImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    const file = files[0]

    if (!file.type.startsWith("image/")) {
      toast.error("请选择图片文件")
      return
    }

    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error(`文件过大，请选择小于 ${maxSize / 1024 / 1024}MB 的图片`)
      return
    }

    setIsUploadingCover(true)

    try {
      const compressedFile = await compressImage(file, 1920, 1080, 0.8)
      const formData = new FormData()
      formData.append("file", compressedFile)

      const response = await uploadImage(formData)

      if (response.success && response.data) {
        setValue("coverImage", response.data.path, { shouldDirty: true })
        setCoverPreviewUrl(response.data.url)
        setCoverPreviewError(false)
        onUpload?.({ path: response.data.path, url: response.data.url })
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

  const handleClearCoverImage = () => {
    setValue("coverImage", "")
    setCoverPreviewUrl(undefined)
    setCoverPreviewError(false)
    onRemove?.()
    if (coverImageInputRef.current) {
      coverImageInputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-2">
      <Label>封面图片</Label>
      <div className="space-y-3">
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
          {coverImageValue && (
            <Button type="button" variant="outline" size="sm" onClick={handleClearCoverImage}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        {(coverImageValue || coverPreviewUrl) && (
          <div className="relative h-40 w-full overflow-hidden rounded-lg border">
            {coverPreviewError ? (
              <div className="bg-muted text-muted-foreground flex h-full w-full items-center justify-center">
                <div className="text-center">
                  <ImageIcon className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  <div className="text-sm">图片加载失败</div>
                </div>
              </div>
            ) : (
              <Image
                src={optimizedCoverImage ?? coverPreviewUrl ?? coverImageValue ?? ""}
                alt="封面预览"
                fill
                sizes="(max-width: 768px) 100vw, 400px"
                className="object-cover"
                onError={() => setCoverPreviewError(true)}
                loading="eager"
                priority={true}
                fetchPriority="high"
                quality={80}
              />
            )}
          </div>
        )}

        <input
          ref={coverImageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleCoverImageUpload(e.target.files)}
        />

        {errors.coverImage && <p className="text-sm text-red-500">{errors.coverImage.message}</p>}
      </div>
    </div>
  )
}
