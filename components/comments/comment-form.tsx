"use client"

import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { fetchPost, FetchError } from "@/lib/api/fetch-json"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import type { Comment } from "@/types/comments"

export interface CommentFormSuccessContext {
  parentId?: string | null
  comment?: Comment
}

export interface CommentFormProps {
  targetType: "post" | "activity"
  targetId: string
  parentId?: string
  onSuccess?: (context?: CommentFormSuccessContext) => void
  onCancel?: () => void
  placeholder?: string
}

interface CommentFormData {
  content: string
}

const CommentForm: React.FC<CommentFormProps> = ({
  targetType,
  targetId,
  parentId,
  onSuccess,
  onCancel,
  placeholder = "写下你的评论...",
}) => {
  const { user } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<CommentFormData>()

  const content = watch("content", "")
  const contentLength = content.length
  const maxLength = 1000

  // 提交评论
  const onSubmit = async (data: CommentFormData) => {
    if (!user) {
      toast({
        title: "请先登录",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const payload = await fetchPost("/api/comments", {
        content: data.content.trim(),
        targetType,
        targetId,
        parentId,
      })

      const comment = (payload?.data ?? payload) as Comment

      toast({
        title: "评论发表成功",
      })

      // 重置表单
      reset()

      // 调用成功回调
      onSuccess?.({ parentId: parentId ?? null, comment })
    } catch (error) {
      const message = error instanceof FetchError ? error.message : "发表评论失败，请稍后重试"

      toast({
        title: message,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // 如果用户未登录，显示登录提示
  if (!user) {
    return (
      <div className="rounded-lg bg-gray-50 p-4 text-center">
        <p className="mb-3 text-gray-600">登录后即可发表评论</p>
        <Button onClick={() => (window.location.href = "/login")} variant="default">
          立即登录
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Textarea
          {...register("content", {
            required: "请输入评论内容",
            minLength: {
              value: 1,
              message: "评论内容不能为空",
            },
            maxLength: {
              value: maxLength,
              message: `评论内容不能超过 ${maxLength} 字`,
            },
            validate: (value) => {
              const trimmed = value.trim()
              if (!trimmed) {
                return "评论内容不能为空"
              }
              if (trimmed.length > maxLength) {
                return `评论内容不能超过 ${maxLength} 字`
              }
              return true
            },
          })}
          placeholder={placeholder}
          className="min-h-[100px] resize-none"
          disabled={isSubmitting}
        />

        {/* 字数统计和错误提示 */}
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className={`${errors.content ? "text-red-500" : "text-gray-500"}`}>
            {errors.content?.message}
          </span>
          <span className={`${contentLength > maxLength ? "text-red-500" : "text-gray-500"}`}>
            {contentLength} / {maxLength}
          </span>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center justify-end space-x-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            取消
          </Button>
        )}
        <Button
          type="submit"
          disabled={isSubmitting || !content.trim() || contentLength > maxLength}
        >
          {isSubmitting ? "发送中..." : "发表评论"}
        </Button>
      </div>
    </form>
  )
}

export default CommentForm
