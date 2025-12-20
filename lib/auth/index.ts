/**
 * 权限系统统一导出
 * 提供完整的权限管理功能模块
 */

// 权限验证核心函数
export {
  requireAuth,
  requireAdmin,
  checkUserStatus,
  canAccessResource,
  getUserPermissions,
  withAuth,
  withAdminAuth,
  batchPermissionCheck,
  createPermissionError,
  validateApiPermissions,
} from "@/lib/permissions"

// API 权限守卫
export {
  withApiAuth,
  withServerActionAuth,
  withRateLimit,
  withCORS,
  withApiMiddleware,
  createSuccessResponse,
  createErrorResponse,
  batchPermissionCheck as apiBatchPermissionCheck,
} from "@/lib/api-guards"

// 安全工具
export {
  setSecurityHeaders,
  validateRequestOrigin,
  RateLimiter,
  CSRFProtection,
  SessionSecurity,
  XSSProtection,
  generateCSPHeader,
  CSP_DIRECTIVES,
} from "@/lib/security"

// 认证相关
export { getCurrentUser, getUserSession } from "@/lib/auth"

// 类型定义
export type { PermissionLevel, ApiResponse, BatchPermissionResult } from "@/lib/api-guards"

export type { User } from "@/lib/generated/prisma"
