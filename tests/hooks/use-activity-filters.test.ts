import { act, renderHook } from "@testing-library/react"

import { useActivityFilters, MIN_SEARCH_LENGTH } from "@/hooks/use-activity-filters"
import { ActivityOrderBy } from "@/types/activity"

describe("useActivityFilters", () => {
  it("returns failure when search keyword is shorter than minimum length", () => {
    const { result } = renderHook(() => useActivityFilters({ orderBy: ActivityOrderBy.LATEST }))

    act(() => {
      result.current.setSearchDraft("a")
    })

    let outcome
    act(() => {
      outcome = result.current.applySearch()
    })

    expect(outcome).toEqual({ success: false, reason: "too-short" })
    expect(result.current.filters.searchTerm).toBeUndefined()
  })

  it("trims and applies valid search keyword", () => {
    const { result } = renderHook(() => useActivityFilters({ orderBy: ActivityOrderBy.TRENDING }))

    act(() => {
      result.current.setSearchDraft("  design  ")
    })

    let outcome
    act(() => {
      outcome = result.current.applySearch()
    })

    expect(outcome).toEqual({ success: true })
    expect(result.current.filters.searchTerm).toBe("design")

    act(() => {
      result.current.clearSearch()
    })

    expect(result.current.searchDraft).toBe("")
    expect(result.current.filters.searchTerm).toBeUndefined()
  })

  it("updates and clears tag/date filters correctly", () => {
    const { result } = renderHook(() =>
      useActivityFilters({ orderBy: ActivityOrderBy.LATEST, userId: "user-1" })
    )

    act(() => {
      result.current.setTagDraft("design, marketing")
    })

    act(() => {
      result.current.applyTags()
    })

    act(() => {
      result.current.handleDateChange("start", "2024-01-01")
      result.current.handleDateChange("end", "2024-01-31")
    })

    expect(result.current.filters.tags).toEqual(["design", "marketing"])
    expect(result.current.filters.dateRange?.start).toBeInstanceOf(Date)
    expect(result.current.filters.dateRange?.end).toBeInstanceOf(Date)
    expect(result.current.hasActiveFilters).toBe(true)

    act(() => {
      result.current.clearTagsAndDates()
    })

    expect(result.current.filters.tags).toBeUndefined()
    expect(result.current.filters.dateRange).toBeUndefined()
    expect(result.current.hasActiveFilters).toBe(false)
  })

  it("resets to default state when clearAllFilters is invoked", () => {
    const { result } = renderHook(() =>
      useActivityFilters({ orderBy: ActivityOrderBy.FOLLOWING, userId: "user-2" })
    )

    act(() => {
      result.current.setSearchDraft("community")
    })

    act(() => {
      result.current.applySearch()
    })

    act(() => {
      result.current.mergeFilters({ hasImages: true, isPinned: false })
    })

    expect(result.current.filters.hasImages).toBe(true)
    expect(result.current.filters.searchTerm).toBe("community")

    act(() => {
      result.current.clearAllFilters()
    })

    expect(result.current.searchDraft).toBe("")
    expect(result.current.filters).toMatchObject({
      orderBy: ActivityOrderBy.FOLLOWING,
      authorId: "user-2",
      hasImages: undefined,
      isPinned: undefined,
      searchTerm: undefined,
    })
  })

  it("exposes minimum search length constant", () => {
    expect(MIN_SEARCH_LENGTH).toBeGreaterThan(1)
  })
})
