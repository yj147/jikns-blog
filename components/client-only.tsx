"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"

type ClientOnlyProps = {
  children: ReactNode
  fallback?: ReactNode
}

export function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return fallback
  return children
}
