"use client"

import * as React from "react"
import Image, { ImageProps } from "next/image"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"
import { getOptimizedImageUrl } from "@/lib/images/optimizer"

type OptimizedAvatarImageProps = {
  src?: string | null
  alt?: string
  priority?: boolean
  sizes?: string
  quality?: number
} & Omit<ImageProps, "src" | "alt" | "fill">

function Avatar({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn("relative flex size-8 shrink-0 overflow-hidden rounded-full", className)}
      {...props}
    />
  )
}

function AvatarImage({
  className,
  src,
  alt = "",
  priority = false,
  sizes = "48px",
  quality = 70,
  unoptimized,
  ...props
}: OptimizedAvatarImageProps) {
  const isDataUrl = typeof src === "string" && src.startsWith("data:")
  // 检测签名 URL，不应用 Supabase Render API 转换
  const isSignedUrl = typeof src === "string" && src.includes("/object/sign/")
  const resolvedSrc =
    (isDataUrl || isSignedUrl
      ? src
      : getOptimizedImageUrl(src, { width: 128, height: 128, quality, format: "webp" })) ||
    src ||
    "/placeholder.svg"

  const isSvg = typeof resolvedSrc === "string" && /svg(\?|$)/i.test(resolvedSrc)
  // 检测本地 Supabase Storage URL，需要禁用 Next.js 优化
  const isLocalSupabase =
    typeof resolvedSrc === "string" &&
    (resolvedSrc.includes("127.0.0.1:54321") || resolvedSrc.includes("localhost:54321"))
  // 签名 URL 也需要 unoptimized，避免 Next.js Image 优化器处理
  const shouldUnoptimize = (unoptimized ?? isSvg) || isDataUrl || isLocalSupabase || isSignedUrl

  // 本地开发环境或签名 URL 使用原生 img 标签
  // 避免 Next.js Image 与 Radix Avatar 的时序冲突导致图片无法显示
  if (isLocalSupabase || isSignedUrl) {
    return (
      <AvatarPrimitive.Image
        data-slot="avatar-image"
        className={cn("aspect-square size-full object-cover", className)}
        src={resolvedSrc}
        alt={alt}
      />
    )
  }

  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full", className)}
      asChild
    >
      <Image
        src={resolvedSrc}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        quality={quality}
        className="object-cover"
        unoptimized={shouldUnoptimize}
        {...props}
      />
    </AvatarPrimitive.Image>
  )
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn("bg-muted flex size-full items-center justify-center rounded-full", className)}
      {...props}
    />
  )
}

export { Avatar, AvatarImage, AvatarFallback }
