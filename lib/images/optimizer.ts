const SUPABASE_STORAGE_SEGMENT = "/storage/v1/object/public/"
const SUPABASE_RENDER_SEGMENT = "/storage/v1/render/image/public/"

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

  let parsed: URL
  try {
    parsed = new URL(src)
  } catch {
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!baseUrl) return src
    try {
      parsed = new URL(src, baseUrl)
    } catch {
      return src
    }
  }

  if (!parsed.pathname.includes(SUPABASE_STORAGE_SEGMENT)) {
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
  if (merged.format) optimizedUrl.searchParams.set("format", merged.format)

  return optimizedUrl.toString()
}
