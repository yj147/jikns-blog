import { describe, expect, it } from "vitest"

import { resolveAdjacentMonths } from "@/lib/utils/archive"

describe("resolveAdjacentMonths", () => {
  it("返回同一年内的前后月份", () => {
    const years = [2024, 2025]
    const monthsByYear = new Map<number, number[]>([
      [2024, [12]],
      [2025, [2, 4, 5]],
    ])

    const result = resolveAdjacentMonths(2025, 4, years, monthsByYear)

    expect(result.prev).toEqual({ year: 2025, month: 2 })
    expect(result.next).toEqual({ year: 2025, month: 5 })
  })

  it("跨年份查找前一个和后一个可用月份", () => {
    const years = [2024, 2025, 2026]
    const monthsByYear = new Map<number, number[]>([
      [2024, [11]],
      [2025, [12]],
      [2026, [1]],
    ])

    const result = resolveAdjacentMonths(2025, 12, years, monthsByYear)

    expect(result.prev).toEqual({ year: 2024, month: 11 })
    expect(result.next).toEqual({ year: 2026, month: 1 })
  })

  it("当前年份不存在时返回空", () => {
    const years = [2024, 2025]
    const monthsByYear = new Map<number, number[]>([
      [2024, [6]],
      [2025, [1]],
    ])

    const result = resolveAdjacentMonths(2023, 5, years, monthsByYear)

    expect(result.prev).toBeNull()
    expect(result.next).toBeNull()
  })
})
