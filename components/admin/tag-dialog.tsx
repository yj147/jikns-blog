"use client"

/**
 * 标签创建/编辑对话框组件
 * Phase 10 - M2 阶段
 */

import { useActionState, useEffect, useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import type { ApiResponse, CreateTagData, TagData, UpdateTagData } from "@/lib/actions/tags"
import { normalizeTagSlug } from "@/lib/utils/tag"
import { toast } from "sonner"
import { Loader2, Hash } from "lucide-react"
import { TAG_NAME_REGEX } from "@/lib/validation/tag"

// 表单验证 Schema
const DEFAULT_TAG_COLOR = "#3b82f6"

const tagFormSchema = z.object({
  name: z
    .string()
    .min(1, "标签名称不能为空")
    .max(50, "标签名称最多50个字符")
    .regex(TAG_NAME_REGEX, "标签名称只能包含字母、数字、中文、空格、连字符、下划线和点"),
  description: z.string().max(200, "描述最多200个字符").optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "颜色格式必须为 #RRGGBB")
    .optional()
    .or(z.literal("")),
})

type TagFormData = z.infer<typeof tagFormSchema>

// 纯函数：构建创建载荷
function buildCreatePayload(formData: TagFormData): CreateTagData {
  return {
    name: formData.name,
    description: formData.description?.trim() || undefined,
    color: formData.color?.trim() || undefined,
  }
}

// 纯函数：构建更新载荷
function buildUpdatePayload(formData: TagFormData): UpdateTagData {
  const payload: UpdateTagData = { name: formData.name }
  const description = formData.description?.trim()
  const color = formData.color?.trim()

  if (description !== undefined) payload.description = description === "" ? null : description
  if (color !== undefined) payload.color = color === "" ? null : color

  return payload
}

export interface TagDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tag?: TagData
  onSuccess?: () => void
  createTagAction: (payload: CreateTagData) => Promise<ApiResponse<{ tag: TagData }>>
  updateTagAction: (tagId: string, payload: UpdateTagData) => Promise<ApiResponse<{ tag: TagData }>>
}

export function TagDialog({
  open,
  onOpenChange,
  tag,
  onSuccess,
  createTagAction,
  updateTagAction,
}: TagDialogProps) {
  const [generatedSlug, setGeneratedSlug] = useState("")
  const [optimisticMessage, setOptimisticMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const isEditMode = !!tag

  const form = useForm<TagFormData>({
    resolver: zodResolver(tagFormSchema),
    defaultValues: {
      name: "",
      description: "",
      color: DEFAULT_TAG_COLOR,
    },
  })

  const { reset, watch } = form
  const nameValue = watch("name")

  // 监听名称变化，自动生成 slug
  useEffect(() => {
    setGeneratedSlug(nameValue ? normalizeTagSlug(nameValue) : "")
  }, [nameValue])

  // 当对话框打开时，重置表单
  useEffect(() => {
    if (!open) return

    if (tag) {
      reset({
        name: tag.name,
        description: tag.description || "",
        color: tag.color || "",
      })
      setGeneratedSlug(tag.slug)
    } else {
      reset({
        name: "",
        description: "",
        color: DEFAULT_TAG_COLOR,
      })
      setGeneratedSlug("")
    }
  }, [open, tag, reset])

  type SubmitState = { status: "idle" | "success" | "error"; errorMessage?: string }

  const [submitState, submitAction] = useActionState<SubmitState, TagFormData>(
    async (_prevState, data) => {
      const fallbackErrorMessage = isEditMode ? "更新标签失败" : "创建标签失败"
      try {
        const response = isEditMode
          ? await updateTagAction(tag!.id, buildUpdatePayload(data))
          : await createTagAction(buildCreatePayload(data))

        if (response.success) {
          toast.success(isEditMode ? "标签已更新" : "标签已创建")
          onOpenChange(false)
          onSuccess?.()
          return { status: "success" }
        }

        if (response.error?.code === "DUPLICATE_ENTRY") {
          form.setError("name", {
            type: "manual",
            message: "该标签名称已存在",
          })
        } else {
          toast.error(response.error?.message || fallbackErrorMessage)
        }

        return {
          status: "error",
          errorMessage: response.error?.message || fallbackErrorMessage,
        }
      } catch (error) {
        toast.error(fallbackErrorMessage)
        return { status: "error", errorMessage: fallbackErrorMessage }
      }
    },
    { status: "idle" }
  )

  useEffect(() => {
    if (!isPending) {
      setOptimisticMessage(null)
    }
  }, [isPending])

  const onSubmit = (data: TagFormData) => {
    startTransition(() => {
      setOptimisticMessage(isEditMode ? "正在更新标签..." : "正在创建标签...")
      submitAction(data)
    })
  }

  const submissionError = submitState.status === "error" ? (submitState.errorMessage ?? null) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "编辑标签" : "创建标签"}</DialogTitle>
          <DialogDescription>
            {isEditMode ? "修改标签信息。" : "创建一个新的标签来组织你的文章。"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* 标签名称 */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    标签名称 <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="例如：JavaScript"
                      {...field}
                      disabled={isPending}
                      autoFocus
                    />
                  </FormControl>
                  <FormDescription>标签的显示名称，支持中英文、数字和常用符号</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Slug 预览 */}
            {generatedSlug && (
              <div className="bg-muted/50 rounded-lg border p-3">
                <div className="flex items-center gap-2 text-sm">
                  <Hash className="text-muted-foreground h-4 w-4" />
                  <span className="text-muted-foreground">URL 路径：</span>
                  <code className="text-foreground font-mono">{generatedSlug}</code>
                </div>
              </div>
            )}

            {/* 标签描述 */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>描述</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="简要描述这个标签的用途..."
                      className="resize-none"
                      rows={3}
                      {...field}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormDescription>可选，最多200个字符</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 标签颜色 */}
            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>颜色</FormLabel>
                  <div className="flex flex-wrap items-center gap-2">
                    <FormControl>
                      <Input
                        type="color"
                        className="h-10 w-20 cursor-pointer"
                        value={field.value || "#cccccc"}
                        onChange={(event) => field.onChange(event.target.value)}
                        disabled={isPending}
                        title={field.value ? "当前颜色" : "未设置颜色（显示为灰色占位）"}
                      />
                    </FormControl>
                    <FormControl>
                      <Input
                        placeholder={DEFAULT_TAG_COLOR}
                        className="flex-1"
                        value={field.value ?? ""}
                        disabled={isPending}
                        onChange={(e) => {
                          const value = e.target.value.trim()
                          if (value === "") {
                            field.onChange("")
                            return
                          }
                          const normalized = value.startsWith("#") ? value : `#${value}`
                          field.onChange(normalized.toLowerCase())
                        }}
                      />
                    </FormControl>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => field.onChange("")}
                      disabled={isPending || !field.value}
                    >
                      清除
                    </Button>
                  </div>
                  <FormDescription>可选，用于标签的视觉标识（格式：#RRGGBB）</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {optimisticMessage && (
              <p className="text-muted-foreground text-sm" aria-live="polite">
                {optimisticMessage}
              </p>
            )}

            {submissionError && (
              <p className="text-destructive text-sm" role="alert">
                {submissionError}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                取消
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditMode ? "保存更改" : "创建标签"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
