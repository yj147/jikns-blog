'use client'

import { useState, useEffect } from 'react'

interface LikeButtonProps {
  slug: string
  userId?: string
  iconType?: 'single' | 'double' // 单个或双个顶呱呱图标
  className?: string
}

export default function LikeButton({
  slug,
  userId,
  iconType = 'single',
  className = '',
}: LikeButtonProps) {
  const [liked, setLiked] = useState(false)
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [animating, setAnimating] = useState(false)

  // 获取点赞状态和数量
  const fetchLikeData = async () => {
    try {
      const url = userId
        ? `/api/likes/${encodeURIComponent(slug)}?user_id=${userId}`
        : `/api/likes/${encodeURIComponent(slug)}`

      const response = await fetch(url)
      const data = await response.json()

      if (data.success) {
        setLiked(data.liked)
        setCount(data.count)
      }
    } catch (error) {
      console.error('Failed to fetch like data:', error)
    }
  }

  // 处理点赞/取消点赞
  const handleLike = async () => {
    if (loading) return

    setLoading(true)
    setAnimating(true)

    try {
      const response = await fetch('/api/likes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_slug: slug,
          user_id: userId,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setLiked(data.liked)
        setCount(data.count)

        // 动画效果
        setTimeout(() => {
          setAnimating(false)
        }, 600)
      } else {
        console.error('Like operation failed:', data.error)
        setAnimating(false)
      }
    } catch (error) {
      console.error('Failed to like:', error)
      setAnimating(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLikeData()
  }, [slug, userId])

  // 单个顶呱呱图标
  const SingleThumbIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M7.493 18.75c-.425 0-.82-.236-.975-.632A7.48 7.48 0 016 15.375c0-1.75.599-3.358 1.602-4.634.151-.192.373-.309.6-.397.473-.183.89-.514 1.212-.924a9.042 9.042 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75 2.25 2.25 0 012.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558-.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H14.23c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23h-.777zM2.331 10.977a11.969 11.969 0 00-.831 4.398 12 12 0 00.52 3.507c.26.85 1.084 1.368 1.973 1.368H4.9c.445 0 .72-.498.523-.898a8.963 8.963 0 01-.924-3.977c0-1.708.476-3.305 1.302-4.666.245-.403-.028-.959-.5-.959H4.25c-.832 0-1.612.453-1.918 1.227z" />
    </svg>
  )

  // 双个顶呱呱图标
  const DoubleThumbIcon = ({ className }: { className?: string }) => (
    <div className={`flex items-center ${className}`}>
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M7.493 18.75c-.425 0-.82-.236-.975-.632A7.48 7.48 0 016 15.375c0-1.75.599-3.358 1.602-4.634.151-.192.373-.309.6-.397.473-.183.89-.514 1.212-.924a9.042 9.042 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75 2.25 2.25 0 012.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558-.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H14.23c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23h-.777zM2.331 10.977a11.969 11.969 0 00-.831 4.398 12 12 0 00.52 3.507c.26.85 1.084 1.368 1.973 1.368H4.9c.445 0 .72-.498.523-.898a8.963 8.963 0 01-.924-3.977c0-1.708.476-3.305 1.302-4.666.245-.403-.028-.959-.5-.959H4.25c-.832 0-1.612.453-1.918 1.227z" />
      </svg>
      <svg className="-ml-1 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M7.493 18.75c-.425 0-.82-.236-.975-.632A7.48 7.48 0 016 15.375c0-1.75.599-3.358 1.602-4.634.151-.192.373-.309.6-.397.473-.183.89-.514 1.212-.924a9.042 9.042 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75 2.25 2.25 0 012.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558-.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H14.23c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23h-.777zM2.331 10.977a11.969 11.969 0 00-.831 4.398 12 12 0 00.52 3.507c.26.85 1.084 1.368 1.973 1.368H4.9c.445 0 .72-.498.523-.898a8.963 8.963 0 01-.924-3.977c0-1.708.476-3.305 1.302-4.666.245-.403-.028-.959-.5-.959H4.25c-.832 0-1.612.453-1.918 1.227z" />
      </svg>
    </div>
  )

  return (
    <div className={`flex items-center justify-center space-x-3 ${className}`}>
      <button
        onClick={handleLike}
        disabled={loading}
        className={`relative flex items-center space-x-2 rounded-full px-4 py-2 transition-all duration-300 ${
          liked
            ? 'border-2 border-red-200 bg-red-50 text-red-500 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400'
            : 'border-2 border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
        } ${animating ? 'animate-pulse' : ''} ${loading ? 'cursor-not-allowed opacity-50' : 'hover:scale-105 active:scale-95'} `}
        title={liked ? '取消点赞' : '点赞文章'}
      >
        {/* 动画效果容器 */}
        <div
          className={`transition-transform duration-300 ${animating ? 'animate-bounce' : ''} ${liked ? 'scale-110' : 'scale-100'} `}
        >
          {iconType === 'double' ? (
            <DoubleThumbIcon className="h-5 w-5" />
          ) : (
            <SingleThumbIcon className="h-5 w-5" />
          )}
        </div>

        {/* 点赞数量 */}
        <span
          className={`text-sm font-medium transition-all duration-300 ${animating ? 'animate-pulse' : ''} `}
        >
          {count > 0 ? count : '点赞'}
        </span>

        {/* 点击动画效果 */}
        {animating && (
          <div className="absolute inset-0 animate-ping rounded-full border-2 border-red-400 opacity-75"></div>
        )}
      </button>

      {/* 提示文字 */}
      <div className="text-xs text-gray-500 dark:text-gray-400">
        {liked ? '感谢您的点赞！' : '如果觉得文章有用，请点赞支持'}
      </div>
    </div>
  )
}
