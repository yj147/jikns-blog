/**
 * 评论功能端到端测试
 * 测试流程：登录 → 发动态 → 评论 → 回复 → 删除 → 注销
 */

import { test, expect } from "@playwright/test"

// 测试用户凭据
const testUser = {
  email: "test@example.com",
  password: "Test123456!",
  name: "Test User",
}

// 辅助函数：登录
async function login(page: any, email: string, password: string) {
  await page.goto("/login/email")
  await page.fill("input#email", email)
  await page.fill("input#password", password)
  await page.click('button[type="submit"]')
  await page.waitForURL("/")
}

// 辅助函数：注销
async function logout(page: any) {
  await page.click('[data-testid="user-menu"]')
  await page.click("text=退出登录")
  await page.waitForURL("/")
}

test.describe("评论系统端到端测试", () => {
  test.beforeEach(async ({ page }) => {
    // 设置测试超时
    test.setTimeout(60000)
  })

  test("完整评论流程测试", async ({ page }) => {
    // 步骤 1: 登录
    await login(page, testUser.email, testUser.password)

    // 验证登录成功
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()

    // 步骤 2: 发布动态
    await page.goto("/feed")

    // 填写动态内容
    const activityContent = `测试动态 ${Date.now()}`
    await page.fill('textarea[placeholder*="分享你的想法"]', activityContent)
    await page.click('button:has-text("发布")')

    // 等待动态发布成功
    await page.waitForSelector(`text=${activityContent}`)

    // 步骤 3: 发表评论
    const commentContent = `测试评论 ${Date.now()}`
    await page.fill('textarea[placeholder*="写下你的评论"]', commentContent)
    await page.click('button:has-text("发表评论")')

    // 验证评论显示
    await expect(page.locator(`text=${commentContent}`)).toBeVisible()

    // 步骤 4: 回复评论
    await page.click('button:has-text("回复"):first')

    const replyContent = `测试回复 ${Date.now()}`
    await page.fill('textarea[placeholder*="回复"]', replyContent)
    await page.click('button:has-text("发表评论")')

    // 验证回复显示
    await expect(page.locator(`text=${replyContent}`)).toBeVisible()

    // 步骤 5: 删除评论
    // 找到删除按钮并点击（直接删除，无确认弹窗）
    const deleteButton = page.locator('button[aria-label="删除"]').first()
    await deleteButton.click()

    // 等待删除完成
    await page.waitForTimeout(1000)

    // 验证评论已删除
    await expect(page.locator(`text=${replyContent}`)).not.toBeVisible()

    // 步骤 6: 注销
    await logout(page)

    // 验证注销成功
    await expect(page.locator('[data-testid="login-button"]')).toBeVisible()
  })

  test("未登录用户评论限制", async ({ page }) => {
    // 访问动态页面
    await page.goto("/feed")

    // 验证显示登录提示
    await expect(page.locator("text=登录后即可发表评论")).toBeVisible()
    await expect(page.locator('button:has-text("立即登录")')).toBeVisible()

    // 点击登录按钮应跳转到登录页
    await page.click('button:has-text("立即登录")')
    await expect(page).toHaveURL("/login")
  })

  test("文章评论功能", async ({ page }) => {
    // 登录
    await login(page, testUser.email, testUser.password)

    // 访问文章列表
    await page.goto("/blog")

    // 点击第一篇文章
    await page.click("article:first-child a")

    // 等待文章加载
    await page.waitForSelector("h1")

    // 发表评论
    const commentContent = `文章评论测试 ${Date.now()}`
    await page.fill('textarea[placeholder*="写下你的评论"]', commentContent)
    await page.click('button:has-text("发表评论")')

    // 验证评论显示
    await expect(page.locator(`text=${commentContent}`)).toBeVisible()
  })

  test("评论字数限制", async ({ page }) => {
    // 登录
    await login(page, testUser.email, testUser.password)

    // 访问动态页面
    await page.goto("/feed")

    // 输入超长评论
    const longComment = "a".repeat(1001)
    await page.fill('textarea[placeholder*="写下你的评论"]', longComment)

    // 验证字数统计显示红色
    const charCount = page.locator("text=/1001 \\/ 1000/")
    await expect(charCount).toHaveClass(/text-red-500/)

    // 验证提交按钮被禁用
    const submitButton = page.locator('button:has-text("发表评论")')
    await expect(submitButton).toBeDisabled()
  })

  test("评论错误处理", async ({ page }) => {
    // 登录
    await login(page, testUser.email, testUser.password)

    // 访问动态页面
    await page.goto("/feed")

    // 模拟网络错误
    await page.route("/api/comments", (route) => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: "服务器错误" }),
      })
    })

    // 尝试发表评论
    await page.fill('textarea[placeholder*="写下你的评论"]', "测试评论")
    await page.click('button:has-text("发表评论")')

    // 验证显示错误提示
    await expect(page.locator("text=服务器错误，请稍后重试")).toBeVisible()
  })

  test("评论权限控制", async ({ page }) => {
    // 创建两个用户的测试场景
    const user1 = { email: "user1@example.com", password: "User1Pass!" }
    const user2 = { email: "user2@example.com", password: "User2Pass!" }

    // User1 登录并发表评论
    await login(page, user1.email, user1.password)
    await page.goto("/feed")

    const commentContent = `User1的评论 ${Date.now()}`
    await page.fill('textarea[placeholder*="写下你的评论"]', commentContent)
    await page.click('button:has-text("发表评论")')

    // 验证 User1 可以看到自己评论的删除按钮
    const deleteButton = page.locator('button[aria-label="删除"]').first()
    await expect(deleteButton).toBeVisible()

    // 注销并切换到 User2
    await logout(page)
    await login(page, user2.email, user2.password)
    await page.goto("/feed")

    // 验证 User2 看不到 User1 评论的删除按钮
    await expect(deleteButton).not.toBeVisible()
  })

  // 移除分页加载测试，因为当前未实现分页功能
  // test('评论分页加载', async ({ page }) => {
  //   注意：分页功能暂未实现
  // });

  test("评论跨页面同步（手动刷新）", async ({ page, context }) => {
    // 在两个标签页中测试评论同步（需要手动刷新）
    const page1 = page
    const page2 = await context.newPage()

    // 两个页面都登录
    await login(page1, testUser.email, testUser.password)
    await login(page2, testUser.email, testUser.password)

    // 都访问同一个动态
    await page1.goto("/feed")
    await page2.goto("/feed")

    // 在 page1 发表评论
    const commentContent = `实时更新测试 ${Date.now()}`
    await page1.fill('textarea[placeholder*="写下你的评论"]', commentContent)
    await page1.click('button:has-text("发表评论")')

    // 验证 page1 显示评论
    await expect(page1.locator(`text=${commentContent}`)).toBeVisible()

    // 刷新 page2 并验证评论也显示
    await page2.reload()
    await expect(page2.locator(`text=${commentContent}`)).toBeVisible()

    await page2.close()
  })
})
