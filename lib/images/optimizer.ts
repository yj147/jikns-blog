const SUPABASE_STORAGE_SEGMENT = "/storage/v1/object/public/"
const SUPABASE_RENDER_SEGMENT = "/storage/v1/render/image/public/"
const DEFAULT_STORAGE_BUCKET = "activity-images"
const STORAGE_RELATIVE_PREFIXES = ["avatars/", "activities/", "users/"]

type OptimizeOptions = {
  width?: number
  height?: number
  fit?: "cover" | "contain" | "scale-down"
  quality?: number
  format?: "webp" | "avif"
}

const DEFAULT_OPTIONS: Required<Omit<OptimizeOptions, "width" | "height">> = {
  fit: "cover",
  quality: 70,
  format: "webp",
}

export function getOptimizedImageUrl(
  src?: string | null,
  options: OptimizeOptions = {}
): string | undefined {
  if (!src) return undefined

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  // 处理 Storage 相对路径（如 avatars/xxx、activities/xxx）
  const isStorageRelativePath = STORAGE_RELATIVE_PREFIXES.some((prefix) => src.startsWith(prefix))
  if (isStorageRelativePath && baseUrl) {
    const fullStorageUrl = `${baseUrl}${SUPABASE_STORAGE_SEGMENT}${DEFAULT_STORAGE_BUCKET}/${src}`
    return getOptimizedImageUrl(fullStorageUrl, options)
  }

  // 确保相对路径以 / 开头（next/image 要求）
  const normalizedSrc = src.startsWith("/") || src.startsWith("http") ? src : `/${src}`

  let parsed: URL
  try {
    parsed = new URL(normalizedSrc)
  } catch {
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!baseUrl) return normalizedSrc
    try {
      parsed = new URL(normalizedSrc, baseUrl)
    } catch {
      return normalizedSrc
    }
  }

  if (!parsed.pathname.includes(SUPABASE_STORAGE_SEGMENT)) {
    return normalizedSrc
  }

  // 在本地开发环境禁用图片优化，因为 Supabase 本地开发不支持 Render API
  const isLocalDev = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1"
  if (isLocalDev) {
    return src
  }

  const objectPath = parsed.pathname.replace(SUPABASE_STORAGE_SEGMENT, "")
  const optimizedUrl = new URL(
    `${SUPABASE_RENDER_SEGMENT}${objectPath}`,
    `${parsed.protocol}//${parsed.host}`
  )

  const merged = { ...DEFAULT_OPTIONS, ...options }
  if (merged.width) optimizedUrl.searchParams.set("width", String(merged.width))
  if (merged.height) optimizedUrl.searchParams.set("height", String(merged.height))
  if (merged.fit) optimizedUrl.searchParams.set("fit", merged.fit)
  if (merged.quality) optimizedUrl.searchParams.set("quality", String(merged.quality))
  // format 参数在 Supabase 本地开发环境中不支持，生产环境需要测试
  // if (merged.format) optimizedUrl.searchParams.set("format", merged.format)

  return optimizedUrl.toString()
}
