/**
 * 互动服务通用错误定义
 * 主要用于统一外部可识别的错误类型
 */

export class InteractionTargetNotFoundError extends Error {
  readonly targetType: string
  readonly targetId?: string

  constructor(targetType: "post" | "activity", targetId?: string) {
    super(`${targetType} not found`)
    this.name = "InteractionTargetNotFoundError"
    this.targetType = targetType
    this.targetId = targetId
  }
}

export type InteractionNotAllowedReason =
  | "SELF_LIKE"
  | "TARGET_DELETED"
  | "AUTHOR_INACTIVE"
  | "ACTOR_INACTIVE"
  | "LIKE_NOT_ALLOWED"
  | "ACTOR_NOT_FOUND"

export class InteractionNotAllowedError extends Error {
  readonly reason: InteractionNotAllowedReason
  readonly statusCode?: number

  constructor(reason: InteractionNotAllowedReason, message?: string, statusCode?: number) {
    super(message ?? "互动操作被拒绝")
    this.name = "InteractionNotAllowedError"
    this.reason = reason
    this.statusCode = statusCode
  }
}
