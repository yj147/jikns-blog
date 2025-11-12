export interface HighlightSegment {
  text: string
  match: boolean
}

const REGEX_SPECIAL_CHARS = /[.*+?^${}()|[\]\\]/g

export function escapeSearchQuery(query: string): string {
  return query.replace(REGEX_SPECIAL_CHARS, "\\$&")
}

export function buildHighlightSegments(text: string, query: string): HighlightSegment[] {
  const source = text ?? ""
  const normalizedQuery = query.trim()

  if (!normalizedQuery) {
    return source ? [{ text: source, match: false }] : []
  }

  const escaped = escapeSearchQuery(normalizedQuery)
  const pattern = new RegExp(escaped, "gi")
  const segments: HighlightSegment[] = []

  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(source)) !== null) {
    const matchStart = match.index
    const matchEnd = pattern.lastIndex

    if (matchStart > lastIndex) {
      segments.push({
        text: source.slice(lastIndex, matchStart),
        match: false,
      })
    }

    segments.push({
      text: source.slice(matchStart, matchEnd),
      match: true,
    })

    lastIndex = matchEnd
  }

  if (lastIndex < source.length) {
    segments.push({
      text: source.slice(lastIndex),
      match: false,
    })
  }

  return segments
}

export function buildSearchPreview(
  text: string | null | undefined,
  query: string,
  windowSize = 80
): string {
  if (!text) {
    return ""
  }

  const normalizedQuery = query.trim()
  if (!normalizedQuery) {
    return text.slice(0, windowSize)
  }

  const lowerText = text.toLowerCase()
  const lowerQuery = normalizedQuery.toLowerCase()
  const index = lowerText.indexOf(lowerQuery)

  if (index === -1) {
    return text.slice(0, windowSize)
  }

  const halfWindow = Math.max(0, Math.floor((windowSize - normalizedQuery.length) / 2))
  let start = Math.max(0, index - halfWindow)
  let end = start + windowSize
  if (end > text.length) {
    end = text.length
    start = Math.max(0, end - windowSize)
  }
  const prefix = start > 0 ? "…" : ""
  const suffix = end < text.length ? "…" : ""

  return `${prefix}${text.slice(start, end)}${suffix}`
}
