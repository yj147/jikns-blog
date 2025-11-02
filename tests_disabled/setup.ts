import "@testing-library/jest-dom"
import { beforeAll, afterAll, beforeEach } from "vitest"
import { setupTestDatabase, teardownTestDatabase, cleanTestDatabase } from "./config/test-database"

// 全局测试环境设置
beforeAll(async () => {
  console.log("🔧 正在初始化测试数据库...")
  await setupTestDatabase()
  console.log("✅ 测试数据库初始化完成")
})

afterAll(async () => {
  console.log("🧹 正在清理测试环境...")
  await teardownTestDatabase()
  console.log("✅ 测试环境清理完成")
})

// 每个测试前清理数据库
beforeEach(async () => {
  await cleanTestDatabase()
})

// 设置测试超时时间
import { vi } from "vitest"
vi.setConfig({ testTimeout: 10000 })

// 设置测试环境变量
Object.assign(process.env, {
  NODE_ENV: "test",
  DATABASE_URL_TEST: process.env.DATABASE_URL || "postgresql://test:test@localhost:5432/blog_test",
})

// 禁用控制台日志（测试时保持输出清洁）
if (process.env.VITEST_QUIET !== "false") {
  global.console = {
    ...console,
    log: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
}
