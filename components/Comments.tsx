'use client'

import { useState, useEffect } from 'react'
import CommentFormWithEmoji from './CommentFormWithEmoji'
import CommentList from './CommentList'
import Pagination from './Pagination'
import { useAuth } from '@/components/auth'
import type { CommentWithReplies } from '@/lib/supabase'

interface CommentsProps {
  slug: string
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export default function Comments({ slug }: CommentsProps) {
  const { user } = useAuth()
  const [comments, setComments] = useState<CommentWithReplies[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  })

  // 获取评论列表
  const fetchComments = async (page: number = 1) => {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/comments/${encodeURIComponent(slug)}?page=${page}&limit=10`
      )
      const data = await response.json()

      if (data.success) {
        setComments(data.comments)
        setPagination(data.pagination)
        setError(null)
      } else {
        setError(data.error || '获取评论失败')
      }
    } catch (err) {
      setError('网络错误，请稍后重试')
      console.error('Failed to fetch comments:', err)
    } finally {
      setLoading(false)
    }
  }

  // 处理页码变化
  const handlePageChange = (page: number) => {
    fetchComments(page)
    // 滚动到评论区顶部
    const commentsSection = document.querySelector('.comments-section')
    if (commentsSection) {
      commentsSection.scrollIntoView({ behavior: 'smooth' })
    }
  }

  // 添加新评论后刷新列表（回到第一页）
  const handleCommentAdded = () => {
    fetchComments(1)
  }

  useEffect(() => {
    fetchComments(1)
  }, [slug])

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="border-primary-500 h-8 w-8 animate-spin rounded-full border-b-2"></div>
      </div>
    )
  }

  return (
    <div className="comments-section">
      {/* 评论列表 */}
      <div className="mb-8">
        {error ? (
          <div className="py-4 text-center text-red-500">{error}</div>
        ) : (
          <>
            <div className="mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {pagination.total} 条评论
              </h3>
            </div>
            <CommentList comments={comments} slug={slug} onCommentAdded={handleCommentAdded} />

            {/* 分页组件 */}
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={handlePageChange}
              hasNext={pagination.hasNext}
              hasPrev={pagination.hasPrev}
            />
          </>
        )}
      </div>

      {/* 评论表单 */}
      <div className="border-t border-gray-200 pt-8 dark:border-gray-700">
        <div className="mb-6">
          <h3 className="mb-2 text-xl font-bold text-gray-900 dark:text-gray-100">发表评论</h3>
          <div className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            {user ? (
              <>您正在以登录用户身份发表评论，评论将关联到您的账户。</>
            ) : (
              <>
                您可以匿名发表评论，我们使用Cookie技术保留您的个人信息以便下次快速评论。
                继续评论表示您已同意该条款。
              </>
            )}
          </div>
        </div>
        <CommentFormWithEmoji slug={slug} onCommentAdded={handleCommentAdded} />
      </div>
    </div>
  )
}
