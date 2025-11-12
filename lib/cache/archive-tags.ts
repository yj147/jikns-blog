const ARCHIVE_CACHE_NAMESPACE = "archive"

export const ARCHIVE_CACHE_TAGS = {
  list: `${ARCHIVE_CACHE_NAMESPACE}:list`,
  years: `${ARCHIVE_CACHE_NAMESPACE}:years`,
  stats: `${ARCHIVE_CACHE_NAMESPACE}:stats`,
  year: (year: number) => `${ARCHIVE_CACHE_NAMESPACE}:year:${year}`,
  month: (year: number, month: number) =>
    `${ARCHIVE_CACHE_NAMESPACE}:month:${year}-${month.toString().padStart(2, "0")}`,
} as const
