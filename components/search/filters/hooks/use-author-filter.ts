"use client"

import { useState, useEffect } from "react"
import { searchAuthorCandidates } from "@/lib/actions/search"
import { useDebounce } from "@/hooks/use-debounce"

export type AuthorSuggestionStatus = "idle" | "loading" | "empty" | "error"

export interface AuthorOption {
  id: string
  name: string | null
  avatarUrl: string | null
  bio: string | null
  role: string
}

interface UseAuthorFilterOptions {
  initialAuthorId: string | null
  minQueryLength: number
}

interface UseAuthorFilterResult {
  authorQuery: string
  setAuthorQuery: (value: string) => void
  selectedAuthor: AuthorOption | null
  authorSuggestions: AuthorOption[]
  authorStatus: AuthorSuggestionStatus
  isLoadingInitialAuthor: boolean
  hasSufficientQuery: boolean
  selectAuthor: (author: AuthorOption) => void
  clearAuthor: () => void
}

export function useAuthorFilter(options: UseAuthorFilterOptions): UseAuthorFilterResult {
  const { initialAuthorId, minQueryLength } = options
  const [selectedAuthor, setSelectedAuthor] = useState<AuthorOption | null>(null)
  const [authorQuery, setAuthorQuery] = useState("")
  const [authorSuggestions, setAuthorSuggestions] = useState<AuthorOption[]>([])
  const [authorStatus, setAuthorStatus] = useState<AuthorSuggestionStatus>("idle")
  const [isLoadingInitialAuthor, setIsLoadingInitialAuthor] = useState(false)

  const debouncedAuthorQuery = useDebounce(authorQuery, 400)
  const hasSufficientQuery = debouncedAuthorQuery.trim().length >= minQueryLength

  useEffect(() => {
    let cancelled = false
    if (!initialAuthorId) {
      setSelectedAuthor(null)
      setAuthorQuery("")
      return
    }

    const loadAuthor = async () => {
      setIsLoadingInitialAuthor(true)
      try {
        const response = await fetch(`/api/users/${initialAuthorId}/public`)
        if (!response.ok) {
          if (!cancelled) {
            setSelectedAuthor(null)
          }
          return
        }
        const payload = await response.json()
        const data = payload?.data
        if (!cancelled && data) {
          setSelectedAuthor({
            id: data.id,
            name: data.name,
            avatarUrl: data.avatarUrl,
            bio: data.bio,
            role: data.status,
          })
          setAuthorQuery(data.name ?? "")
        }
      } catch {
        if (!cancelled) {
          setSelectedAuthor(null)
        }
      } finally {
        if (!cancelled) {
          setIsLoadingInitialAuthor(false)
        }
      }
    }

    void loadAuthor()

    return () => {
      cancelled = true
    }
  }, [initialAuthorId])

  useEffect(() => {
    if (!hasSufficientQuery) {
      setAuthorStatus("idle")
      setAuthorSuggestions([])
      return
    }

    let cancelled = false
    setAuthorStatus("loading")

    const fetchAuthors = async () => {
      try {
        const result = await searchAuthorCandidates({ query: debouncedAuthorQuery, limit: 6 })
        if (cancelled) return
        if (result.success && result.data?.authors) {
          const filtered = result.data.authors.filter((author) => author.id !== selectedAuthor?.id)
          setAuthorSuggestions(filtered)
          setAuthorStatus(filtered.length > 0 ? "idle" : "empty")
        } else {
          setAuthorSuggestions([])
          setAuthorStatus("error")
        }
      } catch {
        if (!cancelled) {
          setAuthorSuggestions([])
          setAuthorStatus("error")
        }
      }
    }

    void fetchAuthors()

    return () => {
      cancelled = true
    }
  }, [debouncedAuthorQuery, hasSufficientQuery, selectedAuthor])

  const selectAuthor = (author: AuthorOption) => {
    setSelectedAuthor(author)
    setAuthorQuery(author.name ?? "")
    setAuthorSuggestions([])
    setAuthorStatus("idle")
  }

  const clearAuthor = () => {
    setSelectedAuthor(null)
    setAuthorQuery("")
    setAuthorSuggestions([])
    setAuthorStatus("idle")
  }

  return {
    authorQuery,
    setAuthorQuery,
    selectedAuthor,
    authorSuggestions,
    authorStatus,
    isLoadingInitialAuthor,
    hasSufficientQuery,
    selectAuthor,
    clearAuthor,
  }
}
