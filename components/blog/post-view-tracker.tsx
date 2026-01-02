"use client"

import { useEffect } from "react"

export interface PostViewTrackerProps {
  postId: string
}

export function PostViewTracker({ postId }: PostViewTrackerProps) {
  useEffect(() => {
    if (!postId) return

    const storageKey = `post:viewed:${postId}`
    try {
      if (sessionStorage.getItem(storageKey)) {
        return
      }
      sessionStorage.setItem(storageKey, "1")
    } catch {
      // ignore storage errors
    }

    const url = `/api/posts/${postId}/view`

    if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
      try {
        navigator.sendBeacon(url)
        return
      } catch {
        // fall back to fetch
      }
    }

    void fetch(url, {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
      },
    }).catch(() => null)
  }, [postId])

  return null
}
