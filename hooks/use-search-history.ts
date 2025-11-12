"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

type Options = {
  storageKey?: string
  limit?: number
}

const isBrowser = () => typeof window !== "undefined"

function readHistory(key: string): string[] {
  if (!isBrowser()) {
    return []
  }

  const raw = window.localStorage.getItem(key)
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string")
    }
  } catch {
    // ignore corrupted history
  }

  return []
}

function persistHistory(key: string, next: string[]) {
  if (!isBrowser()) {
    return
  }
  window.localStorage.setItem(key, JSON.stringify(next))
}

export function useSearchHistory(options: Options = {}) {
  const { storageKey = "search_history", limit = 5 } = options
  const [history, setHistory] = useState<string[]>(() => readHistory(storageKey))

  useEffect(() => {
    setHistory(readHistory(storageKey))
  }, [storageKey])

  const addEntry = useCallback(
    (value: string) => {
      const normalized = value.trim()
      if (!normalized) {
        return
      }

      setHistory((prev) => {
        const unique = prev.filter((item) => item !== normalized)
        const next = [normalized, ...unique].slice(0, limit)
        persistHistory(storageKey, next)
        return next
      })
    },
    [limit, storageKey]
  )

  const removeEntry = useCallback(
    (value: string) => {
      setHistory((prev) => {
        const next = prev.filter((item) => item !== value)
        persistHistory(storageKey, next)
        return next
      })
    },
    [storageKey]
  )

  const clearHistory = useCallback(() => {
    persistHistory(storageKey, [])
    setHistory([])
  }, [storageKey])

  const actions = useMemo(
    () => ({
      addEntry,
      removeEntry,
      clearHistory,
    }),
    [addEntry, removeEntry, clearHistory]
  )

  return {
    history,
    ...actions,
  }
}
