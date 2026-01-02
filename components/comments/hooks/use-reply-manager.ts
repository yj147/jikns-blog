"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import type { CommentsApiResponse } from "@/components/comments/hooks/use-comments-data"
import { fetchGet } from "@/lib/api/fetch-json"
import type { Comment, CommentTargetType } from "@/types/comments"

const REPLY_PAGE_SIZE = 20

function compareReplies(a: Comment, b: Comment) {
  const aCreatedAt = a.createdAt as unknown
  const bCreatedAt = b.createdAt as unknown

  if (typeof aCreatedAt === "string" && typeof bCreatedAt === "string") {
    if (aCreatedAt < bCreatedAt) return -1
    if (aCreatedAt > bCreatedAt) return 1
  } else {
    const aTime = new Date(aCreatedAt as any).getTime()
    const bTime = new Date(bCreatedAt as any).getTime()
    if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) {
      return aTime - bTime
    }
  }

  return a.id.localeCompare(b.id)
}

function mergeReplies(existing: Comment[] | undefined, incoming: Comment[]) {
  const byId = new Map<string, Comment>()
  for (const reply of existing ?? []) {
    byId.set(reply.id, reply)
  }
  for (const reply of incoming) {
    byId.set(reply.id, reply)
  }
  return Array.from(byId.values()).sort(compareReplies)
}

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
          const nextData = append ? mergeReplies(previous?.data, newReplies) : newReplies

          return {
            ...prev,
            [commentId]: {
              data: nextData,
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

  const toggleReplies = useCallback((comment: Comment) => {
    setOpenReplies((prev) => {
      const next = new Set(prev)
      if (next.has(comment.id)) {
        next.delete(comment.id)
      } else {
        next.add(comment.id)
      }
      return next
    })
  }, [])

  useEffect(() => {
    openReplies.forEach((commentId) => {
      const state = cacheRef.current[commentId]
      const shouldFetch = !state || state.data.length === 0 || !!state.error
      if (shouldFetch) {
        void loadReplies(commentId)
      }
    })
  }, [openReplies, loadReplies])

  const addReply = useCallback((parentId: string, reply: Comment) => {
    setReplyCache((prev) => {
      const existing = prev[parentId]
      const nextData = mergeReplies(existing?.data, [reply])

      const nextState: ReplyState = existing
        ? {
            ...existing,
            data: nextData,
            loading: false,
            error: null,
          }
        : {
            data: nextData,
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
    addReply,
    removeReply,
  }
}
