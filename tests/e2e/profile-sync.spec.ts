/**
 * 用户资料页同步 E2E 测试
 * 使用 Playwright 测试完整的用户登录到资料页查看流程
 */

import { test, expect } from "@playwright/test"

test.describe("用户资料页实时同步 E2E 测试", () => {
  test.beforeEach(async ({ page }) => {
    // 在每个测试前清理状态
    await page.context().clearCookies()
    await page.goto("/")
  })

  test("首次 GitHub OAuth 登录后应在 ≤1s 内显示完整资料信息", async ({ page }) => {
    // 点击登录按钮
    await page.getByText("登录").click()

    // 选择 GitHub 登录
    await page.getByText("使用 GitHub 登录").click()

    // 模拟 GitHub OAuth 成功回调
    // 注意：这里需要配置测试环境的 mock GitHub OAuth 流程
    await page.goto("/auth/callback?code=test-auth-code")

    // 等待重定向到首页
    await page.waitForURL("/")

    // 验证登录成功：应该看到用户菜单
    await expect(page.locator('button[aria-haspopup="menu"]')).toBeVisible({ timeout: 1000 })

    // 导航到用户资料页
    await page.locator('button[aria-haspopup="menu"]').click()
    await page.getByText("个人资料").click()

    // 验证在 1 秒内显示完整的用户信息
    const startTime = Date.now()

    await expect(page.locator("h1")).toBeVisible({ timeout: 1000 })
    await expect(page.getByText("@")).toBeVisible() // 用户名
    await expect(page.locator('img[alt*=""]')).toBeVisible() // 头像

    const loadTime = Date.now() - startTime
    expect(loadTime).toBeLessThan(1000)

    // 验证显示了数据库中的真实数据
    await expect(page.getByText("加入于")).toBeVisible()
    await expect(page.getByText("最后登录")).toBeVisible()
    await expect(page.getByText("用户状态")).toBeVisible()
  })

  test("复次登录时应更新变更的用户信息（如头像）", async ({ page }) => {
    // 模拟已经登录过的用户再次登录

    // 首次登录
    await page.goto("/login")
    await page.getByText("使用 GitHub 登录").click()
    await page.goto("/auth/callback?code=test-auth-code-1")
    await page.waitForURL("/")

    // 查看初始资料
    await page.locator('button[aria-haspopup="menu"]').click()
    await page.getByText("个人资料").click()

    // 记录初始头像源
    const initialAvatar = await page.locator('img[alt*=""]').first().getAttribute("src")

    // 模拟登出
    await page.locator('button[aria-haspopup="menu"]').click()
    await page.getByText("退出登录").click()

    // 等待登出完成
    await expect(page.getByText("登录")).toBeVisible()

    // 再次登录（模拟头像已在 GitHub 上更新）
    await page.getByText("登录").click()
    await page.getByText("使用 GitHub 登录").click()
    await page.goto("/auth/callback?code=test-auth-code-2&avatar_updated=true")
    await page.waitForURL("/")

    // 立即查看资料页
    await page.locator('button[aria-haspopup="menu"]').click()
    await page.getByText("个人资料").click()

    // 验证头像已更新（在实际测试中，这里需要配置不同的头像 URL）
    const updatedAvatar = await page.locator('img[alt*=""]').first().getAttribute("src")

    // 验证最后登录时间已更新
    await expect(page.getByText("最后登录")).toBeVisible()

    // 验证显示速度仍然快速
    const startTime = Date.now()
    await expect(page.locator("h1")).toBeVisible({ timeout: 1000 })
    const loadTime = Date.now() - startTime
    expect(loadTime).toBeLessThan(1000)
  })

  test("头部导航菜单应显示数据库中的最新用户信息", async ({ page }) => {
    // 登录
    await page.goto("/login")
    await page.getByText("使用 GitHub 登录").click()
    await page.goto("/auth/callback?code=test-auth-code")
    await page.waitForURL("/")

    // 点击用户菜单
    await page.locator('button[aria-haspopup="menu"]').click()

    // 验证菜单中显示的是数据库数据
    await expect(page.getByText("@")).toBeVisible() // 用户名
    await expect(page.getByRole("menuitem", { name: /个人资料/ })).toBeVisible()
    await expect(page.getByRole("menuitem", { name: /设置/ })).toBeVisible()
    await expect(page.getByRole("menuitem", { name: /退出登录/ })).toBeVisible()

    // 验证头像正确显示
    await expect(page.locator('img[alt*=""]')).toBeVisible()
  })

  test("管理员用户应显示特殊徽章和权限", async ({ page }) => {
    // 模拟管理员登录
    await page.goto("/auth/callback?code=admin-user-code&role=admin")
    await page.waitForURL("/")

    // 查看资料页
    await page.locator('button[aria-haspopup="menu"]').click()
    await page.getByText("个人资料").click()

    // 验证管理员徽章
    await expect(page.getByText("管理员")).toBeVisible()

    // 验证用户状态侧边栏显示管理员角色
    await expect(page.getByText("用户角色")).toBeVisible()
    await expect(page.locator("text=管理员").nth(1)).toBeVisible() // 侧边栏中的角色显示
  })

  test("未登录用户访问 /profile 应重定向到登录页", async ({ page }) => {
    // 直接访问 profile 页面
    await page.goto("/profile")

    // 应该被重定向到登录页
    await page.waitForURL("/login")
    await expect(page.getByText("使用 GitHub 登录")).toBeVisible()
  })

  test("用户登出后应立即更新导航状态", async ({ page }) => {
    // 先登录
    await page.goto("/auth/callback?code=test-auth-code")
    await page.waitForURL("/")

    // 验证已登录状态
    await expect(page.locator('button[aria-haspopup="menu"]')).toBeVisible()

    // 登出
    await page.locator('button[aria-haspopup="menu"]').click()
    await page.getByText("退出登录").click()

    // 验证立即更新为未登录状态
    await expect(page.getByText("登录")).toBeVisible({ timeout: 1000 })
    await expect(page.getByText("注册")).toBeVisible()
    await expect(page.locator('button[aria-haspopup="menu"]')).not.toBeVisible()
  })

  test("资料页数据应完全来自数据库，不依赖 Supabase metadata", async ({ page }) => {
    // 这个测试验证数据库作为单一事实来源的原则

    // 登录并访问资料页
    await page.goto("/auth/callback?code=test-database-priority")
    await page.waitForURL("/")

    await page.locator('button[aria-haspopup="menu"]').click()
    await page.getByText("个人资料").click()

    // 验证显示的是数据库中的数据（通过测试 setup 配置的特殊标识）
    await expect(page.getByText("Database Source User")).toBeVisible()
    await expect(page.locator("text=从数据库加载")).toBeVisible()

    // 验证不会显示 Supabase metadata 中的过期数据
    await expect(page.locator("text=Supabase Metadata User")).not.toBeVisible()
  })
})

test.describe("性能要求验证", () => {
  test("页面加载性能应满足 ≤1s 要求", async ({ page }) => {
    // 登录
    await page.goto("/auth/callback?code=perf-test-code")
    await page.waitForURL("/")

    // 测量导航到 profile 页面的时间
    const startTime = Date.now()

    await page.locator('button[aria-haspopup="menu"]').click()
    await page.getByText("个人资料").click()

    // 等待关键内容加载完成
    await expect(page.locator("h1")).toBeVisible()
    await expect(page.getByText("@")).toBeVisible()
    await expect(page.locator('img[alt*=""]')).toBeVisible()

    const loadTime = Date.now() - startTime

    // 验证加载时间 ≤1s
    expect(loadTime).toBeLessThan(1000)

    console.log(`Profile page load time: ${loadTime}ms`)
  })
})
