/**
 * 安全工具统一导出 - Phase 4 安全增强
 * 提供企业级安全防护的核心功能模块
 */

// 基础安全工具 (暂时注释掉避免循环引用)
// export {
//   CSRFProtection,
//   XSSProtection,
//   SessionSecurity,
//   RateLimiter,
//   setSecurityHeaders,
//   validateRequestOrigin,
//   generateCSPHeader,
//   CSP_DIRECTIVES
// } from '@/lib/security'

// Phase 4 新增：JWT 安全管理
export { JWTSecurity, TokenRefreshManager, SessionStore } from "./jwt-security"

// Phase 4 新增：安全中间件增强
export { SecurityMiddleware, createSecurityContext, validateSecurityHeaders } from "./middleware"

// Phase 4 新增：XSS 清理增强
export { AdvancedXSSCleaner, ContentValidator, InputSanitizer } from "./xss-cleaner"

// Phase 4 新增：API 安全装饰器
export {
  withApiSecurity,
  withServerActionSecurity,
  createSuccessResponse,
  SecurityConfigs,
  validateBatchApiRequests,
} from "./api-security"

// Phase 4 新增：安全配置管理
export {
  securityConfig,
  defaultSecurityConfig,
  getSecurityConfig,
  pathSecurityConfigs,
  securityHeaders,
  initializeSecurityConfig,
  validateSecurityConfig,
} from "./config"

// 类型定义
export type {
  SecurityContext,
  TokenPayload,
  SessionData,
  SecurityConfig,
  CSRFConfig,
  XSSConfig,
  JWTConfig,
  SecurityHeaders,
  SecurityValidationResult,
  SecurityEvent,
  SecurityEventType,
  RateLimitResult,
  TokenRefreshResult,
  SanitizeOptions,
  ContentValidationRule,
} from "./types"

// 便捷导出：常用安全功能组合
// 注意：需要在所有单独导出之后进行，以避免未定义的引用错误
