import type { ArchiveMonth, ArchivePost, ArchiveYear } from "@/lib/actions/archive"

export const archiveMonthNames = [
  "一月",
  "二月",
  "三月",
  "四月",
  "五月",
  "六月",
  "七月",
  "八月",
  "九月",
  "十月",
  "十一月",
  "十二月",
] as const

export interface ArchiveAggregateRow {
  year: number
  month: number
  count: number
}

export function buildArchiveTimeline(
  aggregates: ArchiveAggregateRow[],
  posts: ArchivePost[],
  monthNames: readonly string[]
): ArchiveYear[] {
  if (aggregates.length === 0) {
    return []
  }

  const postsByMonth = new Map<string, ArchivePost[]>()

  posts.forEach((post) => {
    const date = new Date(post.publishedAt)
    if (Number.isNaN(date.getTime())) {
      return
    }

    const key = buildMonthKey(date.getFullYear(), date.getMonth() + 1)
    const existing = postsByMonth.get(key)
    if (existing) {
      existing.push(post)
    } else {
      postsByMonth.set(key, [post])
    }
  })

  const yearsMap = new Map<number, ArchiveYear>()

  aggregates.forEach((aggregate) => {
    const key = buildMonthKey(aggregate.year, aggregate.month)
    const monthPosts = postsByMonth.get(key) ?? []

    const monthEntry: ArchiveMonth = {
      month: aggregate.month,
      monthName: monthNames[aggregate.month - 1] ?? `${aggregate.month}月`,
      count: aggregate.count,
      posts: monthPosts,
    }

    const existingYear = yearsMap.get(aggregate.year)
    if (existingYear) {
      existingYear.months.push(monthEntry)
      existingYear.totalCount += monthEntry.count
    } else {
      yearsMap.set(aggregate.year, {
        year: aggregate.year,
        months: [monthEntry],
        totalCount: monthEntry.count,
      })
    }
  })

  return Array.from(yearsMap.values())
    .map((yearEntry) => ({
      ...yearEntry,
      months: [...yearEntry.months].sort((a, b) => b.month - a.month),
    }))
    .sort((a, b) => b.year - a.year)
}

export function summarizeArchivePosts(posts: ArchivePost[]): ArchiveAggregateRow[] {
  const map = new Map<number, Map<number, number>>()

  posts.forEach((post) => {
    const date = new Date(post.publishedAt)
    if (Number.isNaN(date.getTime())) {
      return
    }

    const year = date.getFullYear()
    const month = date.getMonth() + 1

    if (!map.has(year)) {
      map.set(year, new Map())
    }

    const months = map.get(year)!
    months.set(month, (months.get(month) || 0) + 1)
  })

  const rows: ArchiveAggregateRow[] = []
  map.forEach((months, year) => {
    months.forEach((count, month) => {
      rows.push({ year, month, count })
    })
  })

  return rows.sort((a, b) => (a.year === b.year ? b.month - a.month : b.year - a.year))
}

function buildMonthKey(year: number, month: number) {
  return `${year}-${month}`
}

export function resolveAdjacentMonths(
  year: number,
  month: number,
  sortedYears: number[],
  monthsByYear: Map<number, number[]>
) {
  const yearIndex = sortedYears.indexOf(year)
  if (yearIndex === -1) {
    return { prev: null, next: null }
  }

  const findPrev = () => {
    for (let idx = yearIndex; idx >= 0; idx--) {
      const currentYear = sortedYears[idx]
      const months = monthsByYear.get(currentYear) ?? []
      const candidates = months.filter((value) => {
        if (currentYear === year) {
          return value < month
        }
        return true
      })

      if (candidates.length > 0) {
        return {
          year: currentYear,
          month: Math.max(...candidates),
        }
      }
    }

    return null
  }

  const findNext = () => {
    for (let idx = yearIndex; idx < sortedYears.length; idx++) {
      const currentYear = sortedYears[idx]
      const months = monthsByYear.get(currentYear) ?? []
      const candidates = months.filter((value) => {
        if (currentYear === year) {
          return value > month
        }
        return true
      })

      if (candidates.length > 0) {
        return {
          year: currentYear,
          month: Math.min(...candidates),
        }
      }
    }

    return null
  }

  return {
    prev: findPrev(),
    next: findNext(),
  }
}
