'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Comment } from '@/lib/supabase'

export default function AdminCommentsPage() {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('all')

  const fetchComments = useCallback(async () => {
    setLoading(true)
    try {
      let url = '/api/admin/comments'
      if (filter !== 'all') {
        url += `?filter=${filter}`
      }

      const response = await fetch(url)
      const data = await response.json()

      if (data.success) {
        setComments(data.comments)
      } else {
        console.error('Error fetching comments:', data.error)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  const updateCommentStatus = useCallback(
    async (commentId: string, isApproved: boolean) => {
      try {
        const response = await fetch(`/api/admin/comments/${commentId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ is_approved: isApproved }),
        })

        const data = await response.json()

        if (data.success) {
          fetchComments()
        } else {
          console.error('Error updating comment:', data.error)
          alert('更新失败')
        }
      } catch (error) {
        console.error('Error:', error)
        alert('更新失败')
      }
    },
    [fetchComments]
  )

  const deleteComment = useCallback(
    async (commentId: string) => {
      if (!confirm('确定要删除这条评论吗？')) {
        return
      }

      try {
        const response = await fetch(`/api/admin/comments/${commentId}`, {
          method: 'DELETE',
        })

        const data = await response.json()

        if (data.success) {
          fetchComments()
        } else {
          console.error('Error deleting comment:', data.error)
          alert('删除失败')
        }
      } catch (error) {
        console.error('Error:', error)
        alert('删除失败')
      }
    },
    [fetchComments]
  )

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN')
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="border-primary-500 h-12 w-12 animate-spin rounded-full border-b-2"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="mb-4 text-3xl font-bold text-gray-900 dark:text-gray-100">评论管理</h1>

        {/* 过滤器 */}
        <div className="mb-6 flex space-x-4">
          <button
            onClick={() => setFilter('all')}
            className={`rounded-md px-4 py-2 ${
              filter === 'all'
                ? 'bg-primary-500 text-white'
                : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            全部评论 ({comments.length})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`rounded-md px-4 py-2 ${
              filter === 'pending'
                ? 'bg-primary-500 text-white'
                : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            待审核
          </button>
          <button
            onClick={() => setFilter('approved')}
            className={`rounded-md px-4 py-2 ${
              filter === 'approved'
                ? 'bg-primary-500 text-white'
                : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            已批准
          </button>
        </div>
      </div>

      {/* 评论列表 */}
      <div className="space-y-4">
        {comments.length === 0 ? (
          <div className="py-8 text-center text-gray-500 dark:text-gray-400">没有找到评论</div>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className="rounded-lg border border-gray-200 bg-white p-6 shadow-md dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    {comment.author_name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{comment.author_email}</p>
                  {comment.author_website && (
                    <a
                      href={comment.author_website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-500 hover:text-primary-600 text-sm"
                    >
                      {comment.author_website}
                    </a>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(comment.created_at)}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    文章: {comment.post_slug}
                  </div>
                  <div
                    className={`inline-block rounded px-2 py-1 text-xs ${
                      comment.is_approved
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                    }`}
                  >
                    {comment.is_approved ? '已批准' : '待审核'}
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                  {comment.content}
                </p>
              </div>

              <div className="flex space-x-2">
                {!comment.is_approved && (
                  <button
                    onClick={() => updateCommentStatus(comment.id, true)}
                    className="rounded bg-green-500 px-3 py-1 text-sm text-white hover:bg-green-600"
                  >
                    批准
                  </button>
                )}
                {comment.is_approved && (
                  <button
                    onClick={() => updateCommentStatus(comment.id, false)}
                    className="rounded bg-yellow-500 px-3 py-1 text-sm text-white hover:bg-yellow-600"
                  >
                    取消批准
                  </button>
                )}
                <button
                  onClick={() => deleteComment(comment.id)}
                  className="rounded bg-red-500 px-3 py-1 text-sm text-white hover:bg-red-600"
                >
                  删除
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
