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
  ...props
}: OptimizedAvatarImageProps) {
  const resolvedSrc =
    getOptimizedImageUrl(src, { width: 128, height: 128, quality, format: "webp" }) ||
    src ||
    "/placeholder.svg"

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
