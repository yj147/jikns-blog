import { Prisma, MetricType } from "@/lib/generated/prisma"
import { prisma } from "@/lib/prisma"
import {
  MetricsBucket,
  MetricsCompareWindow,
  MetricsQueryParams,
  MetricsQueryResultDTO,
  MetricsStatsDTO,
  MetricsTimeseriesDTO,
} from "@/lib/dto/metrics.dto"

const DEFAULT_BUCKET: MetricsBucket = "5m"
const DEFAULT_WINDOW_MS = 60 * 60 * 1000

const BUCKET_SECONDS: Record<MetricsBucket, number> = {
  "60s": 60,
  "5m": 5 * 60,
  "1h": 60 * 60,
}

const COMPARE_WINDOW_MS: Record<MetricsCompareWindow, number> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
}

const EMPTY_STATS: MetricsStatsDTO = {
  total: 0,
  min: 0,
  max: 0,
  avg: 0,
  p50: 0,
  p95: 0,
}

type TimeseriesRow = {
  bucket_start: Date
  avg: number | null
  p50: number | null
  p95: number | null
  count: bigint | number
}

type StatsRow = {
  total: bigint | number | null
  min: number | null
  max: number | null
  avg: number | null
  p50: number | null
  p95: number | null
}

function resolveBucket(bucket?: MetricsBucket): MetricsBucket {
  if (bucket && BUCKET_SECONDS[bucket]) {
    return bucket
  }
  return DEFAULT_BUCKET
}

function resolveRange(params: MetricsQueryParams): { startTime: Date; endTime: Date } {
  const endTime = params.endTime ?? new Date()
  const startTime = params.startTime ?? new Date(endTime.getTime() - DEFAULT_WINDOW_MS)

  if (startTime >= endTime) {
    throw new Error("startTime must be earlier than endTime")
  }

  return { startTime, endTime }
}

function buildWhereClause(type: MetricType | undefined, startTime: Date, endTime: Date) {
  const clauses: Prisma.Sql[] = [
    Prisma.sql`"timestamp" >= ${startTime}`,
    Prisma.sql`"timestamp" <= ${endTime}`,
  ]

  if (type) {
    clauses.push(Prisma.sql`"type"::text = ${type}`)
  }

  return Prisma.join(clauses, " AND ")
}

function normalizeTimeseries(rows: TimeseriesRow[]): MetricsTimeseriesDTO[] {
  return rows.map((row) => ({
    timestamp: row.bucket_start.toISOString(),
    avg: Number(row.avg ?? 0),
    p50: Number(row.p50 ?? 0),
    p95: Number(row.p95 ?? 0),
    count: typeof row.count === "bigint" ? Number(row.count) : row.count ?? 0,
  }))
}

function normalizeStats(row?: StatsRow | null): MetricsStatsDTO {
  if (!row) {
    return { ...EMPTY_STATS }
  }

  const total = row.total ?? 0
  return {
    total: typeof total === "bigint" ? Number(total) : total ?? 0,
    min: Number(row.min ?? 0),
    max: Number(row.max ?? 0),
    avg: Number(row.avg ?? 0),
    p50: Number(row.p50 ?? 0),
    p95: Number(row.p95 ?? 0),
  }
}

async function queryRange(
  params: MetricsQueryParams,
  range: { startTime: Date; endTime: Date },
  bucketSeconds: number
): Promise<Pick<MetricsQueryResultDTO, "timeseries" | "stats" | "range">> {
  const whereClause = buildWhereClause(params.type, range.startTime, range.endTime)

  const timeseriesPromise = prisma.$queryRaw<TimeseriesRow[]>(Prisma.sql`
    SELECT
      to_timestamp(floor(extract(epoch from "timestamp") / ${bucketSeconds}) * ${bucketSeconds}) AS bucket_start,
      AVG("value") AS avg,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY "value") AS p50,
      percentile_cont(0.95) WITHIN GROUP (ORDER BY "value") AS p95,
      COUNT(*) AS count
    FROM "performance_metrics"
    WHERE ${whereClause}
    GROUP BY bucket_start
    ORDER BY bucket_start ASC
  `)

  const statsPromise = prisma.$queryRaw<StatsRow[]>(Prisma.sql`
    SELECT
      COUNT(*) AS total,
      COALESCE(MIN("value"), 0) AS min,
      COALESCE(MAX("value"), 0) AS max,
      COALESCE(AVG("value"), 0) AS avg,
      COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY "value"), 0) AS p50,
      COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY "value"), 0) AS p95
    FROM "performance_metrics"
    WHERE ${whereClause}
  `)

  const [timeseriesRows, statsRows] = await Promise.all([timeseriesPromise, statsPromise])

  return {
    range: {
      startTime: range.startTime.toISOString(),
      endTime: range.endTime.toISOString(),
    },
    timeseries: normalizeTimeseries(timeseriesRows),
    stats: normalizeStats(statsRows[0]),
  }
}

export async function getMetricsTimeseries(
  params: MetricsQueryParams
): Promise<MetricsQueryResultDTO> {
  const bucket = resolveBucket(params.bucket)
  const { startTime, endTime } = resolveRange(params)
  const bucketSeconds = BUCKET_SECONDS[bucket]

  const current = await queryRange(params, { startTime, endTime }, bucketSeconds)

  const compareWindow = params.compareWindow
  if (!compareWindow) {
    return current
  }

  const shift = COMPARE_WINDOW_MS[compareWindow]
  const comparisonRange = {
    startTime: new Date(startTime.getTime() - shift),
    endTime: new Date(endTime.getTime() - shift),
  }
  const comparison = await queryRange(params, comparisonRange, bucketSeconds)

  return {
    ...current,
    comparison,
  }
}
