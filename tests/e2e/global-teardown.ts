import { type FullConfig } from "@playwright/test"
import fs from "fs/promises"

/**
 * 全局 E2E 测试环境清理
 * 处理测试后的数据清理、临时文件删除等
 */
async function globalTeardown(config: FullConfig) {
  console.log("🧹 开始 E2E 测试全局环境清理...")

  try {
    // 1. 清理认证状态文件
    console.log("🗑️ 清理临时认证文件...")
    try {
      await fs.unlink("tests/e2e/auth-state.json")
    } catch (error) {
      // 文件可能不存在，忽略错误
    }

    // 2. 清理测试数据（如果有的话）
    console.log("🗑️ 清理测试数据...")
    // TODO: 在这里可以清理测试过程中创建的数据

    // 3. 清理临时文件和目录
    console.log("🗑️ 清理临时文件...")
    // 清理可能的临时下载文件等

    console.log("✅ E2E 测试全局环境清理完成")
  } catch (error) {
    console.error("⚠️ E2E 测试全局环境清理出现问题:", error)
    // 清理失败不应该导致测试失败，只记录警告
  }
}

export default globalTeardown
