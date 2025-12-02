import { z } from "zod"
import type { Prisma } from "@/lib/generated/prisma"

export const feedQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    authorId: z.string().uuid().optional(),
    q: z.string().trim().max(100).optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    isPinned: z.coerce.boolean().optional(),
    includeDeleted: z.coerce.boolean().optional().default(false),
  })
  .superRefine((value, ctx) => {
    if (value.dateFrom && value.dateTo && value.dateFrom > value.dateTo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dateFrom"],
        message: "开始时间不能晚于结束时间",
      })
    }
  })

export type FeedQuery = z.infer<typeof feedQuerySchema>

export const feedInclude = {
  author: {
    select: {
      id: true,
      name: true,
      role: true,
      status: true,
    },
  },
} satisfies Prisma.ActivityInclude

export function buildFeedWhere(filters: FeedQuery): Prisma.ActivityWhereInput {
  const clauses: Prisma.ActivityWhereInput[] = []

  if (!filters.includeDeleted) {
    clauses.push({ deletedAt: null })
  }

  if (filters.authorId) {
    clauses.push({ authorId: filters.authorId })
  }

  if (filters.q) {
    clauses.push({
      OR: [
        { content: { contains: filters.q, mode: "insensitive" } },
        { contentTokens: { contains: filters.q, mode: "insensitive" } },
      ],
    })
  }

  if (filters.dateFrom || filters.dateTo) {
    const createdAt: Prisma.DateTimeFilter = {}
    if (filters.dateFrom) createdAt.gte = filters.dateFrom
    if (filters.dateTo) createdAt.lte = filters.dateTo
    clauses.push({ createdAt })
  }

  if (typeof filters.isPinned === "boolean") {
    clauses.push({ isPinned: filters.isPinned })
  }

  if (clauses.length === 0) return {}
  if (clauses.length === 1) return clauses[0]
  return { AND: clauses }
}

export const FEED_ORDER_BY: Prisma.ActivityOrderByWithRelationInput[] = [
  { createdAt: "desc" },
  { id: "desc" },
]

export function mapFeedRecord(feed: Prisma.ActivityGetPayload<{ include: typeof feedInclude }>) {
  return {
    id: feed.id,
    authorId: feed.authorId,
    content: feed.content,
    imageUrls: feed.imageUrls,
    isPinned: feed.isPinned,
    deletedAt: feed.deletedAt ? feed.deletedAt.toISOString() : null,
    likesCount: feed.likesCount,
    commentsCount: feed.commentsCount,
    viewsCount: feed.viewsCount,
    createdAt: feed.createdAt.toISOString(),
    updatedAt: feed.updatedAt.toISOString(),
    author: feed.author,
  }
}
