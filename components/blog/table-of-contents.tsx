"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"

export interface TocItem {
  id: string
  text: string
  level: number
}

interface TableOfContentsProps {
  items: TocItem[]
}

export function TableOfContents({ items }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>("")
  const containerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Record<string, HTMLLIElement | null>>({})
  const [indicator, setIndicator] = useState({ top: 0, height: 0, visible: false })

  const updateIndicator = (id: string) => {
    const container = containerRef.current
    const target = itemRefs.current[id]

    if (!container || !target) {
      setIndicator((prev) => ({ ...prev, visible: false }))
      return
    }

    const containerRect = container.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()

    setIndicator({
      top: targetRect.top - containerRect.top,
      height: targetRect.height,
      visible: true,
    })
  }

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)

        if (visible[0]) {
          setActiveId(visible[0].target.id)
        }
      },
      { rootMargin: "0% 0% -80% 0%" }
    )

    items.forEach((item) => {
      const element = document.getElementById(item.id)
      if (element) observer.observe(element)
    })

    return () => observer.disconnect()
  }, [items])

  useEffect(() => {
    if (!activeId) return
    updateIndicator(activeId)
  }, [activeId, items.length])

  useEffect(() => {
    const handleResize = () => {
      if (activeId) updateIndicator(activeId)
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [activeId])

  if (items.length === 0) return null

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground">目录</h3>
      <div ref={containerRef} className="relative border-l border-border pl-4">
        <div className="absolute left-0 top-0 h-full w-[1px] bg-border" />
        <motion.div
          aria-hidden
          className="absolute left-[-1px] w-[2px] rounded-full bg-primary"
          animate={
            indicator.visible
              ? { opacity: 1, y: indicator.top, height: indicator.height }
              : { opacity: 0, y: 0, height: 0 }
          }
          transition={{ duration: 0.2, ease: "easeInOut" }}
          initial={false}
        />
        <ul className="space-y-2.5">
          {items.map((item) => (
            <li
              key={item.id}
              ref={(el) => {
                itemRefs.current[item.id] = el
              }}
              style={{ paddingLeft: Math.max(0, item.level - 2) * 12 }}
            >
              <a
                href={`#${item.id}`}
                onClick={(e) => {
                  e.preventDefault()
                  document.getElementById(item.id)?.scrollIntoView({
                    behavior: "smooth",
                  })
                  setActiveId(item.id)
                }}
                className={cn(
                  "block text-sm transition-colors duration-200 hover:text-primary line-clamp-1",
                  activeId === item.id
                    ? "font-medium text-primary"
                    : "text-muted-foreground"
                )}
              >
                {item.text}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
