/**
 * 认证模块集成测试入口
 * 运行所有认证相关的测试套件，提供综合的认证功能验证
 */

import { describe, beforeAll, afterAll } from "vitest"
import { setupTestDatabase, teardownTestDatabase } from "../config/test-database"

// 导入所有认证测试套件
import "./github-oauth.test"
import "./email-password.test"
import "./user-sync.test"
import "./auth-state.test"

describe("认证系统集成测试", () => {
  beforeAll(async () => {
    // 初始化测试环境
    await setupTestDatabase()
    console.log("🚀 认证测试环境初始化完成")
  })

  afterAll(async () => {
    // 清理测试环境
    await teardownTestDatabase()
    console.log("🧹 认证测试环境清理完成")
  })

  // 所有具体测试由导入的文件提供
  // 这个文件主要用于统一的环境管理和测试协调
})
