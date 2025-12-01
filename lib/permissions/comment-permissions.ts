import type { AuthenticatedUser } from "@/lib/auth/session"
import { Role, UserStatus } from "@/lib/generated/prisma"

/**
 * 评论权限主体（用于权限判断的最小数据集）
 */
export interface CommentForPermission {
  id: string
  authorId: string
  deletedAt: Date | null
  authorStatus?: UserStatus
}

/**
 * Comment 权限管理类
 * 实现评论系统的权限控制逻辑
 *
 * 符合 Linus "好品味"原则：只使用必要的字段
 */
export class CommentPermissions {
  /**
   * 检查用户是否可以删除评论
   * 规则：
   * - 必须已登录
   * - 管理员可以删除任何评论
   * - 普通用户只能删除自己的评论
   * - 评论不能已被删除
   */
  static canDelete(user: AuthenticatedUser | null, comment: CommentForPermission): boolean {
    if (!user || comment.deletedAt) return false

    // 管理员可以删除任何评论
    if (user.role === Role.ADMIN) return true

    // 普通用户只能删除自己的评论
    return user.id === comment.authorId
  }

  /**
   * 检查用户是否可以编辑评论
   * 规则：
   * - 必须已登录
   * - 只有评论作者可以编辑自己的评论
   * - 评论不能已被删除
   */
  static canEdit(user: AuthenticatedUser | null, comment: CommentForPermission): boolean {
    if (!user || comment.deletedAt) return false

    // 只有作者可以编辑（管理员也不能编辑别人的评论）
    return user.id === comment.authorId
  }

  /**
   * 检查用户是否可以点赞评论
   * 规则：
   * - 必须已登录且处于 ACTIVE 状态
   * - 评论未被删除
   * - 不能给自己的评论点赞
   * - 评论作者必须是 ACTIVE（如已封禁则禁止互动）
   */
  static canLike(user: AuthenticatedUser | null, comment: CommentForPermission): boolean {
    if (!user || comment.deletedAt) return false
    if (user.status !== UserStatus.ACTIVE) return false
    if (comment.authorStatus && comment.authorStatus !== UserStatus.ACTIVE) return false

    return user.id !== comment.authorId
  }

  /**
   * 批量计算评论权限
   */
  static getPermissions(user: AuthenticatedUser | null, comment: CommentForPermission) {
    return {
      canEdit: this.canEdit(user, comment),
      canDelete: this.canDelete(user, comment),
    }
  }
}
