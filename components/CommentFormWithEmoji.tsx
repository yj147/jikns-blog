'use client'

import { useState, useEffect, useRef } from 'react'
import type { CommentFormData } from '@/lib/supabase'
import { commentSchema, safeValidate } from '@/lib/validation'
import EmojiPicker from './EmojiPicker'
import { useAuth } from '@/components/auth'

interface CommentFormWithEmojiProps {
  slug: string
  parentId?: string
  onCommentAdded: () => void
  onCancel?: () => void
  placeholder?: string
}

export default function CommentFormWithEmoji({
  slug,
  parentId,
  onCommentAdded,
  onCancel,
  placeholder = '说点什么吧......',
}: CommentFormWithEmojiProps) {
  const { user, loading } = useAuth()

  const [formData, setFormData] = useState<CommentFormData>({
    author_name: '',
    author_email: '',
    author_website: '',
    content: '',
    parent_id: parentId || undefined,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isFocused, setIsFocused] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const emojiButtonRef = useRef<HTMLButtonElement>(null)

  // 根据用户登录状态初始化表单数据
  useEffect(() => {
    if (user) {
      // 登录用户：使用账户信息
      setFormData((prev) => ({
        ...prev,
        author_name: user.display_name || user.email?.split('@')[0] || '',
        author_email: user.email || '',
        author_website: user.website || '',
      }))
    } else {
      // 匿名用户：从 localStorage 加载保存的信息
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
          console.error('Failed to parse saved user info:', error)
        }
      }
    }
  }, [user])

  // 监听内容变化，判断是否在输入
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsTyping(false)
    }, 1000)

    return () => clearTimeout(timer)
  }, [formData.content])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))

    if (name === 'content') {
      setIsTyping(true)
    }
  }

  const handleFocus = () => {
    setIsFocused(true)
  }

  const handleBlur = () => {
    // 延迟设置失焦状态，避免点击提交按钮时立即失焦
    setTimeout(() => {
      if (!textareaRef.current?.matches(':focus')) {
        setIsFocused(false)
      }
    }, 100)
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

    setIsTyping(true)
  }

  const toggleEmojiPicker = () => {
    setShowEmojiPicker(!showEmojiPicker)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 清除之前的错误
    setFieldErrors({})
    setMessage(null)

    // 准备提交数据
    const submitData = {
      ...formData,
      post_slug: slug,
      user_id: user?.id || undefined,
      is_anonymous: !user,
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
      // 只有匿名用户才保存信息到 localStorage
      if (!user) {
        const userInfo = {
          author_name: formData.author_name,
          author_email: formData.author_email,
          author_website: formData.author_website,
        }
        localStorage.setItem('comment_user_info', JSON.stringify(userInfo))
      }

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
        setIsFocused(false)
        setIsTyping(false)
        setShowEmojiPicker(false)
        // 通知父组件刷新评论列表
        onCommentAdded()
        // 如果是回复，关闭回复表单
        if (onCancel) {
          setTimeout(() => onCancel(), 1500)
        }
      } else {
        setMessage({ type: 'error', text: data.error })
      }
    } catch (error) {
      setMessage({ type: 'error', text: '网络错误，请稍后重试' })
      console.error('Failed to submit comment:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // 表情包角色配置
  const emojiCharacters = [
    { emoji: '🥰', message: '快来聊聊吧~', color: 'from-pink-300 to-purple-400' },
    { emoji: '😊', message: '有什么想说的吗？', color: 'from-yellow-300 to-orange-400' },
    { emoji: '🤔', message: '在想什么呢？', color: 'from-blue-300 to-indigo-400' },
    { emoji: '😎', message: '说点酷的！', color: 'from-gray-300 to-gray-500' },
    { emoji: '🎉', message: '分享你的想法！', color: 'from-green-300 to-teal-400' },
  ]

  // 根据时间选择不同的角色
  const currentCharacter = emojiCharacters[Math.floor(Date.now() / 10000) % emojiCharacters.length]

  // 判断是否显示表情包（未聚焦且未输入时显示）
  const showEmoji = !isFocused && !isTyping && !formData.content.trim()

  return (
    <div className="relative">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 用户状态显示 */}
        {user ? (
          <div className="flex items-center space-x-3 rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20">
            <div className="flex-shrink-0">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.display_name || '用户头像'}
                  className="h-8 w-8 rounded-full"
                />
              ) : (
                <div className="bg-primary-500 flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium text-white">
                  {(user.display_name || user.email || '?')[0].toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                以 {user.display_name || user.email} 身份评论
              </p>
              <p className="text-xs text-green-600 dark:text-green-400">已登录用户</p>
            </div>
          </div>
        ) : (
          <>
            {/* 匿名用户信息字段 */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <input
                  type="text"
                  name="author_name"
                  value={formData.author_name}
                  onChange={handleInputChange}
                  placeholder="姓名或昵称"
                  className={`focus:ring-primary-500 w-full rounded-md border px-3 py-2 transition-all duration-200 focus:border-transparent focus:ring-2 focus:outline-none dark:bg-gray-800 dark:text-white ${
                    fieldErrors.author_name
                      ? 'border-red-500 dark:border-red-400'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                />
                {fieldErrors.author_name && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {fieldErrors.author_name}
                  </p>
                )}
              </div>
              <div>
                <input
                  type="email"
                  name="author_email"
                  value={formData.author_email}
                  onChange={handleInputChange}
                  placeholder="邮箱（必填但不公开）"
                  className={`focus:ring-primary-500 w-full rounded-md border px-3 py-2 transition-all duration-200 focus:border-transparent focus:ring-2 focus:outline-none dark:bg-gray-800 dark:text-white ${
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
                  placeholder="网站（可选）"
                  className={`focus:ring-primary-500 w-full rounded-md border px-3 py-2 transition-all duration-200 focus:border-transparent focus:ring-2 focus:outline-none dark:bg-gray-800 dark:text-white ${
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
          </>
        )}

        {/* 评论内容区域 */}
        <div className="relative">
          <div
            className={`relative transition-all duration-300 ${showEmoji ? 'pr-20 md:pr-24' : ''}`}
          >
            <textarea
              ref={textareaRef}
              name="content"
              value={formData.content}
              onChange={handleInputChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              placeholder={placeholder}
              rows={parentId ? 3 : 5}
              className={`focus:ring-primary-500 w-full resize-none rounded-md border px-3 py-2 pb-12 transition-all duration-300 focus:border-transparent focus:ring-2 focus:outline-none dark:bg-gray-800 dark:text-white ${
                fieldErrors.content
                  ? 'border-red-500 dark:border-red-400'
                  : showEmoji
                    ? 'border-pink-200 bg-pink-50 dark:border-pink-700 dark:bg-pink-900/10'
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

          {/* 表情包角色 */}
          <div
            className={`absolute top-2 right-2 transform transition-all duration-500 ${
              showEmoji
                ? 'translate-x-0 scale-100 opacity-100'
                : 'pointer-events-none translate-x-4 scale-75 opacity-0'
            }`}
          >
            <div className="group relative">
              {/* 可爱的小角色 */}
              <div className="emoji-character relative h-14 w-14 cursor-pointer sm:h-16 sm:w-16 md:h-20 md:w-20">
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${currentCharacter.color} animate-pulse rounded-full transition-all duration-300 group-hover:animate-bounce`}
                ></div>
                <div className="absolute inset-1 flex items-center justify-center rounded-full bg-white shadow-inner dark:bg-gray-800">
                  <div className="transform text-xl transition-transform duration-300 group-hover:scale-110 sm:text-2xl md:text-3xl">
                    {currentCharacter.emoji}
                  </div>
                </div>

                {/* 悬浮时的光晕效果 */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
              </div>

              {/* 对话气泡 - 移动端优化 */}
              <div
                className={`speech-bubble absolute top-1/2 -left-20 -translate-y-1/2 transform rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs whitespace-nowrap text-gray-600 shadow-lg transition-all duration-300 sm:-left-24 sm:px-3 sm:py-2 md:-left-28 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 ${
                  showEmoji ? 'translate-x-0 opacity-100' : 'translate-x-2 opacity-0'
                }`}
              >
                <span className="hidden sm:inline">{currentCharacter.message}</span>
                <span className="sm:hidden">
                  {currentCharacter.message.length > 8
                    ? currentCharacter.message.substring(0, 6) + '...'
                    : currentCharacter.message}
                </span>
                <div className="absolute top-1/2 right-0 h-0 w-0 translate-x-1 -translate-y-1/2 transform border-t-2 border-b-2 border-l-4 border-t-transparent border-b-transparent border-l-white dark:border-l-gray-700"></div>
              </div>

              {/* 装饰性粒子效果 */}
              <div className="sparkle-1 absolute -top-1 -right-1 h-2 w-2 animate-ping rounded-full bg-yellow-300 opacity-75 sm:h-3 sm:w-3"></div>
              <div className="sparkle-2 absolute -bottom-1 -left-1 h-1.5 w-1.5 animate-pulse rounded-full bg-pink-300 sm:h-2 sm:w-2"></div>
              <div className="sparkle-3 absolute top-1/2 -right-2 h-1 w-1 animate-bounce rounded-full bg-blue-300"></div>
            </div>
          </div>
        </div>

        {/* 提交按钮和选项 */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-primary-600 hover:bg-primary-700 focus:ring-primary-500 transform rounded-md px-6 py-2 text-white transition-all duration-200 hover:scale-105 focus:ring-2 focus:ring-offset-2 focus:outline-none active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? '发布中...' : '发布评论'}
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
                type="checkbox"
                className="toggle-checkbox absolute block h-6 w-6 cursor-pointer appearance-none rounded-full border-4 bg-white transition-all duration-200"
              />
              <label className="toggle-label block h-6 cursor-pointer overflow-hidden rounded-full bg-gray-300 transition-all duration-200"></label>
            </div>
          </div>
        </div>

        {/* 消息提示 */}
        {message && (
          <div
            className={`rounded-md p-3 transition-all duration-300 ${
              message.type === 'success'
                ? 'border border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300'
                : 'border border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300'
            }`}
          >
            {message.text}
          </div>
        )}
      </form>
    </div>
  )
}
