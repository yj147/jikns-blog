import { prisma } from "@/lib/prisma"
import { Prisma } from "@/lib/generated/prisma"

export type AdminPostSort = "newest" | "oldest" | "title" | "views" | "likes"
export type AdminPostStatus = "all" | "published" | "draft" | "pinned"

export interface AdminPostListParams {
  page?: number
  limit?: number
  search?: string
  status?: AdminPostStatus
  seriesId?: string
  tags?: string[]
  sort?: AdminPostSort
  authorId?: string
  fromDate?: string
  toDate?: string
}

export interface AdminPostListResult {
  posts: AdminPostEntity[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
  stats: {
    total: number
    published: number
    drafts: number
    pinned: number
  }
  availableTags: string[]
}

/**
 * 管理端文章列表查询配置
 * 使用 select 明确指定需要的字段，排除 content 等大字段以优化性能
 */
const ADMIN_POST_SELECT = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  published: true,
  isPinned: true,
  coverImage: true,
  viewCount: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  authorId: true,
  seriesId: true,
  // 排除以下大字段以优化列表查询性能：
  // content: false,
  // seoTitle: false,
  // seoDescription: false,
  // canonicalUrl: false,
  author: {
    select: {
      id: true,
      name: true,
      avatarUrl: true,
    },
  },
  tags: {
    include: {
      tag: {
        select: {
          id: true,
          name: true,
          slug: true,
          color: true,
        },
      },
    },
  },
  _count: {
    select: {
      comments: true,
      likes: true,
      bookmarks: true,
    },
  },
} satisfies Prisma.PostSelect

export type AdminPostEntity = Prisma.PostGetPayload<{ select: typeof ADMIN_POST_SELECT }>

const DEFAULT_PAGE_SIZE = 12
const MAX_PAGE_SIZE = 50

function normalisePagination(page?: number, limit?: number) {
  const currentPage = Number.isFinite(page) && page && page > 0 ? Math.floor(page) : 1
  const pageSizeRaw =
    Number.isFinite(limit) && limit && limit > 0 ? Math.floor(limit) : DEFAULT_PAGE_SIZE
  const pageSize = Math.min(Math.max(pageSizeRaw, 1), MAX_PAGE_SIZE)
  return { currentPage, pageSize }
}

/**
 * 构建搜索过滤条件
 */
function buildSearchFilter(search?: string): Prisma.PostWhereInput {
  if (!search) return {}

  const query = search.trim()
  if (!query) return {}

  return {
    OR: [
      { title: { contains: query, mode: "insensitive" } },
      { excerpt: { contains: query, mode: "insensitive" } },
    ],
  }
}

/**
 * 构建日期范围过滤条件
 */
function buildDateFilter(fromDate?: string, toDate?: string): Prisma.PostWhereInput {
  if (!fromDate && !toDate) return {}

  const createdAtFilter: Prisma.DateTimeFilter = {}
  if (fromDate) {
    createdAtFilter.gte = new Date(fromDate)
  }
  if (toDate) {
    createdAtFilter.lte = new Date(toDate)
  }

  return { createdAt: createdAtFilter }
}

/**
 * 构建标签过滤条件
 */
function buildTagsFilter(tags?: string[]): Prisma.PostWhereInput {
  if (!tags || tags.length === 0) return {}

  const tagFilters = tags.filter(Boolean).map((tag) => ({
    tags: {
      some: {
        tag: {
          OR: [{ slug: tag }, { name: tag }],
        },
      },
    },
  }))

  return tagFilters.length > 0 ? { AND: tagFilters } : {}
}

/**
 * 构建状态过滤条件
 */
function buildStatusFilter(status?: AdminPostStatus): Prisma.PostWhereInput {
  if (!status || status === "all") return {}

  if (status === "published") {
    return { published: true }
  } else if (status === "draft") {
    return { published: false }
  } else if (status === "pinned") {
    return { isPinned: true }
  }

  return {}
}

/**
 * 组合所有过滤条件
 */
function buildWhere({
  search,
  seriesId,
  authorId,
  fromDate,
  toDate,
  tags,
  status,
  includeStatus,
  includeTags,
}: {
  search?: string
  seriesId?: string
  authorId?: string
  fromDate?: string
  toDate?: string
  tags?: string[]
  status?: AdminPostStatus
  includeStatus: boolean
  includeTags: boolean
}): Prisma.PostWhereInput {
  const filters: Prisma.PostWhereInput[] = [
    buildSearchFilter(search),
    buildDateFilter(fromDate, toDate),
  ]

  if (seriesId) {
    filters.push({ seriesId })
  }

  if (authorId) {
    filters.push({ authorId })
  }

  if (includeTags) {
    const tagsFilter = buildTagsFilter(tags)
    if (Object.keys(tagsFilter).length > 0) {
      filters.push(tagsFilter)
    }
  }

  if (includeStatus) {
    const statusFilter = buildStatusFilter(status)
    if (Object.keys(statusFilter).length > 0) {
      filters.push(statusFilter)
    }
  }

  const nonEmptyFilters = filters.filter((f) => Object.keys(f).length > 0)

  if (nonEmptyFilters.length === 0) {
    return {}
  }

  if (nonEmptyFilters.length === 1) {
    return nonEmptyFilters[0]
  }

  return { AND: nonEmptyFilters }
}

function resolveOrder(sort?: AdminPostSort): Prisma.PostOrderByWithRelationInput[] {
  switch (sort) {
    case "oldest":
      return [{ createdAt: "asc" }, { id: "asc" }]
    case "title":
      return [{ title: "asc" }, { createdAt: "desc" }]
    case "views":
      return [{ viewCount: "desc" }, { createdAt: "desc" }]
    case "likes":
      return [{ likes: { _count: "desc" } }, { createdAt: "desc" }]
    case "newest":
    default:
      return [{ createdAt: "desc" }, { id: "desc" }]
  }
}

export async function listAdminPosts(
  params: AdminPostListParams = {}
): Promise<AdminPostListResult> {
  const { currentPage, pageSize } = normalisePagination(params.page, params.limit)
  const normalizedTags = params.tags?.filter(Boolean) ?? []

  const whereForList = buildWhere({
    search: params.search,
    seriesId: params.seriesId,
    authorId: params.authorId,
    fromDate: params.fromDate,
    toDate: params.toDate,
    tags: normalizedTags,
    status: params.status,
    includeStatus: true,
    includeTags: true,
  })

  const whereForCounts = buildWhere({
    search: params.search,
    seriesId: params.seriesId,
    authorId: params.authorId,
    fromDate: params.fromDate,
    toDate: params.toDate,
    tags: normalizedTags,
    status: params.status,
    includeStatus: false,
    includeTags: true,
  })

  const whereForTags = buildWhere({
    search: params.search,
    seriesId: params.seriesId,
    authorId: params.authorId,
    fromDate: params.fromDate,
    toDate: params.toDate,
    tags: normalizedTags,
    status: params.status,
    includeStatus: false,
    includeTags: false,
  })

  const orderBy = resolveOrder(params.sort)
  const skip = (currentPage - 1) * pageSize

  const [posts, matchingCount, totalCount, publishedCount, draftsCount, pinnedCount, tagRecords] =
    await prisma.$transaction([
      prisma.post.findMany({
        where: whereForList,
        select: ADMIN_POST_SELECT,
        orderBy,
        skip,
        take: pageSize,
      }),
      prisma.post.count({ where: whereForList }),
      prisma.post.count({ where: whereForCounts }),
      prisma.post.count({ where: { ...whereForCounts, published: true } }),
      prisma.post.count({ where: { ...whereForCounts, published: false } }),
      prisma.post.count({ where: { ...whereForCounts, isPinned: true } }),
      prisma.tag.findMany({
        where: {
          posts: {
            some: {
              post: whereForTags,
            },
          },
        },
        select: { name: true },
        orderBy: { name: "asc" },
        take: 32,
      }),
    ])

  const totalPages = Math.max(Math.ceil(matchingCount / pageSize), 1)

  // 不再递归修正页码，让调用方处理超出范围的情况
  // 如果用户请求的页码超出范围，返回空结果
  // 前端可以根据 pagination.totalPages 自行处理

  return {
    posts,
    pagination: {
      page: currentPage,
      limit: pageSize,
      total: matchingCount,
      totalPages,
      hasNext: currentPage < totalPages,
      hasPrev: currentPage > 1,
    },
    stats: {
      total: totalCount,
      published: publishedCount,
      drafts: draftsCount,
      pinned: pinnedCount,
    },
    availableTags: Array.from(new Set(tagRecords.map((tag) => tag.name))).sort((a, b) =>
      a.localeCompare(b)
    ),
  }
}
