'use client'

import { useState } from 'react'
import Image from 'next/image'
import CommentFormWithEmoji from './CommentFormWithEmoji'
import type { CommentWithReplies } from '@/lib/supabase'

interface CommentItemProps {
  comment: CommentWithReplies
  slug: string
  onCommentAdded: () => void
  isReply?: boolean
}

export default function CommentItem({
  comment,
  slug,
  onCommentAdded,
  isReply = false,
}: CommentItemProps) {
  const [showReplyForm, setShowReplyForm] = useState(false)

  // 格式化时间 - 显示具体的年月日时分
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }

  const handleReplyClick = () => {
    setShowReplyForm(!showReplyForm)
  }

  const handleReplyAdded = () => {
    setShowReplyForm(false)
    onCommentAdded()
  }

  return (
    <div className={`${isReply ? 'ml-8 md:ml-12' : ''}`}>
      <div className="border-b border-gray-200 p-4 last:border-b-0 dark:border-gray-700">
        <div className="flex space-x-3">
          {/* 头像 */}
          <div className="flex-shrink-0">
            <div className="relative h-10 w-10 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              {comment.avatar_url ? (
                <Image
                  src={comment.avatar_url}
                  alt={`${comment.author_name}的头像`}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-semibold text-gray-500 dark:text-gray-400">
                  {comment.author_name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>

          {/* 右侧内容区域 */}
          <div className="flex-1">
            {/* 姓名 */}
            <div className="mb-1" style={{ textAlign: 'left' }}>
              <h4
                className="text-sm font-semibold text-gray-900 dark:text-gray-100"
                style={{ textAlign: 'left' }}
              >
                {comment.author_website ? (
                  <a
                    href={comment.author_website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-primary-500 transition-colors"
                  >
                    {comment.author_name}
                  </a>
                ) : (
                  comment.author_name
                )}
              </h4>
            </div>

            {/* 时间 */}
            <div className="mb-2" style={{ textAlign: 'left' }}>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatDate(comment.created_at)}
              </span>
            </div>

            {/* 评论正文 */}
            <div
              className="mb-3 text-sm leading-relaxed whitespace-pre-wrap text-gray-700 dark:text-gray-300"
              style={{ textAlign: 'left' }}
            >
              {comment.content}
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center">
              <button
                onClick={handleReplyClick}
                className="bg-primary-500 hover:bg-primary-600 rounded-md px-3 py-1 text-xs text-white transition-colors"
              >
                回复
              </button>
            </div>
          </div>
        </div>

        {/* 回复表单 */}
        {showReplyForm && (
          <div className="mt-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
            <CommentFormWithEmoji
              slug={slug}
              parentId={comment.id}
              onCommentAdded={handleReplyAdded}
              onCancel={() => setShowReplyForm(false)}
              placeholder={`回复 @${comment.author_name}...`}
            />
          </div>
        )}

        {/* 回复列表 */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-4 space-y-4">
            {comment.replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                slug={slug}
                onCommentAdded={onCommentAdded}
                isReply={true}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
