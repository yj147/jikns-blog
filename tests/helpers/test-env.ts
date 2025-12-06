/**
 * 测试环境配置管理器
 * 统一管理所有测试环境变量，确保一致性
 */

export const TEST_ENV = {
  // Supabase 配置
  NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",

  // 站点配置
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  APP_URL: "http://localhost:3000",
  RESEND_API_KEY: "test-resend-key",
  EMAIL_FROM: "noreply@example.com",
  NODE_ENV: "test",

  // JWT 配置
  JWT_ACCESS_SECRET: "test-access-secret",
  JWT_REFRESH_SECRET: "test-refresh-secret",
  JWT_ISSUER: "jikns-blog-test",
  JWT_AUDIENCE: "jikns-blog-test",

  // 数据库配置 - 连接到 Supabase 本地实例
  DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",

  // GitHub OAuth (测试用)
  GITHUB_CLIENT_ID: "test-github-client-id",
  GITHUB_CLIENT_SECRET: "test-github-client-secret",
} as const

/**
 * 设置测试环境变量
 * 在测试开始前调用，确保所有环境变量正确设置
 */
export function setupTestEnv(): void {
  Object.entries(TEST_ENV).forEach(([key, value]) => {
    process.env[key] = value
  })
}

/**
 * 清理测试环境变量
 * 在测试结束后调用，避免环境污染
 */
export function cleanupTestEnv(): void {
  Object.keys(TEST_ENV).forEach((key) => {
    delete process.env[key]
  })
}

/**
 * 验证环境变量是否正确设置
 */
export function validateTestEnv(): boolean {
  return Object.entries(TEST_ENV).every(([key, value]) => {
    return process.env[key] === value
  })
}

/**
 * 获取测试环境变量的值
 */
export function getTestEnv<K extends keyof typeof TEST_ENV>(key: K): (typeof TEST_ENV)[K] {
  return TEST_ENV[key]
}
