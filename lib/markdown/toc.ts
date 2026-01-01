import "server-only"

export type TocItem = {
  id: string
  text: string
  level: number
}

// Keep this intentionally simple: stable ids, low risk.
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function createHeadingIdFactory() {
  const seenIds = new Map<string, number>()

  return (text: string): string => {
    let id = slugifyHeading(text)

    if (!id) {
      id = "heading"
    }

    if (seenIds.has(id)) {
      const count = seenIds.get(id) ?? 0
      seenIds.set(id, count + 1)
      return `${id}-${count}`
    }

    seenIds.set(id, 1)
    return id
  }
}

export function extractTocItems(content: string): TocItem[] {
  const toc: TocItem[] = []
  const makeId = createHeadingIdFactory()

  // We need the same heading stream as ReactMarkdown/remark.
  // Regex-only extraction breaks on fenced code blocks ("```") that contain "# ...".
  // Keep this small: track code fences and parse line-by-line.
  let fence: { char: "`" | "~"; length: number } | null = null

  for (const line of content.split(/\r?\n/)) {
    const fenceMatch = line.match(/^\s{0,3}(```+|~~~+)/)
    if (fenceMatch) {
      const token = fenceMatch[1]
      const char = token[0] as "`" | "~"
      const length = token.length

      if (!fence) {
        fence = { char, length }
      } else if (char === fence.char && length >= fence.length) {
        fence = null
      }
      continue
    }

    if (fence) continue

    const headingMatch = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*$/)
    if (!headingMatch) continue

    const level = headingMatch[1].length
    const text = headingMatch[2].trim()
    const id = makeId(text)

    // Consume *all* headings to keep id suffixes consistent, but only expose H2/H3 in TOC.
    if (level === 2 || level === 3) {
      toc.push({ id, text, level })
    }
  }

  return toc
}
