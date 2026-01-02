import { cn } from "@/lib/utils"
import { createHeadingIdFactory } from "@/lib/markdown/toc"
import { getOptimizedImageUrl } from "@/lib/images/optimizer"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import type { ReactNode } from "react"

export interface MarkdownRendererProps {
  content: string
  className?: string
  colorMode?: "light" | "dark"
}

function extractPlainText(children: ReactNode): string {
  if (typeof children === "string") return children
  if (Array.isArray(children)) return children.map(extractPlainText).join("")
  if (children && typeof children === "object" && "props" in children) {
    const props = (children as any).props
    return extractPlainText(props?.children)
  }
  return ""
}

function isDangerousUrl(value: string): boolean {
  const trimmed = value.trim()
  const lower = trimmed.toLowerCase()

  if (lower.startsWith("javascript:") || lower.startsWith("vbscript:")) {
    return true
  }

  if (lower.startsWith("data:") && !lower.startsWith("data:image/")) {
    return true
  }

  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
  if (
    hasScheme &&
    !lower.startsWith("http:") &&
    !lower.startsWith("https:") &&
    !lower.startsWith("data:image/")
  ) {
    return true
  }

  return false
}

export function MarkdownRenderer({
  content,
  className,
  colorMode = "light",
}: MarkdownRendererProps) {
  const makeId = createHeadingIdFactory()
  let renderedImageCount = 0

  return (
    <div className={cn("w-full", className)} data-color-mode={colorMode}>
      <div
        className={cn(
          "prose prose-lg dark:prose-invert max-w-none",
          // 覆盖默认样式以确保与主题一致
          "[&_*]:text-foreground",
          "[&_h1]:text-foreground [&_h2]:text-foreground [&_h3]:text-foreground",
          "[&_h4]:text-foreground [&_h5]:text-foreground [&_h6]:text-foreground",
          "[&_p]:text-foreground [&_li]:text-foreground",
          "[&_strong]:text-foreground [&_em]:text-foreground",
          "[&_code]:bg-muted [&_code]:text-foreground [&_code]:rounded-sm [&_code]:px-1 [&_code]:py-0.5",
          "[&_pre]:bg-muted [&_pre]:text-foreground [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:p-4",
          "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
          "[&_blockquote]:border-l-primary [&_blockquote]:bg-muted/50 [&_blockquote]:p-4 [&_blockquote]:italic",
          "[&_table]:border-collapse [&_table]:border-spacing-0",
          "[&_th]:border-border [&_th]:bg-muted [&_th]:border [&_th]:p-2 [&_th]:text-left [&_th]:font-semibold",
          "[&_td]:border-border [&_td]:border [&_td]:p-2",
          "[&_hr]:border-border",
          "[&_a]:text-primary [&_a]:no-underline hover:[&_a]:underline",
          // 图片样式
          "[&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg [&_img]:shadow-sm",
          // 列表样式
          "[&_ol]:ml-6 [&_ol]:list-decimal [&_ul]:ml-6 [&_ul]:list-disc",
          "[&_ul_ul]:list-circle [&_ol_ol]:list-lower-alpha",
          // 间距优化
          "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
          "[&_h1]:mb-4 [&_h1]:mt-8 [&_h2]:mb-3 [&_h2]:mt-6",
          "[&_h3]:mb-2 [&_h3]:mt-5 [&_h4]:mb-2 [&_h4]:mt-4",
          "[&_ol]:mb-4 [&_p]:mb-4 [&_ul]:mb-4",
          "[&_blockquote]:mb-4 [&_pre]:mb-4 [&_table]:mb-4"
        )}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children, className }: any) => {
              const text = extractPlainText(children)
              return (
                <h1 id={makeId(text)} className={cn("scroll-mt-24", className)}>
                  {children}
                </h1>
              )
            },
            h2: ({ children, className }: any) => {
              const text = extractPlainText(children)
              return (
                <h2 id={makeId(text)} className={cn("scroll-mt-24", className)}>
                  {children}
                </h2>
              )
            },
            h3: ({ children, className }: any) => {
              const text = extractPlainText(children)
              return (
                <h3 id={makeId(text)} className={cn("scroll-mt-24", className)}>
                  {children}
                </h3>
              )
            },
            h4: ({ children, className }: any) => {
              const text = extractPlainText(children)
              return (
                <h4 id={makeId(text)} className={cn("scroll-mt-24", className)}>
                  {children}
                </h4>
              )
            },
            h5: ({ children, className }: any) => {
              const text = extractPlainText(children)
              return (
                <h5 id={makeId(text)} className={cn("scroll-mt-24", className)}>
                  {children}
                </h5>
              )
            },
            h6: ({ children, className }: any) => {
              const text = extractPlainText(children)
              return (
                <h6 id={makeId(text)} className={cn("scroll-mt-24", className)}>
                  {children}
                </h6>
              )
            },
            img: ({ node: _node, src, alt, ...props }: any) => {
              const rawSrc = typeof src === "string" ? src : ""
              if (!rawSrc || isDangerousUrl(rawSrc)) {
                return null
              }

              const isFirstImage = renderedImageCount === 0
              renderedImageCount += 1

              const optimizedSrc =
                getOptimizedImageUrl(rawSrc, { width: 1200, quality: 75, fit: "contain" }) || rawSrc

              const { loading, decoding, fetchPriority, ...restProps } = props

              return (
                <img
                  src={optimizedSrc}
                  alt={alt || ""}
                  loading={loading ?? (isFirstImage ? "eager" : "lazy")}
                  fetchPriority={fetchPriority ?? (isFirstImage ? "high" : undefined)}
                  decoding={decoding ?? "async"}
                  {...restProps}
                />
              )
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  )
}
