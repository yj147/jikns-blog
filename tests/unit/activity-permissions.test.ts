import { describe, expect, it } from "vitest"
import { Role, UserStatus } from "@/lib/generated/prisma"
import { ActivityPermissions } from "@/lib/permissions/activity-permissions"
import type { ActivityWithAuthorForPermission } from "@/types/activity"
import type { User } from "@/lib/generated/prisma"

describe("ActivityPermissions - 无 N+1 查询版本", () => {
  describe("canView", () => {
    it("应该允许查看正常动态", () => {
      const activity: ActivityWithAuthorForPermission = {
        id: "act-1",
        authorId: "user-1",
        deletedAt: null,
        isPinned: false,
        author: {
          id: "user-1",
          status: UserStatus.ACTIVE,
          role: Role.USER,
        },
      }

      const result = ActivityPermissions.canView(null, activity)
      expect(result).toBe(true)
    })

    it("应该拒绝查看已删除的动态", () => {
      const activity: ActivityWithAuthorForPermission = {
        id: "act-1",
        authorId: "user-1",
        deletedAt: new Date(),
        isPinned: false,
        author: {
          id: "user-1",
          status: UserStatus.ACTIVE,
          role: Role.USER,
        },
      }

      const result = ActivityPermissions.canView(null, activity)
      expect(result).toBe(false)
    })

    it("应该拒绝普通用户查看被封禁用户的动态", () => {
      const activity: ActivityWithAuthorForPermission = {
        id: "act-1",
        authorId: "user-1",
        deletedAt: null,
        isPinned: false,
        author: {
          id: "user-1",
          status: UserStatus.BANNED,
          role: Role.USER,
        },
      }

      const viewer: User = {
        id: "user-2",
        role: Role.USER,
        status: UserStatus.ACTIVE,
      } as User

      const result = ActivityPermissions.canView(viewer, activity)
      expect(result).toBe(false)
    })

    it("应该允许管理员查看被封禁用户的动态", () => {
      const activity: ActivityWithAuthorForPermission = {
        id: "act-1",
        authorId: "user-1",
        deletedAt: null,
        isPinned: false,
        author: {
          id: "user-1",
          status: UserStatus.BANNED,
          role: Role.USER,
        },
      }

      const admin: User = {
        id: "admin-1",
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
      } as User

      const result = ActivityPermissions.canView(admin, activity)
      expect(result).toBe(true)
    })
  })

  describe("canUpdate", () => {
    it("应该允许作者更新自己的动态", () => {
      const activity: ActivityWithAuthorForPermission = {
        id: "act-1",
        authorId: "user-1",
        deletedAt: null,
        isPinned: false,
        author: {
          id: "user-1",
          status: UserStatus.ACTIVE,
          role: Role.USER,
        },
      }

      const user: User = {
        id: "user-1",
        role: Role.USER,
        status: UserStatus.ACTIVE,
      } as User

      const result = ActivityPermissions.canUpdate(user, activity)
      expect(result).toBe(true)
    })

    it("应该拒绝非作者更新动态", () => {
      const activity: ActivityWithAuthorForPermission = {
        id: "act-1",
        authorId: "user-1",
        deletedAt: null,
        isPinned: false,
        author: {
          id: "user-1",
          status: UserStatus.ACTIVE,
          role: Role.USER,
        },
      }

      const user: User = {
        id: "user-2",
        role: Role.USER,
        status: UserStatus.ACTIVE,
      } as User

      const result = ActivityPermissions.canUpdate(user, activity)
      expect(result).toBe(false)
    })

    it("应该允许管理员更新任何动态", () => {
      const activity: ActivityWithAuthorForPermission = {
        id: "act-1",
        authorId: "user-1",
        deletedAt: null,
        isPinned: false,
        author: {
          id: "user-1",
          status: UserStatus.ACTIVE,
          role: Role.USER,
        },
      }

      const admin: User = {
        id: "admin-1",
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
      } as User

      const result = ActivityPermissions.canUpdate(admin, activity)
      expect(result).toBe(true)
    })
  })

  describe("canDelete", () => {
    it("应该允许作者删除自己的动态", () => {
      const activity: ActivityWithAuthorForPermission = {
        id: "act-1",
        authorId: "user-1",
        deletedAt: null,
        isPinned: false,
        author: {
          id: "user-1",
          status: UserStatus.ACTIVE,
          role: Role.USER,
        },
      }

      const user: User = {
        id: "user-1",
        role: Role.USER,
        status: UserStatus.ACTIVE,
      } as User

      const result = ActivityPermissions.canDelete(user, activity)
      expect(result).toBe(true)
    })

    it("应该允许管理员删除任何动态", () => {
      const activity: ActivityWithAuthorForPermission = {
        id: "act-1",
        authorId: "user-1",
        deletedAt: null,
        isPinned: false,
        author: {
          id: "user-1",
          status: UserStatus.ACTIVE,
          role: Role.USER,
        },
      }

      const admin: User = {
        id: "admin-1",
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
      } as User

      const result = ActivityPermissions.canDelete(admin, activity)
      expect(result).toBe(true)
    })
  })

  describe("canLike", () => {
    it("应该允许用户点赞他人的动态", () => {
      const activity: ActivityWithAuthorForPermission = {
        id: "act-1",
        authorId: "user-1",
        deletedAt: null,
        isPinned: false,
        author: {
          id: "user-1",
          status: UserStatus.ACTIVE,
          role: Role.USER,
        },
      }

      const user: User = {
        id: "user-2",
        role: Role.USER,
        status: UserStatus.ACTIVE,
      } as User

      const result = ActivityPermissions.canLike(user, activity)
      expect(result).toBe(true)
    })

    it("应该拒绝用户点赞自己的动态", () => {
      const activity: ActivityWithAuthorForPermission = {
        id: "act-1",
        authorId: "user-1",
        deletedAt: null,
        isPinned: false,
        author: {
          id: "user-1",
          status: UserStatus.ACTIVE,
          role: Role.USER,
        },
      }

      const user: User = {
        id: "user-1",
        role: Role.USER,
        status: UserStatus.ACTIVE,
      } as User

      const result = ActivityPermissions.canLike(user, activity)
      expect(result).toBe(false)
    })

    it("应该拒绝被封禁用户点赞", () => {
      const activity: ActivityWithAuthorForPermission = {
        id: "act-1",
        authorId: "user-1",
        deletedAt: null,
        isPinned: false,
        author: {
          id: "user-1",
          status: UserStatus.ACTIVE,
          role: Role.USER,
        },
      }

      const bannedUser: User = {
        id: "user-2",
        role: Role.USER,
        status: UserStatus.BANNED,
      } as User

      const result = ActivityPermissions.canLike(bannedUser, activity)
      expect(result).toBe(false)
    })
  })

  describe("filterViewableActivities", () => {
    it("应该过滤掉被封禁用户的动态（非管理员）", () => {
      const activities: ActivityWithAuthorForPermission[] = [
        {
          id: "act-1",
          authorId: "user-1",
          deletedAt: null,
          isPinned: false,
          author: { id: "user-1", status: UserStatus.ACTIVE, role: Role.USER },
        },
        {
          id: "act-2",
          authorId: "user-2",
          deletedAt: null,
          isPinned: false,
          author: { id: "user-2", status: UserStatus.BANNED, role: Role.USER },
        },
      ]

      const result = ActivityPermissions.filterViewableActivities(null, activities)
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe("act-1")
    })

    it("应该允许管理员查看所有动态", () => {
      const activities: ActivityWithAuthorForPermission[] = [
        {
          id: "act-1",
          authorId: "user-1",
          deletedAt: null,
          isPinned: false,
          author: { id: "user-1", status: UserStatus.ACTIVE, role: Role.USER },
        },
        {
          id: "act-2",
          authorId: "user-2",
          deletedAt: null,
          isPinned: false,
          author: { id: "user-2", status: UserStatus.BANNED, role: Role.USER },
        },
      ]

      const admin: User = {
        id: "admin-1",
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
      } as User

      const result = ActivityPermissions.filterViewableActivities(admin, activities)
      expect(result).toHaveLength(2)
    })
  })
})
