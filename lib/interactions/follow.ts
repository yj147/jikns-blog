/**
 * 用户关注服务层
 * 提供关注/取关、列表查询与状态批量查询能力
 */

import { prisma } from "@/lib/prisma"
import type { UserStatus } from "@/lib/generated/prisma"
import { Prisma } from "@/lib/generated/prisma"
import {
  encodeFollowCursor,
  decodeFollowCursor,
  CursorDecodeError,
  type CursorData,
} from "@/lib/follow/cursor-utils"
import { notify } from "@/lib/services/notification"

const DEFAULT_LIST_LIMIT = 20
const MAX_LIST_LIMIT = 50

/**
 * 公开用户信息选择器
 *
 * Linus 原则：数据结构驱动设计
 * 只包含可以公开展示的用户信息，绝不暴露 PII（如 email）
 *
 * 用途：关注列表、粉丝列表等公开 API
 */
const PUBLIC_USER_SELECT = {
  id: true,
  name: true,
  avatarUrl: true,
  bio: true,
  status: true,
} satisfies Prisma.UserSelect

const followerListSelect = Prisma.validator<Prisma.FollowSelect>()({
  followerId: true,
  followingId: true,
  createdAt: true,
  follower: {
    select: PUBLIC_USER_SELECT,
  },
})

const followingListSelect = Prisma.validator<Prisma.FollowSelect>()({
  followerId: true,
  followingId: true,
  createdAt: true,
  following: {
    select: PUBLIC_USER_SELECT,
  },
})

type FollowerListRecord = Prisma.FollowGetPayload<{ select: typeof followerListSelect }>
type FollowingListRecord = Prisma.FollowGetPayload<{ select: typeof followingListSelect }>

export type FollowServiceErrorCode =
  | "SELF_FOLLOW"
  | "TARGET_NOT_FOUND"
  | "TARGET_INACTIVE"
  | "LIMIT_EXCEEDED"
  | "INVALID_CURSOR"

export class FollowServiceError extends Error {
  readonly code: FollowServiceErrorCode

  constructor(message: string, code: FollowServiceErrorCode) {
    super(message)
    this.name = "FollowServiceError"
    this.code = code
  }
}

export interface FollowActionResult {
  followerId: string
  followingId: string
  createdAt: string
  wasNew: boolean
  targetName: string | null
}

export interface UnfollowActionResult {
  followerId: string
  followingId: string
  wasDeleted: boolean
}

/**
 * 公开用户资料类型
 *
 * Linus 原则：消除特殊情况
 * 所有公开 API 统一使用这个类型，不允许例外
 * 绝不包含 PII（email、phone 等敏感信息）
 */
export interface PublicUserProfile {
  id: string
  name: string | null
  avatarUrl: string | null
  bio: string | null
  status: UserStatus
}

/**
 * 关注列表项
 *
 * 扩展公开用户资料，添加关注关系特有的字段
 */
export interface FollowListItem extends PublicUserProfile {
  isMutual: boolean
  followedAt: string
}

export interface FollowListResult {
  items: FollowListItem[]
  hasMore: boolean
  nextCursor?: string
}

export interface FollowListOptions {
  limit?: number
  cursor?: string
  offset?: number
}

/**
 * 单个用户的关注状态
 */
export interface FollowStatus {
  isFollowing: boolean
  isMutual: boolean
}

/**
 * 批量关注状态查询结果
 *
 * Linus 原则：数据结构驱动设计
 * 使用键值对结构便于客户端快速查找，避免 O(n) 遍历
 *
 * 格式：{ [userId]: { isFollowing, isMutual } }
 */
export type FollowStatusMap = Record<string, FollowStatus>

function ensureValidTarget(followerId: string, targetId: string) {
  if (!followerId || !targetId) {
    throw new FollowServiceError("followerId and targetId are required", "TARGET_NOT_FOUND")
  }

  if (followerId === targetId) {
    throw new FollowServiceError("cannot follow yourself", "SELF_FOLLOW")
  }
}

function normaliseLimit(rawLimit: number | undefined): number {
  const limit = rawLimit ?? DEFAULT_LIST_LIMIT
  if (Number.isNaN(limit) || limit <= 0) return DEFAULT_LIST_LIMIT
  return Math.min(limit, MAX_LIST_LIMIT)
}

function normaliseOffset(rawOffset: number | undefined): number {
  if (rawOffset === undefined) return 0
  if (Number.isNaN(rawOffset)) return 0
  const offset = Math.floor(rawOffset)
  return offset > 0 ? offset : 0
}

function isUniqueConstraintError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

function isNotFoundError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025"
}

function applyCursorCondition(
  base: Prisma.FollowWhereInput,
  idField: "followerId" | "followingId",
  cursor?: CursorData
): Prisma.FollowWhereInput {
  if (!cursor) return base

  return {
    ...base,
    OR: [
      { createdAt: { lt: cursor.createdAt } },
      {
        createdAt: cursor.createdAt,
        [idField]: { gt: cursor.id },
      },
    ],
  }
}

interface FollowListQueryConfig {
  direction: "followers" | "following"
  userId: string
  options?: FollowListOptions
}

async function getFollowList({
  direction,
  userId,
  options,
}: FollowListQueryConfig): Promise<FollowListResult> {
  const limit = normaliseLimit(options?.limit)
  let cursorData
  try {
    cursorData = options?.cursor ? decodeFollowCursor(options.cursor) : undefined
  } catch (error) {
    if (error instanceof CursorDecodeError) {
      throw new FollowServiceError("invalid pagination cursor", "INVALID_CURSOR")
    }
    throw error
  }

  const isFollowers = direction === "followers"
  const baseWhere = isFollowers ? { followingId: userId } : { followerId: userId }
  const idField = isFollowers ? "followerId" : "followingId"

  const whereClause = applyCursorCondition(baseWhere, idField, cursorData)
  const orderBy: Prisma.FollowOrderByWithRelationInput[] = [
    { createdAt: "desc" },
    { [idField]: "asc" } as Prisma.FollowOrderByWithRelationInput,
  ]
  const offset = cursorData ? 0 : normaliseOffset(options?.offset)
  const skip = offset > 0 ? offset : undefined

  if (isFollowers) {
    const records: FollowerListRecord[] = await prisma.follow.findMany({
      where: whereClause,
      select: followerListSelect,
      orderBy,
      take: limit + 1,
      skip,
    })

    const hasMore = records.length > limit
    const edges = hasMore ? records.slice(0, limit) : records
    const targetIds = edges.map((edge) => edge.followerId)
    const mutualIds =
      targetIds.length > 0
        ? new Set(
            (
              await prisma.follow.findMany({
                where: {
                  followerId: userId,
                  followingId: { in: targetIds },
                },
                select: { followingId: true },
              })
            ).map((record) => record.followingId)
          )
        : new Set<string>()

    const items: FollowListItem[] = edges.map((edge) => {
      const follower = edge.follower
      return {
        id: follower.id,
        name: follower.name ?? null,
        avatarUrl: follower.avatarUrl ?? null,
        bio: follower.bio ?? null,
        status: follower.status as UserStatus,
        isMutual: mutualIds.has(edge.followerId),
        followedAt: edge.createdAt.toISOString(),
      }
    })

    const lastEdge = edges[edges.length - 1]
    const nextCursor =
      hasMore && lastEdge ? encodeFollowCursor(lastEdge.createdAt, lastEdge.followerId) : undefined

    return {
      items,
      hasMore,
      nextCursor,
    }
  }

  const records: FollowingListRecord[] = await prisma.follow.findMany({
    where: whereClause,
    select: followingListSelect,
    orderBy,
    take: limit + 1,
    skip,
  })

  const hasMore = records.length > limit
  const edges = hasMore ? records.slice(0, limit) : records
  const targetIds = edges.map((edge) => edge.followingId)
  const mutualIds =
    targetIds.length > 0
      ? new Set(
          (
            await prisma.follow.findMany({
              where: {
                followerId: { in: targetIds },
                followingId: userId,
              },
              select: { followerId: true },
            })
          ).map((record) => record.followerId)
        )
      : new Set<string>()

  const items: FollowListItem[] = edges.map((edge) => {
    const following = edge.following
    return {
      id: following.id,
      name: following.name ?? null,
      avatarUrl: following.avatarUrl ?? null,
      bio: following.bio ?? null,
      status: following.status as UserStatus,
      isMutual: mutualIds.has(edge.followingId),
      followedAt: edge.createdAt.toISOString(),
    }
  })

  const lastEdge = edges[edges.length - 1]
  const nextCursor =
    hasMore && lastEdge ? encodeFollowCursor(lastEdge.createdAt, lastEdge.followingId) : undefined

  return {
    items,
    hasMore,
    nextCursor,
  }
}

export async function followUser(
  followerId: string,
  targetId: string
): Promise<FollowActionResult> {
  ensureValidTarget(followerId, targetId)

  const targetUser = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, status: true, name: true },
  })

  if (!targetUser) {
    throw new FollowServiceError("target user not found", "TARGET_NOT_FOUND")
  }

  if (targetUser.status !== "ACTIVE") {
    throw new FollowServiceError("target user is not active", "TARGET_INACTIVE")
  }

  const existing = await prisma.follow.findUnique({
    where: {
      followerId_followingId: {
        followerId,
        followingId: targetId,
      },
    },
  })

  if (existing) {
    return {
      followerId,
      followingId: targetId,
      createdAt: existing.createdAt.toISOString(),
      wasNew: false,
      targetName: targetUser.name ?? null,
    }
  }

  try {
    const follow = await prisma.follow.create({
      data: {
        followerId,
        followingId: targetId,
      },
    })

    await notify(targetId, "FOLLOW", { actorId: followerId })

    return {
      followerId: follow.followerId,
      followingId: follow.followingId,
      createdAt: follow.createdAt.toISOString(),
      wasNew: true,
      targetName: targetUser.name ?? null,
    }
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error
    }

    // 重试读取，处理并发创建导致的唯一约束冲突
    const retry = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId: targetId,
        },
      },
    })

    if (!retry) {
      throw error
    }

    return {
      followerId,
      followingId: targetId,
      createdAt: retry.createdAt.toISOString(),
      wasNew: false,
      targetName: targetUser.name ?? null,
    }
  }
}

export async function unfollowUser(
  followerId: string,
  targetId: string
): Promise<UnfollowActionResult> {
  ensureValidTarget(followerId, targetId)

  return prisma.$transaction(async (tx) => {
    const existing = await tx.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId: targetId,
        },
      },
      select: { followerId: true },
    })

    if (!existing) {
      return {
        followerId,
        followingId: targetId,
        wasDeleted: false,
      }
    }

    try {
      await tx.follow.delete({
        where: {
          followerId_followingId: {
            followerId,
            followingId: targetId,
          },
        },
      })

      return {
        followerId,
        followingId: targetId,
        wasDeleted: true,
      }
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error
      }

      return {
        followerId,
        followingId: targetId,
        wasDeleted: false,
      }
    }
  })
}

export async function listFollowers(
  userId: string,
  options?: FollowListOptions
): Promise<FollowListResult> {
  return getFollowList({ direction: "followers", userId, options })
}

export async function listFollowing(
  userId: string,
  options?: FollowListOptions
): Promise<FollowListResult> {
  return getFollowList({ direction: "following", userId, options })
}

/**
 * 批量查询关注状态
 *
 * Linus 原则：简洁执念
 * - 一次查询获取所有数据
 * - 使用 Set 进行 O(1) 查找
 * - 返回键值对结构便于客户端使用
 *
 * @param actorId - 当前用户 ID
 * @param targetIds - 目标用户 ID 列表（最多 50 个）
 * @returns 键值对映射：{ [userId]: { isFollowing, isMutual } }
 */
export async function getFollowStatusBatch(
  actorId: string,
  targetIds: string[]
): Promise<FollowStatusMap> {
  if (!Array.isArray(targetIds) || targetIds.length === 0) {
    return {}
  }

  if (targetIds.length > 50) {
    throw new FollowServiceError("batch size cannot exceed 50", "LIMIT_EXCEEDED")
  }

  const uniqueTargetIds = Array.from(new Set(targetIds)).filter((id) => id !== actorId)

  if (uniqueTargetIds.length === 0) {
    return {}
  }

  const followings = await prisma.follow.findMany({
    where: {
      followerId: actorId,
      followingId: { in: uniqueTargetIds },
    },
    select: { followingId: true },
  })

  const followers = await prisma.follow.findMany({
    where: {
      followerId: { in: uniqueTargetIds },
      followingId: actorId,
    },
    select: { followerId: true },
  })

  const followingSet = new Set(followings.map((record) => record.followingId))
  const followerSet = new Set(followers.map((record) => record.followerId))

  const statusMap: FollowStatusMap = {}
  for (const id of uniqueTargetIds) {
    const isFollowing = followingSet.has(id)
    statusMap[id] = {
      isFollowing,
      isMutual: isFollowing && followerSet.has(id),
    }
  }

  return statusMap
}
