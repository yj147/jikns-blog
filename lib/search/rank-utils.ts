import { Prisma } from "@/lib/generated/prisma"
import {
  SEARCH_FULLTEXT_CONFIG,
  SEARCH_TIME_DECAY_HALF_LIFE_DAYS,
} from "@/lib/search/full-text-config"
import type { SearchSortOption } from "@/lib/search/search-params"

const FULLTEXT_CONFIG_SQL = Prisma.raw(`'${SEARCH_FULLTEXT_CONFIG}'`)

export const buildTsQuery = (term: string) =>
  Prisma.sql`plainto_tsquery(${FULLTEXT_CONFIG_SQL}, ${term})`

export type SearchExecutionMode = "ts" | "like"

interface RankOptions {
  vectorColumn?: Prisma.Sql
  timestampColumn: Prisma.Sql
  tsQuery?: Prisma.Sql
  sort: SearchSortOption
  halfLifeDays?: number
  mode?: SearchExecutionMode
  fallbackOrderClause?: Prisma.Sql
}

export function buildRankExpressions({
  vectorColumn = Prisma.sql`search_vector`,
  timestampColumn,
  tsQuery,
  sort,
  halfLifeDays = SEARCH_TIME_DECAY_HALF_LIFE_DAYS,
  mode = "ts",
  fallbackOrderClause,
}: RankOptions) {
  if (mode === "like") {
    const orderByClause = fallbackOrderClause ?? Prisma.sql`${timestampColumn} DESC NULLS LAST`
    const zeroRank = Prisma.sql`0`
    return {
      rankSelect: zeroRank,
      orderByClause,
      baseRank: zeroRank,
      decayedRank: zeroRank,
    }
  }

  if (!tsQuery) {
    throw new Error("tsQuery is required when mode is 'ts'")
  }

  const baseRank = Prisma.sql`ts_rank(${vectorColumn}, ${tsQuery})`
  const ageInDays = Prisma.sql`GREATEST(EXTRACT(EPOCH FROM (NOW() - ${timestampColumn})) / 86400.0, 0)`
  const halfLifeSql = Prisma.raw(halfLifeDays.toString())
  const decay = Prisma.sql`EXP((-LN(2) * ${ageInDays}) / ${halfLifeSql})`
  const decayedRank = Prisma.sql`${baseRank} * ${decay}`

  const rankSelect = sort === "latest" ? baseRank : decayedRank
  const orderByClause =
    sort === "latest"
      ? Prisma.sql`${timestampColumn} DESC NULLS LAST, ${baseRank} DESC`
      : Prisma.sql`${decayedRank} DESC, ${timestampColumn} DESC NULLS LAST`

  return {
    rankSelect,
    orderByClause,
    baseRank,
    decayedRank,
  }
}
