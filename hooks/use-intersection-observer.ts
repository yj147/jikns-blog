"use client"

import { useEffect, useRef, useState, type RefObject } from "react"

interface UseIntersectionObserverOptions extends IntersectionObserverInit {
  once?: boolean
}

export function useIntersectionObserver<T extends HTMLElement>(
  options: UseIntersectionObserverOptions = {}
): [RefObject<T | null>, boolean] {
  const { once = false, root = null, rootMargin, threshold } = options
  const targetRef = useRef<T | null>(null)
  const [isIntersecting, setIsIntersecting] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") {
      setIsIntersecting(true)
      return
    }

    const element = targetRef.current
    if (!element) {
      return
    }

    if (!("IntersectionObserver" in window)) {
      setIsIntersecting(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsIntersecting(true)
            if (once) {
              observer.disconnect()
            }
          } else if (!once) {
            setIsIntersecting(false)
          }
        })
      },
      { root, rootMargin, threshold }
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [once, root, rootMargin, threshold])

  return [targetRef, isIntersecting]
}
