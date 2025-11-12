import { NextRequest, NextResponse } from "next/server"
import { searchArchivePosts } from "@/lib/actions/archive"
import { apiLogger } from "@/lib/utils/logger"
import {
  ARCHIVE_SEARCH_MAX_QUERY_LENGTH,
  ARCHIVE_SEARCH_MIN_QUERY_LENGTH,
} from "@/lib/constants/archive-search"

export const revalidate = 0

const MIN_QUERY_LENGTH = ARCHIVE_SEARCH_MIN_QUERY_LENGTH

export async function GET(request: NextRequest) {
  const startTime = performance.now()
  const url = new URL(request.url)
  const query = url.searchParams.get("q")?.trim() ?? ""
  const yearParam = url.searchParams.get("year")

  let year: number | undefined
  if (yearParam) {
    const parsed = Number(yearParam)
    if (!Number.isNaN(parsed)) {
      year = parsed
    } else {
      return NextResponse.json({ results: [], message: "INVALID_YEAR" }, { status: 400 })
    }
  }

  if (query.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ results: [], message: "QUERY_TOO_SHORT" }, { status: 200 })
  }

  if (query.length > ARCHIVE_SEARCH_MAX_QUERY_LENGTH) {
    apiLogger.warn("archive_search_query_too_long", {
      queryLength: query.length,
      year,
    })
    return NextResponse.json({ results: [], message: "QUERY_TOO_LONG" }, { status: 400 })
  }

  try {
    const results = await searchArchivePosts(query, year)
    const duration = performance.now() - startTime
    apiLogger.info("archive_search_success", {
      queryLength: query.length,
      year,
      resultCount: results.length,
      durationMs: Number(duration.toFixed(2)),
    })
    return NextResponse.json({ results })
  } catch (error) {
    const duration = performance.now() - startTime
    apiLogger.error(
      "Archive search failed",
      { queryLength: query.length, year, durationMs: Number(duration.toFixed(2)) },
      error
    )
    return NextResponse.json({ results: [], message: "SEARCH_FAILED" }, { status: 500 })
  }
}
