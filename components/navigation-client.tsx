"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

const NAV_SELECTOR = 'nav[data-nav="main"] a[data-nav-link="true"]'

export default function NavigationClient() {
  const pathname = usePathname()

  useEffect(() => {
    if (typeof document === "undefined") return

    const navLinks = document.querySelectorAll<HTMLAnchorElement>(NAV_SELECTOR)

    navLinks.forEach((link) => {
      const href = link.getAttribute("href") || "/"
      const isRoot = href === "/"
      const isActive = isRoot ? pathname === "/" : pathname.startsWith(href)

      if (isActive) {
        link.classList.add("text-foreground")
        link.classList.remove("text-muted-foreground")
        link.setAttribute("aria-current", "page")
      } else {
        link.classList.add("text-muted-foreground")
        link.classList.remove("text-foreground")
        link.removeAttribute("aria-current")
      }
    })
  }, [pathname])

  return null
}
