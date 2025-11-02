"use client"

import dynamic from "next/dynamic"
import { useState, useEffect, forwardRef, useImperativeHandle, useRef, useCallback } from "react"
import { cn } from "@/lib/utils"
import { uploadImage, uploadMultipleImages } from "@/lib/actions/upload"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Upload, Image as ImageIcon, Loader2 } from "lucide-react"

// 动态导入 MD 编辑器，避免 SSR 问题
const MDEditor = dynamic(() => import("@uiw/react-md-editor"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center rounded-lg border p-8">
      <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2"></div>
      <span className="ml-2">正在加载编辑器...</span>
    </div>
  ),
})

export interface MarkdownEditorProps {
  value?: string
  onChange?: (value?: string) => void
  placeholder?: string
  className?: string
  height?: number
  preview?: "live" | "edit" | "preview"
  visibleDragbar?: boolean
  colorMode?: "light" | "dark"
  enableImageUpload?: boolean // 是否启用图片上传
}

export interface MarkdownEditorRef {
  getValue: () => string | undefined
  setValue: (value: string) => void
  focus: () => void
  insertImageMarkdown: (imageUrl: string, altText?: string) => void
}

const MarkdownEditor = forwardRef<MarkdownEditorRef, MarkdownEditorProps>(
  (
    {
      value = "",
      onChange,
      placeholder = "请输入 Markdown 内容...",
      className,
      height = 500,
      preview = "live",
      visibleDragbar = true,
      colorMode = "light",
      enableImageUpload = true,
    },
    ref
  ) => {
    const [editorValue, setEditorValue] = useState<string | undefined>(value)
    const [mounted, setMounted] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const editorRef = useRef<any>(null)

    // 客户端挂载后才渲染编辑器
    useEffect(() => {
      setMounted(true)
    }, [])

    // 同步外部 value 变化
    useEffect(() => {
      setEditorValue(value)
    }, [value])

    // 处理编辑器内容变化
    const handleEditorChange = (val?: string) => {
      setEditorValue(val)
      onChange?.(val)
    }

    // 插入图片 Markdown 语法
    const insertImageMarkdown = useCallback(
      (imageUrl: string, altText = "图片") => {
        const imageMarkdown = `![${altText}](${imageUrl})\n\n`
        const currentValue = editorValue || ""
        const newValue = currentValue + imageMarkdown
        setEditorValue(newValue)
        onChange?.(newValue)
      },
      [editorValue, onChange]
    )

    // 处理图片上传
    const handleImageUpload = async (files: FileList | null) => {
      if (!files || files.length === 0) return

      // 验证每个文件的大小和类型
      const maxSize = 10 * 1024 * 1024 // 10MB
      const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]
      const validFiles: File[] = []

      for (let i = 0; i < files.length; i++) {
        const file = files[i]

        // 检查文件类型
        if (!allowedTypes.includes(file.type)) {
          toast.error(`文件 ${file.name} 格式不支持。支持的格式: JPG, PNG, WebP, GIF`)
          continue
        }

        // 检查文件大小
        if (file.size > maxSize) {
          toast.error(`文件 ${file.name} 过大，请选择小于 ${maxSize / 1024 / 1024}MB 的图片`)
          continue
        }

        validFiles.push(file)
      }

      if (validFiles.length === 0) {
        toast.error("没有可上传的有效文件")
        return
      }

      if (validFiles.length !== files.length) {
        toast.warning(`已过滤 ${files.length - validFiles.length} 个无效文件，继续上传有效文件`)
      }

      setIsUploading(true)
      setUploadProgress(0)

      try {
        const formData = new FormData()

        if (validFiles.length === 1) {
          // 单文件上传
          formData.append("file", validFiles[0])
          const response = await uploadImage(formData)

          if (response.success && response.data) {
            insertImageMarkdown(response.data.url, validFiles[0].name.split(".")[0])
            toast.success("图片上传成功")
          } else {
            toast.error(response.error?.message || "图片上传失败")
          }
        } else {
          // 多文件上传
          validFiles.forEach((file) => formData.append("files", file))
          const response = await uploadMultipleImages(formData)

          if (response.success && response.data) {
            response.data.forEach((result, index) => {
              insertImageMarkdown(result.url, validFiles[index].name.split(".")[0])
            })
            toast.success(`成功上传 ${response.data.length} 张图片`)

            // 显示警告信息（如果有文件被过滤）
            if (response.meta?.warnings && response.meta.warnings.length > 0) {
              response.meta.warnings.forEach((warning) => {
                toast.warning(warning)
              })
            }
          } else {
            toast.error(response.error?.message || "图片上传失败")
          }
        }
      } catch (error) {
        console.error("Upload error:", error)
        toast.error("图片上传失败")
      } finally {
        setIsUploading(false)
        setUploadProgress(0)
      }
    }

    // 处理拖拽事件
    const handleDragEnter = (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (enableImageUpload) {
        setIsDragging(true)
      }
    }

    const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
    }

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
    }

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      if (enableImageUpload && e.dataTransfer.files) {
        const imageFiles = Array.from(e.dataTransfer.files).filter((file) =>
          file.type.startsWith("image/")
        )

        if (imageFiles.length > 0) {
          const fileList = new DataTransfer()
          imageFiles.forEach((file) => fileList.items.add(file))
          handleImageUpload(fileList.files)
        }
      }
    }

    // 处理粘贴事件
    const handlePaste = useCallback(
      (e: React.ClipboardEvent) => {
        if (!enableImageUpload) return

        const items = e.clipboardData?.items
        if (!items) return

        const imageFiles: File[] = []

        for (let i = 0; i < items.length; i++) {
          const item = items[i]
          if (item.type.startsWith("image/")) {
            const file = item.getAsFile()
            if (file) {
              imageFiles.push(file)
            }
          }
        }

        if (imageFiles.length > 0) {
          e.preventDefault()
          const fileList = new DataTransfer()
          imageFiles.forEach((file) => fileList.items.add(file))
          handleImageUpload(fileList.files)
        }
      },
      [enableImageUpload, handleImageUpload]
    )

    // 暴露给父组件的方法
    useImperativeHandle(
      ref,
      () => ({
        getValue: () => editorValue,
        setValue: (val: string) => {
          setEditorValue(val)
          onChange?.(val)
        },
        focus: () => {
          // 聚焦到编辑器
          const textarea = document.querySelector(
            ".w-md-editor-text-textarea"
          ) as HTMLTextAreaElement
          textarea?.focus()
        },
        insertImageMarkdown,
      }),
      [editorValue, onChange, insertImageMarkdown]
    )

    // 服务端渲染时显示加载占位符
    if (!mounted) {
      return (
        <div className={cn("rounded-lg border p-4", className)} style={{ height }}>
          <div className="flex h-full items-center justify-center">
            <div className="text-muted-foreground">正在加载 Markdown 编辑器...</div>
          </div>
        </div>
      )
    }

    return (
      <div className={cn("relative w-full", className)} data-color-mode={colorMode}>
        {/* 图片上传工具栏 */}
        {enableImageUpload && (
          <div className="bg-muted/50 mb-4 flex items-center gap-2 rounded-lg p-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImageIcon className="h-4 w-4" />
              )}
              <span className="ml-2">插入图片</span>
            </Button>

            <div className="text-muted-foreground text-xs">支持拖拽、粘贴图片或点击上传</div>

            {isUploading && (
              <div className="max-w-xs flex-1">
                <Progress value={uploadProgress} className="h-2" />
                <div className="text-muted-foreground mt-1 text-xs">正在上传图片...</div>
              </div>
            )}
          </div>
        )}

        {/* 隐藏的文件输入 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleImageUpload(e.target.files)}
        />

        {/* 编辑器容器 */}
        <div
          className={cn(
            "relative",
            isDragging && enableImageUpload && "ring-primary rounded-lg ring-2 ring-offset-2"
          )}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onPaste={handlePaste}
        >
          <MDEditor
            ref={editorRef}
            value={editorValue}
            onChange={handleEditorChange}
            height={height}
            preview={preview}
            visibleDragbar={visibleDragbar}
            data-color-mode={colorMode}
            textareaProps={{
              placeholder,
              style: {
                fontSize: 14,
                lineHeight: 1.6,
              },
            }}
            // 自定义工具栏高度（已弃用但仍可用）
            // toolbarHeight={60}
            // 自定义预览样式
            previewOptions={{
              style: {
                padding: "16px",
                backgroundColor: colorMode === "dark" ? "#0f0f0f" : "#ffffff",
              },
            }}
          />

          {/* 拖拽上传覆盖层 */}
          {isDragging && enableImageUpload && (
            <div className="bg-primary/20 absolute inset-0 z-50 flex items-center justify-center rounded-lg backdrop-blur-sm">
              <div className="text-center">
                <Upload className="text-primary mx-auto mb-4 h-12 w-12" />
                <div className="text-primary text-lg font-medium">拖拽图片到此处上传</div>
                <div className="text-muted-foreground mt-2 text-sm">
                  支持 JPG、PNG、WEBP、GIF 格式
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }
)

MarkdownEditor.displayName = "MarkdownEditor"

export { MarkdownEditor }
