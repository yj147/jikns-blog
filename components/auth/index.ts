/**
 * 认证组件统一导出
 * 提供完整的前端权限控制组件
 */

// 权限保护组件
export { ProtectedRoute } from "./protected-route"
export { AdminOnly, useAdminCheck } from "./admin-only"
export { AuthRequired } from "./auth-required"

// 权限检查 Hooks
export {
  usePermissions,
  usePermissionGuard,
  ConditionalPermission,
  MultiPermission,
} from "@/hooks/use-permissions"

// 认证表单组件
export { AuthForm } from "./auth-form"
export { EmailAuthForm } from "./email-auth-form"
export { OAuthStatusHandler, OAuthLoadingIndicator } from "./oauth-handlers"
export { AuthDemo } from "./auth-demo"

// 认证状态监听器
export { default as AuthStateListener } from "../auth-state-listener"

// 类型定义
export type { PermissionState } from "@/hooks/use-permissions"
