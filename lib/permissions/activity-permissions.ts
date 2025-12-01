import type { AuthenticatedUser } from "@/lib/auth/session"
import { UserStatus, Role } from "@/lib/generated/prisma"
import type { ActivityWithAuthorForPermission } from "@/types/activity"

/**
 * Activity 权限管理类
 * 实现动态发布系统的权限控制逻辑
 *
 * 使用 AuthenticatedUser 类型（6 个核心字段）而非完整 User 类型
 * 符合 Linus "好品味"原则：只使用必要的字段
 */

export class ActivityPermissions {
  /**
   * 检查用户是否可以创建动态
   * 规则：
   * - 必须已登录
   * - 用户状态必须是 ACTIVE
   */
  static canCreate(user: AuthenticatedUser | null): boolean {
    if (!user) return false
    return user.status === UserStatus.ACTIVE
  }

  /**
   * 检查用户是否可以查看动态
   * 规则：
   * - 公开动态：所有人都可以查看（包括未登录用户）
   * - 已删除动态：任何人都不能查看
   * - BANNED 用户的动态：仅管理员可见
   *
   * @param user 当前用户（可为 null）
   * @param activity 必须包含 author 数据的动态对象
   */
  static canView(
    user: AuthenticatedUser | null,
    activity: ActivityWithAuthorForPermission
  ): boolean {
    // 已删除的动态不可见
    if (activity.deletedAt) return false

    // 直接使用预加载的 author 数据，无需查询数据库
    // BANNED 用户的动态仅管理员可见
    if (activity.author.status === UserStatus.BANNED) {
      return user?.role === Role.ADMIN
    }

    // 其他情况都可以查看
    return true
  }

  /**
   * 检查用户是否可以更新动态
   * 规则：
   * - 必须已登录
   * - 管理员可以更新任何动态
   * - 普通用户只能更新自己的动态
   * - 动态不能已被删除
   */
  static canUpdate(
    user: AuthenticatedUser | null,
    activity: ActivityWithAuthorForPermission
  ): boolean {
    if (!user || activity.deletedAt) return false

    // 管理员可以更新任何动态
    if (user.role === Role.ADMIN) return true

    // 普通用户只能更新自己的动态
    return user.id === activity.authorId
  }

  /**
   * 检查用户是否可以删除动态
   * 规则：
   * - 必须已登录
   * - 管理员可以删除任何动态
   * - 普通用户只能删除自己的动态
   * - 动态不能已被删除
   */
  static canDelete(
    user: AuthenticatedUser | null,
    activity: ActivityWithAuthorForPermission
  ): boolean {
    if (!user || activity.deletedAt) return false

    // 管理员可以删除任何动态
    if (user.role === Role.ADMIN) return true

    // 普通用户只能删除自己的动态
    return user.id === activity.authorId
  }

  /**
   * 检查用户是否可以置顶动态
   * 规则：
   * - 必须已登录
   * - 只有动态作者可以置顶自己的动态
   * - 管理员可以置顶任何动态
   * - 动态不能已被删除
   */
  static canPin(
    user: AuthenticatedUser | null,
    activity: ActivityWithAuthorForPermission
  ): boolean {
    if (!user || activity.deletedAt) return false

    // 管理员可以置顶任何动态
    if (user.role === Role.ADMIN) return true

    // 普通用户只能置顶自己的动态
    return user.id === activity.authorId
  }

  /**
   * 检查用户是否可以点赞动态
   * 规则：
   * - 必须已登录
   * - 用户状态必须是 ACTIVE
   * - 不能点赞自己的动态
   * - 动态不能已被删除
   */
  static canLike(
    user: AuthenticatedUser | null,
    activity: ActivityWithAuthorForPermission
  ): boolean {
    if (!user || activity.deletedAt) return false
    if (user.status !== UserStatus.ACTIVE) return false
    if (activity.author.status !== UserStatus.ACTIVE) return false

    // 不能点赞自己的动态
    return user.id !== activity.authorId
  }

  /**
   * 检查用户是否可以评论动态
   * 规则：
   * - 必须已登录
   * - 用户状态必须是 ACTIVE
   * - 动态不能已被删除
   */
  static canComment(
    user: AuthenticatedUser | null,
    activity: ActivityWithAuthorForPermission
  ): boolean {
    if (!user || activity.deletedAt) return false
    return user.status === UserStatus.ACTIVE
  }

  /**
   * 检查用户是否可以举报动态
   * 规则：
   * - 必须已登录
   * - 用户状态必须是 ACTIVE
   * - 不能举报自己的动态
   * - 动态不能已被删除
   */
  static canReport(
    user: AuthenticatedUser | null,
    activity: ActivityWithAuthorForPermission
  ): boolean {
    if (!user || activity.deletedAt) return false
    if (user.status !== UserStatus.ACTIVE) return false

    // 不能举报自己的动态
    return user.id !== activity.authorId
  }

  /**
   * 检查用户是否可以分享动态
   * 规则：
   * - 不需要登录（游客也可以分享）
   * - 动态不能已被删除
   * - 动态作者不能是 BANNED 状态（除非查看者是管理员）
   */
  static canShare(
    user: AuthenticatedUser | null,
    activity: ActivityWithAuthorForPermission
  ): boolean {
    if (activity.deletedAt) return false

    // 检查动态是否可见
    return this.canView(user, activity)
  }

  /**
   * 批量权限检查
   * 为前端组件提供一次性权限检查结果
   */
  static getPermissions(user: AuthenticatedUser | null, activity: ActivityWithAuthorForPermission) {
    const canView = this.canView(user, activity)
    const canUpdate = this.canUpdate(user, activity)
    const canDelete = this.canDelete(user, activity)
    const canPin = this.canPin(user, activity)
    const canLike = this.canLike(user, activity)
    const canComment = this.canComment(user, activity)
    const canReport = this.canReport(user, activity)
    const canShare = this.canShare(user, activity)

    return {
      canView,
      canUpdate,
      canDelete,
      canPin,
      canLike,
      canComment,
      canReport,
      canShare,
      // 衍生权限
      canInteract: canLike || canComment, // 是否可以进行互动
      isOwner: user?.id === activity.authorId, // 是否是作者
      isAdmin: user?.role === Role.ADMIN, // 是否是管理员
    }
  }

  /**
   * 检查用户对动态列表的权限
   * 用于过滤用户无权查看的动态
   */
  static filterViewableActivities(
    user: AuthenticatedUser | null,
    activities: ActivityWithAuthorForPermission[]
  ): ActivityWithAuthorForPermission[] {
    return activities.filter((activity) => this.canView(user, activity))
  }

  /**
   * 管理员专用：检查是否可以管理其他用户的动态
   * 规则：
   * - 必须是管理员
   * - 可以查看、编辑、删除、置顶任何动态
   */
  static canManageOthersActivities(user: AuthenticatedUser | null): boolean {
    return user?.role === Role.ADMIN
  }
}

/**
 * 权限检查装饰器
 * 用于在API路由中快速进行权限验证
 */
export function requirePermission(
  permissionCheck: (
    user: AuthenticatedUser | null,
    activity: ActivityWithAuthorForPermission
  ) => boolean
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value

    descriptor.value = function (
      user: AuthenticatedUser | null,
      activity: ActivityWithAuthorForPermission,
      ...args: any[]
    ) {
      const hasPermission = permissionCheck(user, activity)

      if (!hasPermission) {
        throw new Error("权限不足")
      }

      return originalMethod.apply(this, [user, activity, ...args])
    }

    return descriptor
  }
}

/**
 * 权限常量定义
 */
export const ACTIVITY_PERMISSIONS = {
  CREATE: "activity:create",
  VIEW: "activity:view",
  UPDATE: "activity:update",
  DELETE: "activity:delete",
  PIN: "activity:pin",
  LIKE: "activity:like",
  COMMENT: "activity:comment",
  REPORT: "activity:report",
  SHARE: "activity:share",
  MANAGE_ALL: "activity:manage_all",
} as const

/**
 * 权限错误类
 */
export class ActivityPermissionError extends Error {
  constructor(
    public permission: string,
    public userId?: string,
    public activityId?: string
  ) {
    super(`权限不足: ${permission}`)
    this.name = "ActivityPermissionError"
  }
}
