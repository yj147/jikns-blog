import { prisma } from "@/lib/prisma"
import { Prisma, UserStatus, Role } from "@/lib/generated/prisma"
import { normalizeTagNames } from "@/lib/repos/tag-repo"

const MAX_FILTER_TAGS = 10

// 精确的 Activity Payload 类型定义
// 使用 include 而非 select，与实际查询保持一致，避免类型断言
type ActivityWithAuthorPayload = Prisma.ActivityGetPayload<{
  include: {
    author: {
      select: {
        id: true
        name: true
        avatarUrl: true
        role: true
        status: true
      }
    }
  }
}>

export type ActivityOrderBy = "latest" | "trending" | "following"

export interface ListActivitiesParams {
  page?: number
  limit?: number
  orderBy?: ActivityOrderBy
  authorId?: string | null
  cursor?: string | null
  isPinned?: boolean | null
  hasImages?: boolean | null
  followingUserId?: string | null
  searchTerm?: string | null
  tags?: string[] | null
  publishedFrom?: Date | null
  publishedTo?: Date | null
  includeBannedAuthors?: boolean | null
  includeTotalCount?: boolean | null
}

export interface ActivityListItem {
  id: string
  authorId: string
  content: string
  imageUrls: string[]
  isPinned: boolean
  likesCount: number
  commentsCount: number
  viewsCount: number
  createdAt: string
  updatedAt: string
  author: {
    id: string
    name: string | null
    avatarUrl: string | null
    role: Role
    status: UserStatus
  }
}

export interface ListActivitiesResult {
  items: ActivityListItem[]
  hasMore: boolean
  nextCursor?: string | null
  totalCount: number | null
  appliedFilters?: {
    searchTerm?: string
    tags?: string[]
    publishedFrom?: string
    publishedTo?: string
  }
}

// Repository abstraction for Activity reads (using Prisma)
export async function listActivities(params: ListActivitiesParams): Promise<ListActivitiesResult> {
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.min(Math.max(1, params.limit ?? 20), 50)
  const orderBy: ActivityOrderBy = params.orderBy ?? "latest"
  const authorId = params.authorId ?? undefined
  const cursor = params.cursor ?? undefined
  const isPinned = params.isPinned ?? undefined
  const hasImages = params.hasImages ?? undefined
  const followingUserId = params.followingUserId ?? undefined
  const searchTerm = params.searchTerm?.trim() || undefined
  const rawTagFilters = params.tags ?? []
  const normalizedFilterTags =
    rawTagFilters.length > 0 ? normalizeTagNames(rawTagFilters, MAX_FILTER_TAGS) : []
  const filterTagSlugs = normalizedFilterTags.map((tag) => tag.slug)
  const filterTagNames = normalizedFilterTags.map((tag) => tag.name)
  const publishedFrom = params.publishedFrom ?? undefined
  const publishedTo = params.publishedTo ?? undefined
  const includeBannedAuthors = params.includeBannedAuthors ?? false
  const includeTotalCount = params.includeTotalCount ?? false

  const buildAppliedFilters = () => ({
    searchTerm: searchTerm ?? undefined,
    tags: filterTagNames.length > 0 ? filterTagNames : undefined,
    authorId: authorId ?? undefined,
    publishedFrom: publishedFrom ? publishedFrom.toISOString() : undefined,
    publishedTo: publishedTo ? publishedTo.toISOString() : undefined,
  })

  // 提前返回：如果是 "following" 排序但没有用户 ID
  if (orderBy === "following" && !followingUserId) {
    return {
      items: [],
      hasMore: false,
      nextCursor: null,
      totalCount: 0,
      appliedFilters: buildAppliedFilters(),
    }
  }

  let searchMatchedIds: string[] | null = null

  if (searchTerm) {
    const searchRows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM "activities"
      WHERE "search_vector" @@ plainto_tsquery('simple', ${searchTerm})::tsquery
    `

    if (searchRows.length === 0) {
      return {
        items: [],
        hasMore: false,
        nextCursor: null,
        totalCount: 0,
        appliedFilters: buildAppliedFilters(),
      }
    }

    searchMatchedIds = Array.from(new Set(searchRows.map((row) => row.id)))
  }

  const filters: Prisma.ActivityWhereInput[] = [{ deletedAt: null }]

  if (authorId) filters.push({ authorId })
  if (typeof isPinned === "boolean") filters.push({ isPinned })

  if (!includeBannedAuthors) {
    filters.push({
      author: {
        status: {
          not: UserStatus.BANNED,
        },
      },
    })
  }

  // 使用 Prisma 的 some 子句实现 JOIN 查询，过滤出关注用户的动态
  if (orderBy === "following" && followingUserId) {
    filters.push({
      author: {
        followers: {
          some: { followerId: followingUserId },
        },
      },
    })
  }

  if (typeof hasImages === "boolean") {
    filters.push({ imageUrls: { isEmpty: !hasImages } })
  }

  if (publishedFrom || publishedTo) {
    const createdAtFilter: Prisma.DateTimeFilter = {}
    if (publishedFrom) createdAtFilter.gte = publishedFrom
    if (publishedTo) createdAtFilter.lte = publishedTo
    filters.push({ createdAt: createdAtFilter })
  }

  if (rawTagFilters.length > 0 && filterTagSlugs.length === 0) {
    return {
      items: [],
      hasMore: false,
      nextCursor: null,
      totalCount: 0,
      appliedFilters: buildAppliedFilters(),
    }
  }

  if (filterTagSlugs.length > 0) {
    filterTagSlugs.forEach((slug) => {
      filters.push({
        tags: {
          some: {
            tag: {
              slug,
            },
          },
        },
      })
    })
  }

  if (searchMatchedIds) {
    filters.push({ id: { in: searchMatchedIds } })
  }

  const where: Prisma.ActivityWhereInput = filters.length === 1 ? filters[0] : { AND: filters }

  let orderByClause: Prisma.ActivityOrderByWithRelationInput[] = []
  switch (orderBy) {
    case "trending":
      orderByClause = [
        { isPinned: "desc" },
        { likesCount: "desc" },
        { createdAt: "desc" },
        { id: "desc" },
      ]
      break
    case "following":
      orderByClause = [{ isPinned: "desc" }, { createdAt: "desc" }, { id: "desc" }]
      break
    default:
      orderByClause = [{ isPinned: "desc" }, { createdAt: "desc" }, { id: "desc" }]
      break
  }

  const paginationArgs: Record<string, unknown> = {
    take: limit + 1,
  }

  if (cursor) {
    paginationArgs.cursor = { id: cursor }
    paginationArgs.skip = 1
  } else if (page > 1) {
    paginationArgs.skip = (page - 1) * limit
  }

  const [activities, totalCount] = await Promise.all([
    prisma.activity.findMany({
      where,
      orderBy: orderByClause,
      ...paginationArgs,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            role: true,
            status: true,
          },
        },
      },
    }),
    includeTotalCount ? prisma.activity.count({ where }) : Promise.resolve(null),
  ])

  const hasMore = activities.length > limit
  const items = hasMore ? activities.slice(0, limit) : activities
  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : null

  const normalized: ActivityListItem[] = items.map((activity) => {
    return {
      id: activity.id,
      authorId: activity.authorId,
      content: activity.content,
      imageUrls: activity.imageUrls,
      isPinned: activity.isPinned,
      likesCount: activity.likesCount,
      commentsCount: activity.commentsCount,
      viewsCount: activity.viewsCount,
      createdAt: activity.createdAt.toISOString(),
      updatedAt: activity.updatedAt.toISOString(),
      author: {
        id: activity.author.id,
        name: activity.author.name,
        avatarUrl: activity.author.avatarUrl,
        role: activity.author.role,
        status: activity.author.status,
      },
    }
  })

  return {
    items: normalized,
    hasMore,
    nextCursor,
    totalCount,
    appliedFilters: buildAppliedFilters(),
  }
}
