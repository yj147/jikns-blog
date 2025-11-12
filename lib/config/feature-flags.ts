/**
 * Feature flag 解析工具
 * 所有服务端读取的开关统一放在此处，便于集中管理与测试注入
 */

type BooleanString = "true" | "false" | "1" | "0"

/**
 * 将环境变量解析为布尔值，默认值由调用方指定
 */
function parseBooleanFlag(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === null) return defaultValue

  const normalized = value.trim().toLowerCase() as BooleanString
  if (normalized === "true" || normalized === "1") return true
  if (normalized === "false" || normalized === "0") return false
  return defaultValue
}

/**
 * 返回统一的特性开关读取方法，避免直接散落访问 `process.env`
 */
export const featureFlags = {
  /**
   * 是否开启公开文章 API 审计日志，用于上线前采集依赖字段的客户端列表
   */
  postsPublicEmailAudit(): boolean {
    return parseBooleanFlag(process.env.FEATURE_POSTS_PUBLIC_EMAIL_AUDIT, false)
  },

  /**
   * 是否隐藏公开文章 API 中作者的 email 字段，默认开启，确保数据脱敏
   */
  postsPublicHideAuthorEmail(): boolean {
    return parseBooleanFlag(process.env.FEATURE_POSTS_PUBLIC_HIDE_AUTHOR_EMAIL, true)
  },

  /**
   * 参数监控模式：记录异常参数但不强制拒绝（默认开启用于灰度观测）
   */
  postsPublicParamMonitor(): boolean {
    return parseBooleanFlag(process.env.FEATURE_POSTS_PUBLIC_PARAM_MONITOR, true)
  },

  /**
   * 参数强制校验：开启后直接拒绝非法参数请求
   */
  postsPublicParamEnforce(): boolean {
    return parseBooleanFlag(process.env.FEATURE_POSTS_PUBLIC_PARAM_ENFORCE, false)
  },

  /**
   * 关注功能严格模式：控制关注系统功能的启用/禁用
   * 默认开启，用于生产环境快速回滚关注功能
   */
  feedFollowingStrict(): boolean {
    return parseBooleanFlag(process.env.FEATURE_FEED_FOLLOWING_STRICT, true)
  },
}

export type FeatureFlag = keyof typeof featureFlags

/**
 * 通用读取函数，方便在测试中动态注入任意 flag
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return featureFlags[flag]()
}
