"use client"

import { useState, useEffect, useMemo } from "react"
import { searchTags, getTag } from "@/lib/actions/tags"
import { useDebounce } from "@/hooks/use-debounce"

export type TagSuggestionStatus = "idle" | "loading" | "empty" | "error"

export interface TagOption {
  id: string
  name: string
  slug: string
  color?: string | null
}

interface UseTagFilterOptions {
  initialTagIds: string[]
  maxTags: number
  minQueryLength: number
}

interface UseTagFilterResult {
  tagQuery: string
  setTagQuery: (value: string) => void
  selectedTags: TagOption[]
  tagSuggestions: TagOption[]
  tagStatus: TagSuggestionStatus
  isLoadingSelectedTags: boolean
  remainingTagSlots: number
  hasSufficientQuery: boolean
  addTag: (tag: TagOption) => void
  removeTag: (tagId: string) => void
  resetTags: () => void
}

export function useTagFilter(options: UseTagFilterOptions): UseTagFilterResult {
  const { initialTagIds, maxTags, minQueryLength } = options
  const [selectedTags, setSelectedTags] = useState<TagOption[]>([])
  const [tagQuery, setTagQuery] = useState("")
  const [tagSuggestions, setTagSuggestions] = useState<TagOption[]>([])
  const [tagStatus, setTagStatus] = useState<TagSuggestionStatus>("idle")
  const [isLoadingSelectedTags, setIsLoadingSelectedTags] = useState(false)

  const debouncedTagQuery = useDebounce(tagQuery, 400)
  const hasSufficientQuery = debouncedTagQuery.trim().length >= minQueryLength

  const tagIdKey = useMemo(() => initialTagIds.join(","), [initialTagIds])

  useEffect(() => {
    if (!initialTagIds.length) {
      setSelectedTags([])
      return
    }

    let cancelled = false
    setIsLoadingSelectedTags(true)

    const loadTags = async () => {
      try {
        const resolved = await Promise.all(
          initialTagIds.map(async (id) => {
            const result = await getTag(id)
            if (result.success && result.data?.tag) {
              const tag = result.data.tag
              return {
                id: tag.id,
                name: tag.name,
                slug: tag.slug,
                color: tag.color,
              } satisfies TagOption
            }
            return null
          })
        )

        if (!cancelled) {
          setSelectedTags(resolved.filter(Boolean) as TagOption[])
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSelectedTags(false)
        }
      }
    }

    void loadTags()

    return () => {
      cancelled = true
    }
  }, [initialTagIds, tagIdKey])

  useEffect(() => {
    const term = debouncedTagQuery.trim()
    if (!hasSufficientQuery) {
      setTagStatus("idle")
      setTagSuggestions([])
      return
    }

    let cancelled = false
    setTagStatus("loading")

    const fetchSuggestions = async () => {
      try {
        const result = await searchTags(term, 8)
        if (cancelled) return
        if (result.success && result.data?.tags) {
          const normalized = result.data.tags
            .map<TagOption>((tag) => ({
              id: tag.id,
              name: tag.name,
              slug: tag.slug,
              color: tag.color,
            }))
            .filter((tag) => !selectedTags.some((selected) => selected.id === tag.id))

          setTagSuggestions(normalized)
          setTagStatus(normalized.length > 0 ? "idle" : "empty")
        } else {
          setTagSuggestions([])
          setTagStatus("error")
        }
      } catch {
        if (!cancelled) {
          setTagSuggestions([])
          setTagStatus("error")
        }
      }
    }

    void fetchSuggestions()

    return () => {
      cancelled = true
    }
  }, [debouncedTagQuery, hasSufficientQuery, selectedTags])

  const remainingTagSlots = Math.max(0, maxTags - selectedTags.length)

  const addTag = (tag: TagOption) => {
    if (selectedTags.some((item) => item.id === tag.id)) {
      return
    }
    if (selectedTags.length >= maxTags) {
      return
    }
    setSelectedTags((prev) => [...prev, tag])
    setTagQuery("")
    setTagSuggestions([])
    setTagStatus("idle")
  }

  const removeTag = (tagId: string) => {
    setSelectedTags((prev) => prev.filter((tag) => tag.id !== tagId))
  }

  const resetTags = () => {
    setSelectedTags([])
    setTagQuery("")
    setTagSuggestions([])
    setTagStatus("idle")
  }

  return {
    tagQuery,
    setTagQuery,
    selectedTags,
    tagSuggestions,
    tagStatus,
    isLoadingSelectedTags,
    remainingTagSlots,
    hasSufficientQuery,
    addTag,
    removeTag,
    resetTags,
  }
}
