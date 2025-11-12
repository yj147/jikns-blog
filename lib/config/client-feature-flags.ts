/**
 * Client Feature Flags（服务端读取，传入客户端）
 * 统一在服务端读取环境变量，避免在客户端直接访问 process.env。
 */

import { featureFlags } from "@/lib/config/feature-flags"

export type ClientFeatureFlags = {
  /** 关注功能严格模式 */
  feedFollowingStrict: boolean
}

/**
 * 服务端函数：读取全部前端所需的 Feature Flags。
 * 默认值由服务端 featureFlags 管理，便于灰度与回滚。
 */
export async function getFeatureFlags(): Promise<ClientFeatureFlags> {
  return {
    feedFollowingStrict: featureFlags.feedFollowingStrict(),
  }
}
