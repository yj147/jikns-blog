import { beforeEach, describe, expect, it, vi } from "vitest"

import { revalidateArchiveCache } from "@/lib/actions/archive-cache"
import { ARCHIVE_CACHE_TAGS } from "@/lib/cache/archive-tags"

const cacheMocks = vi.hoisted(() => ({
  revalidateTag: vi.fn(),
}))

vi.mock("next/cache", () => cacheMocks)

describe("revalidateArchiveCache", () => {
  beforeEach(() => {
    cacheMocks.revalidateTag.mockReset()
  })

  it("会根据前后状态推导年份与月份标签", async () => {
    await revalidateArchiveCache({
      previousPublished: true,
      previousPublishedAt: "2023-12-15T00:00:00Z",
      nextPublished: true,
      nextPublishedAt: "2024-01-10T00:00:00Z",
    })

    expect(cacheMocks.revalidateTag).toHaveBeenCalledWith(ARCHIVE_CACHE_TAGS.list)
    expect(cacheMocks.revalidateTag).toHaveBeenCalledWith(ARCHIVE_CACHE_TAGS.years)
    expect(cacheMocks.revalidateTag).toHaveBeenCalledWith(ARCHIVE_CACHE_TAGS.stats)
    expect(cacheMocks.revalidateTag).toHaveBeenCalledWith(ARCHIVE_CACHE_TAGS.year(2023))
    expect(cacheMocks.revalidateTag).toHaveBeenCalledWith(ARCHIVE_CACHE_TAGS.month(2023, 12))
    expect(cacheMocks.revalidateTag).toHaveBeenCalledWith(ARCHIVE_CACHE_TAGS.year(2024))
    expect(cacheMocks.revalidateTag).toHaveBeenCalledWith(ARCHIVE_CACHE_TAGS.month(2024, 1))
  })

  it("当不存在任何发布状态时不会触发 revalidate", async () => {
    await revalidateArchiveCache({ previousPublished: false, nextPublished: false })
    expect(cacheMocks.revalidateTag).not.toHaveBeenCalled()
  })
})
