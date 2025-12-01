import { prisma } from "@/lib/prisma"
import type { AuthenticatedUser } from "@/lib/auth/session"
import { privacySettingsSchema } from "@/types/user-settings"

export type FollowListVisibility = "public" | "followers" | "private"

export type FollowListDenyReason =
  | "NOT_FOUND"
  | "PRIVATE"
  | "FOLLOWERS_ONLY"
  | "UNAUTHENTICATED"

export interface FollowListAccessResult {
  allowed: boolean
  visibility: FollowListVisibility
  isOwner: boolean
  isAdmin: boolean
  viewerFollows: boolean
  denyReason?: FollowListDenyReason
}

function normalizeVisibility(raw: string | undefined): FollowListVisibility {
  if (raw === "followers_only") return "followers"
  if (raw === "private") return "private"
  if (raw === "followers") return "followers"
  return "public"
}

/**
 * 关注列表访问权限判定
 *
 * Linus 原则：先消除特殊情况，再谈分支
 */
export async function evaluateFollowListAccess(
  userId: string,
  viewer: AuthenticatedUser | null
): Promise<FollowListAccessResult> {
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      privacySettings: true,
    },
  })

  if (!targetUser) {
    return {
      allowed: false,
      visibility: "public",
      isOwner: false,
      isAdmin: false,
      viewerFollows: false,
      denyReason: "NOT_FOUND",
    }
  }

  const parsedPrivacy = privacySettingsSchema.safeParse(targetUser.privacySettings ?? {})
  const visibility = normalizeVisibility(
    parsedPrivacy.success ? parsedPrivacy.data.profileVisibility : undefined
  )

  const isOwner = viewer?.id === targetUser.id
  const isAdmin = viewer?.role === "ADMIN"

  if (isOwner || isAdmin) {
    return {
      allowed: true,
      visibility,
      isOwner,
      isAdmin: Boolean(isAdmin),
      viewerFollows: false,
    }
  }

  if (visibility === "public") {
    return {
      allowed: true,
      visibility,
      isOwner: false,
      isAdmin: false,
      viewerFollows: false,
    }
  }

  if (!viewer) {
    return {
      allowed: false,
      visibility,
      isOwner: false,
      isAdmin: false,
      viewerFollows: false,
      denyReason: "UNAUTHENTICATED",
    }
  }

  if (visibility === "private") {
    return {
      allowed: false,
      visibility,
      isOwner: false,
      isAdmin: false,
      viewerFollows: false,
      denyReason: "PRIVATE",
    }
  }

  const followRelation = await prisma.follow.findUnique({
    where: {
      followerId_followingId: {
        followerId: viewer.id,
        followingId: targetUser.id,
      },
    },
    select: { followerId: true },
  })

  const viewerFollows = Boolean(followRelation)

  if (!viewerFollows) {
    return {
      allowed: false,
      visibility,
      isOwner: false,
      isAdmin: false,
      viewerFollows: false,
      denyReason: "FOLLOWERS_ONLY",
    }
  }

  return {
    allowed: true,
    visibility,
    isOwner: false,
    isAdmin: false,
    viewerFollows: true,
  }
}
