'use client'

import { useState, useEffect, useRef } from 'react'
import type { CommentFormData } from '@/lib/supabase'
import { commentSchema, safeValidate } from '@/lib/validation'
import EmojiPicker from './EmojiPicker'

interface CommentFormProps {
  slug: string
  parentId?: string
  onCommentAddedAction: () => void
  onCancel?: () => void
  placeholder?: string
}

export default function CommentForm({
  slug,
  parentId,
  onCommentAddedAction,
  onCancel,
  placeholder = '说点什么吧......',
}: CommentFormProps) {
  const [formData, setFormData] = useState<CommentFormData>({
    author_name: '',
    author_email: '',
    author_website: '',
    content: '',
    parent_id: parentId || undefined,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const emojiButtonRef = useRef<HTMLButtonElement>(null)

  // 从 localStorage 加载用户信息
  useEffect(() => {
    const savedUserInfo = localStorage.getItem('comment_user_info')
    if (savedUserInfo) {
      try {
        const userInfo = JSON.parse(savedUserInfo)
        setFormData((prev) => ({
          ...prev,
          author_name: userInfo.author_name || '',
          author_email: userInfo.author_email || '',
          author_website: userInfo.author_website || '',
        }))
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Failed to parse saved user info:', error)
        }
      }
    }
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleEmojiSelect = (emoji: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const currentContent = formData.content

    // 在光标位置插入表情
    const newContent = currentContent.slice(0, start) + emoji + currentContent.slice(end)

    setFormData((prev) => ({
      ...prev,
      content: newContent,
    }))

    // 设置新的光标位置
    setTimeout(() => {
      const newCursorPos = start + emoji.length
      textarea.setSelectionRange(newCursorPos, newCursorPos)
      textarea.focus()
    }, 0)
  }

  const toggleEmojiPicker = () => {
    setShowEmojiPicker(!showEmojiPicker)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 清除之前的错误
    setFieldErrors({})
    setMessage(null)

    // 准备提交数据（匿名评论）
    const submitData = {
      ...formData,
      post_slug: slug,
      user_id: undefined,
      is_anonymous: true,
      parent_id: parentId || undefined,
    }

    // 使用统一的验证schema进行验证
    const validationResult = safeValidate(commentSchema, submitData)

    if (!validationResult.success) {
      // 显示字段级错误
      if (validationResult.errors) {
        const fieldErrors: Record<string, string> = {}
        validationResult.errors.forEach((err) => {
          const path = Array.isArray(err.path) ? err.path.join('.') : String(err.path || 'unknown')
          fieldErrors[path] = err.message
        })
        setFieldErrors(fieldErrors)
      }
      setMessage({ type: 'error', text: validationResult.error })
      return
    }

    setIsSubmitting(true)

    try {
      // 保存用户信息到 localStorage
      const userInfo = {
        author_name: formData.author_name,
        author_email: formData.author_email,
        author_website: formData.author_website,
      }
      localStorage.setItem('comment_user_info', JSON.stringify(userInfo))

      // 提交评论
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      })

      const data = await response.json()

      if (data.success) {
        setMessage({ type: 'success', text: data.message })
        // 清空评论内容，但保留用户信息
        setFormData((prev) => ({
          ...prev,
          content: '',
        }))
        setShowEmojiPicker(false)
        // 通知父组件刷新评论列表
        onCommentAddedAction()
        // 如果是回复，关闭回复表单
        if (onCancel) {
          setTimeout(() => onCancel(), 1500)
        }
      } else {
        setMessage({ type: 'error', text: data.error })
      }
    } catch (error) {
      setMessage({ type: 'error', text: '网络错误，请稍后重试' })
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to submit comment:', error)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 用户信息字段 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <input
            type="text"
            name="author_name"
            value={formData.author_name}
            onChange={handleInputChange}
            placeholder="姓名或昵称"
            className={`focus:ring-primary-500 w-full rounded-md border px-3 py-2 focus:border-transparent focus:ring-2 focus:outline-none dark:bg-gray-800 dark:text-white ${
              fieldErrors.author_name
                ? 'border-red-500 dark:border-red-400'
                : 'border-gray-300 dark:border-gray-600'
            }`}
          />
          {fieldErrors.author_name && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.author_name}</p>
          )}
        </div>
        <div>
          <input
            type="email"
            name="author_email"
            value={formData.author_email}
            onChange={handleInputChange}
            placeholder="邮箱（必填但不公开）"
            className={`focus:ring-primary-500 w-full rounded-md border px-3 py-2 focus:border-transparent focus:ring-2 focus:outline-none dark:bg-gray-800 dark:text-white ${
              fieldErrors.author_email
                ? 'border-red-500 dark:border-red-400'
                : 'border-gray-300 dark:border-gray-600'
            }`}
          />
          {fieldErrors.author_email && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {fieldErrors.author_email}
            </p>
          )}
        </div>
        <div>
          <input
            type="url"
            name="author_website"
            value={formData.author_website}
            onChange={handleInputChange}
            placeholder="网站或博客"
            className={`focus:ring-primary-500 w-full rounded-md border px-3 py-2 focus:border-transparent focus:ring-2 focus:outline-none dark:bg-gray-800 dark:text-white ${
              fieldErrors.author_website
                ? 'border-red-500 dark:border-red-400'
                : 'border-gray-300 dark:border-gray-600'
            }`}
          />
          {fieldErrors.author_website && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {fieldErrors.author_website}
            </p>
          )}
        </div>
      </div>

      {/* 评论内容 */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          name="content"
          value={formData.content}
          onChange={handleInputChange}
          placeholder={placeholder}
          rows={parentId ? 3 : 5}
          className={`focus:ring-primary-500 w-full resize-none rounded-md border px-3 py-2 pb-12 focus:border-transparent focus:ring-2 focus:outline-none dark:bg-gray-800 dark:text-white ${
            fieldErrors.content
              ? 'border-red-500 dark:border-red-400'
              : 'border-gray-300 dark:border-gray-600'
          }`}
        />
        {fieldErrors.content && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.content}</p>
        )}

        {/* 表情按钮 */}
        <div className="absolute bottom-2 left-2">
          <button
            ref={emojiButtonRef}
            type="button"
            onClick={toggleEmojiPicker}
            className={`rounded-md p-2 transition-all duration-200 hover:scale-110 ${
              showEmojiPicker
                ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400'
                : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300'
            }`}
            title="选择表情"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>

          {/* 表情选择器 */}
          <EmojiPicker
            isOpen={showEmojiPicker}
            onClose={() => setShowEmojiPicker(false)}
            onEmojiSelect={handleEmojiSelect}
            triggerRef={emojiButtonRef}
          />
        </div>
      </div>

      {/* 提交按钮 */}
      <div className="flex items-center justify-between">
        <div className="flex space-x-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-primary-500 hover:bg-primary-600 focus:ring-primary-500 rounded-md px-6 py-2 text-white transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? '发表中...' : '发表评论'}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-600 transition-colors hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            >
              取消
            </button>
          )}
        </div>

        {/* 私密评论选项 */}
        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
          <span className="mr-2">私密评论</span>
          <div className="relative mr-2 inline-block w-10 align-middle select-none">
            <input
              id="private-comment-toggle"
              type="checkbox"
              className="toggle-checkbox absolute block h-6 w-6 cursor-pointer appearance-none rounded-full border-4 bg-white"
            />
            <label
              htmlFor="private-comment-toggle"
              className="toggle-label block h-6 cursor-pointer overflow-hidden rounded-full bg-gray-300"
            >
              <span className="sr-only">私密评论开关</span>
            </label>
          </div>
        </div>
      </div>

      {/* 消息提示 */}
      {message && (
        <div
          className={`rounded-md p-3 ${
            message.type === 'success'
              ? 'border border-green-200 bg-green-50 text-green-800'
              : 'border border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}
    </form>
  )
}
