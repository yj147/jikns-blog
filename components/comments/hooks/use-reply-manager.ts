"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import type { CommentsApiResponse } from "@/components/comments/hooks/use-comments-data"
import { fetchGet } from "@/lib/api/fetch-json"
import type { Comment, CommentTargetType } from "@/types/comments"

const REPLY_PAGE_SIZE = 20

export type ReplyState = {
  data: Comment[]
  loading: boolean
  error: string | null
  hasMore: boolean
  nextCursor: string | null
}

export type ReplyCache = Record<string, ReplyState>

export function useReplyManager(targetType: CommentTargetType, targetId: string) {
  const [replyCache, setReplyCache] = useState<ReplyCache>({})
  const [openReplies, setOpenReplies] = useState<Set<string>>(new Set())
  const cacheRef = useRef(replyCache)

  useEffect(() => {
    cacheRef.current = replyCache
  }, [replyCache])

  const resetAll = useCallback(() => {
    setReplyCache({})
    setOpenReplies(new Set())
  }, [])

  const invalidate = useCallback((commentId: string) => {
    setReplyCache((prev) => {
      if (!prev[commentId]) {
        return prev
      }
      const next = { ...prev }
      delete next[commentId]
      return next
    })
  }, [])

  const loadReplies = useCallback(
    async (commentId: string, options?: { cursor?: string | null; append?: boolean }) => {
      const { cursor, append = false } = options ?? {}

      setReplyCache((prev) => {
        const previous = prev[commentId]
        return {
          ...prev,
          [commentId]: {
            data: previous?.data ?? [],
            loading: true,
            error: null,
            hasMore: previous?.hasMore ?? false,
            nextCursor: previous?.nextCursor ?? null,
          },
        }
      })

      try {
        const params = new URLSearchParams({
          targetType,
          targetId,
          parentId: commentId,
          limit: REPLY_PAGE_SIZE.toString(),
        })

        if (cursor) {
          params.set("cursor", cursor)
        }

        const response = (await fetchGet(
          `/api/comments?${params.toString()}`
        )) as CommentsApiResponse
        const newReplies = response.data ?? []
        const pagination = response.meta?.pagination

        setReplyCache((prev) => {
          const previous = prev[commentId]
          const base = append ? (previous?.data ?? []) : []

          return {
            ...prev,
            [commentId]: {
              data: append ? [...base, ...newReplies] : newReplies,
              loading: false,
              error: null,
              hasMore: pagination?.hasMore ?? false,
              nextCursor: pagination?.nextCursor ?? null,
            },
          }
        })
      } catch (err) {
        setReplyCache((prev) => {
          const previous = prev[commentId]
          return {
            ...prev,
            [commentId]: {
              data: previous?.data ?? [],
              loading: false,
              error: err instanceof Error ? err.message : "加载失败",
              hasMore: previous?.hasMore ?? false,
              nextCursor: previous?.nextCursor ?? null,
            },
          }
        })
      }
    },
    [targetType, targetId]
  )

  const isShowing = useCallback((commentId: string) => openReplies.has(commentId), [openReplies])

  const toggleReplies = useCallback(
    (comment: Comment) => {
      let opened = false
      setOpenReplies((prev) => {
        const next = new Set(prev)
        if (next.has(comment.id)) {
          next.delete(comment.id)
        } else {
          next.add(comment.id)
          opened = true
        }
        return next
      })

      if (opened) {
        const state = cacheRef.current[comment.id]
        const shouldFetch = !state || state.data.length === 0 || !!state.error
        if (shouldFetch) {
          void loadReplies(comment.id)
        }
      }
    },
    [loadReplies]
  )

  useEffect(() => {
    openReplies.forEach((commentId) => {
      const state = cacheRef.current[commentId]
      const shouldFetch = !state || state.data.length === 0 || !!state.error
      if (shouldFetch) {
        void loadReplies(commentId)
      }
    })
  }, [openReplies, loadReplies])

  const prependReply = useCallback((parentId: string, reply: Comment) => {
    setReplyCache((prev) => {
      const existing = prev[parentId]
      if (existing?.data?.some((item) => item.id === reply.id)) {
        return prev
      }

      const nextState: ReplyState = existing
        ? {
            ...existing,
            data: [reply, ...existing.data],
            loading: false,
            error: null,
          }
        : {
            data: [reply],
            loading: false,
            error: null,
            hasMore: false,
            nextCursor: null,
          }

      return {
        ...prev,
        [parentId]: nextState,
      }
    })
  }, [])

  const removeReply = useCallback((replyId: string) => {
    setReplyCache((prev) => {
      let changed = false
      const next: ReplyCache = {}

      Object.entries(prev).forEach(([key, state]) => {
        if (!state) {
          return
        }

        const filtered = state.data.filter((reply) => reply.id !== replyId)
        if (filtered.length !== state.data.length) {
          changed = true
          next[key] = {
            ...state,
            data: filtered,
          }
        } else {
          next[key] = state
        }
      })

      return changed ? next : prev
    })
  }, [])

  return {
    replyCache,
    loadReplies,
    toggleReplies,
    isShowing,
    resetAll,
    invalidate,
    prependReply,
    removeReply,
  }
}
