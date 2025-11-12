import { NextRequest, NextResponse } from "next/server"
import { getArchiveData, getArchiveYears } from "@/lib/actions/archive"
import { apiLogger } from "@/lib/utils/logger"

const DEFAULT_LIMIT = 3
const MAX_LIMIT = 12

export const revalidate = 0

export async function GET(request: NextRequest) {
  const startTime = performance.now()
  const url = new URL(request.url)
  const offsetParam = url.searchParams.get("offset")
  const limitParam = url.searchParams.get("limit")

  const offset = offsetParam ? Number(offsetParam) : 0
  const limit = limitParam ? Number(limitParam) : DEFAULT_LIMIT

  if (Number.isNaN(offset) || offset < 0) {
    return NextResponse.json({ message: "INVALID_OFFSET" }, { status: 400 })
  }

  if (Number.isNaN(limit) || limit <= 0) {
    return NextResponse.json({ message: "INVALID_LIMIT" }, { status: 400 })
  }

  const safeLimit = Math.min(Math.floor(limit), MAX_LIMIT)

  try {
    const [years, data] = await Promise.all([
      getArchiveYears(),
      getArchiveData({ limitYears: safeLimit, offsetYears: offset }),
    ])

    const totalYears = years.length
    const nextOffset = Math.min(offset + safeLimit, totalYears)
    const hasMore = nextOffset < totalYears

    const duration = performance.now() - startTime

    apiLogger.info("archive_chunk_success", {
      offset,
      limit: safeLimit,
      durationMs: Number(duration.toFixed(2)),
      returnedYears: data.length,
      totalYears,
    })

    return NextResponse.json({
      years: data,
      hasMore,
      nextOffset,
      totalYears,
    })
  } catch (error) {
    const duration = performance.now() - startTime
    apiLogger.error(
      "Failed to load archive chunk",
      { offset, limit: safeLimit, durationMs: Number(duration.toFixed(2)) },
      error
    )
    return NextResponse.json({ message: "ARCHIVE_CHUNK_FAILED" }, { status: 500 })
  }
}
