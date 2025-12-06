import { chromium, type FullConfig } from "@playwright/test"

/**
 * 全局 E2E 测试环境设置
 * 处理测试前的数据库准备、认证状态等
 */
async function globalSetup(config: FullConfig) {
  console.log("🚀 启动 E2E 测试全局环境设置...")

  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    // 1. 检查开发服务器是否正常运行
    console.log("📡 检查开发服务器连接...")
    // 优先使用项目配置的 baseURL，避免与 Playwright 配置不一致导致连不上服务器
    const baseUrl =
      process.env.PLAYWRIGHT_BASE_URL ||
      config.projects[0]?.use?.baseURL ||
      config.use?.baseURL ||
      config.webServer?.url ||
      "http://localhost:3999"
    const response = await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 15000 })
    if (!response || !response.ok()) {
      throw new Error(`无法访问开发服务器: ${response?.status()} ${response?.statusText()}`)
    }
    await page.waitForSelector("body", { timeout: 10000 })
    console.log("✅ 开发服务器连接正常")

    // 2. 准备测试数据（如果需要）
    console.log("📊 准备测试数据...")
    // TODO: 在这里可以设置测试用户、清理数据库等

    // 3. 设置认证状态（为需要登录的测试准备）
    console.log("🔐 设置测试认证状态...")
    // 保存认证状态到文件，供各个测试使用
    await context.storageState({ path: "tests/e2e/auth-state.json" })

    console.log("✅ E2E 测试全局环境设置完成")
  } catch (error) {
    console.error("❌ E2E 测试全局环境设置失败:", error)
    throw error
  } finally {
    await browser.close()
  }
}

export default globalSetup
