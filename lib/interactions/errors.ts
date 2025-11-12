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
