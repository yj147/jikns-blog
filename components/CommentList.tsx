'use client'

import CommentItem from './CommentItem'
import type { CommentWithReplies } from '@/lib/supabase'

interface CommentListProps {
  comments: CommentWithReplies[]
  slug: string
  onCommentAdded: () => void
}

export default function CommentList({ comments, slug, onCommentAdded }: CommentListProps) {
  if (comments.length === 0) {
    return (
      <div className="py-8 text-center text-gray-500 dark:text-gray-400">
        <div className="mb-4">
          <svg
            className="mx-auto h-12 w-12 text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </div>
        <p>还没有评论，来发表第一个评论吧！</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg bg-gray-50 dark:bg-gray-800">
      {comments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          slug={slug}
          onCommentAdded={onCommentAdded}
        />
      ))}
    </div>
  )
}
