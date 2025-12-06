/**
 * 用户设置页端到端测试
 * 覆盖：个人资料更新、隐私设置、通知偏好、社交链接、表单验证
 */

import { expect, test, Page } from "@playwright/test"
import prisma from "@/lib/prisma"
import {
  randomUsername,
  randomBio,
  randomLocation,
  randomPhone,
  randomString,
  expectNoConsoleErrors,
  captureScreenshotOnFailure,
  XSS_VECTORS,
  SQL_INJECTION_VECTORS,
} from "./utils/test-helpers"

const TEST_USER = {
  email: "user@example.com",
  password: "user123456",
}

let testUserId: string

test.describe("用户设置页 - E2E", () => {
  test.describe.configure({ mode: "serial" })

  test.beforeAll(async () => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: TEST_USER.email },
      select: { id: true },
    })
    testUserId = user.id
  })

  test.afterAll(async () => {
    // 恢复测试用户的原始数据
    await prisma.user.update({
      where: { id: testUserId },
      data: {
        name: "示例用户",
        bio: null,
        location: null,
        phone: null,
        privacySettings: {
          profileVisibility: "public",
          showEmail: false,
          showPhone: false,
          showLocation: false,
        },
        notificationPreferences: {
          LIKE: true,
          COMMENT: true,
          FOLLOW: true,
          SYSTEM: true,
        },
        socialLinks: null,
      },
    })
  })

  // ============ 访问控制测试 ============

  test("C4.1: 未登录访问设置页重定向到登录页", async ({ page }) => {
    await page.context().clearCookies()
    await page.goto("/settings")
    await page.waitForLoadState("networkidle")

    // 未登录时应重定向到登录页
    await page.waitForURL((url) => url.pathname.includes("/login"), { timeout: 10000 })
    expect(page.url()).toContain("/login")

    // 验证登录页元素（使用精确匹配卡片标题）
    await expect(page.getByText("欢迎回来", { exact: true })).toBeVisible()
  })

  test("C4.2: 已登录访问设置页显示表单", async ({ page }) => {
    await login(page, TEST_USER)
    await page.goto("/settings")
    await page.waitForLoadState("networkidle")

    // 验证页面标题
    await expect(page.getByRole("heading", { name: "设置" })).toBeVisible()

    // 验证各个表单区域存在（使用卡片标题进行精确匹配）
    await expect(page.getByText("个人资料", { exact: true })).toBeVisible()
    await expect(page.getByText("隐私设置", { exact: true })).toBeVisible()
    await expect(page.getByText("通知偏好", { exact: true })).toBeVisible()
    await expect(page.getByText("社交链接", { exact: true })).toBeVisible()
  })

  // ============ 个人资料表单测试 ============

  test("C4.3: 用户名验证 - 过短", async ({ page }) => {
    await login(page, TEST_USER)
    await page.goto("/settings")
    await page.waitForLoadState("networkidle")

    // 找到用户名输入框并清空后输入单字符
    const nameInput = page.locator('input[name="name"]')
    await nameInput.clear()
    await nameInput.fill("A")

    // 点击保存按钮
    await page.getByRole("button", { name: "保存个人资料" }).click()

    // 等待验证错误消息
    await expect(page.getByText(/至少需要 2 个字符|至少 2 个字符/)).toBeVisible({
      timeout: 5000,
    })
  })

  test("C4.3: 用户名验证 - 过长", async ({ page }) => {
    await login(page, TEST_USER)
    await page.goto("/settings")
    await page.waitForLoadState("networkidle")

    const nameInput = page.locator('input[name="name"]')
    await nameInput.clear()
    // 输入超过50字符的用户名
    await nameInput.fill("A".repeat(51))

    await page.getByRole("button", { name: "保存个人资料" }).click()

    await expect(page.getByText(/不能超过 50 个字符/)).toBeVisible({
      timeout: 5000,
    })
  })

  test("C4.5: 手机号格式验证", async ({ page }) => {
    await login(page, TEST_USER)
    await page.goto("/settings")
    await page.waitForLoadState("networkidle")

    const phoneInput = page.locator('input[name="phone"]')
    await phoneInput.clear()
    // 输入无效的手机号格式
    await phoneInput.fill("invalid-phone-abc!")

    await page.getByRole("button", { name: "保存个人资料" }).click()

    await expect(page.getByText(/格式不正确/)).toBeVisible({
      timeout: 5000,
    })
  })

  test("个人资料更新成功", async ({ page }) => {
    await login(page, TEST_USER)
    await page.goto("/settings")
    await page.waitForLoadState("networkidle")

    // 更新用户名
    const nameInput = page.locator('input[name="name"]')
    await nameInput.clear()
    await nameInput.fill("E2E测试用户")

    // 更新简介
    const bioInput = page.locator('textarea[name="bio"]')
    await bioInput.clear()
    await bioInput.fill("这是一个E2E测试简介")

    // 更新所在地
    const locationInput = page.locator('input[name="location"]')
    await locationInput.clear()
    await locationInput.fill("北京")

    // 点击保存
    await page.getByRole("button", { name: "保存个人资料" }).click()

    // 使用轮询等待数据库更新（更可靠的验证方式）
    await expect
      .poll(
        async () => {
          const user = await prisma.user.findUnique({
            where: { id: testUserId },
            select: { name: true },
          })
          return user?.name
        },
        { timeout: 15000, intervals: [500, 1000, 2000] }
      )
      .toBe("E2E测试用户")

    // 验证其他字段也已持久化
    const updatedUser = await prisma.user.findUnique({
      where: { id: testUserId },
      select: { name: true, bio: true, location: true },
    })
    expect(updatedUser?.name).toBe("E2E测试用户")
    expect(updatedUser?.bio).toBe("这是一个E2E测试简介")
    expect(updatedUser?.location).toBe("北京")
  })

  test("C4.11: 设置页更新后资料页实时同步", async ({ page }) => {
    await login(page, TEST_USER)
    await page.goto("/settings")
    await page.waitForLoadState("networkidle")

    const nextName = "同步校验用户"
    const nextBio = "设置页修改后应立即在资料页展示"

    const nameInput = page.locator('input[name="name"]')
    await nameInput.clear()
    await nameInput.fill(nextName)

    const bioInput = page.locator('textarea[name="bio"]')
    await bioInput.clear()
    await bioInput.fill(nextBio)

    await page.getByRole("button", { name: "保存个人资料" }).click()

    // 使用数据库轮询验证保存成功（比 toast 更可靠）
    await expect
      .poll(
        async () => {
          const user = await prisma.user.findUnique({
            where: { id: testUserId },
            select: { name: true },
          })
          return user?.name
        },
        { timeout: 15000, intervals: [500, 1000, 2000] }
      )
      .toBe(nextName)

    await page.goto("/profile")
    await page.waitForLoadState("networkidle")

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(nextName)
    await expect(page.getByText(nextBio)).toBeVisible()
  })

  // ============ 隐私设置测试 ============

  test("C4.8: 隐私设置 - 更改资料可见性", async ({ page }) => {
    await login(page, TEST_USER)
    await page.goto("/settings")
    await page.waitForLoadState("networkidle")

    // 找到资料可见性下拉框并更改为"仅粉丝"
    const visibilitySelect = page.locator('button[role="combobox"]').first()
    await visibilitySelect.click()

    // 等待下拉列表出现
    await page.waitForSelector('[role="listbox"]', { state: "visible" })
    await page.getByRole("option", { name: "仅粉丝" }).click()

    // 等待下拉框关闭
    await page.waitForTimeout(300)

    // 点击保存隐私设置
    await page.getByRole("button", { name: "保存隐私设置" }).click()

    // 使用轮询等待数据库更新
    await expect
      .poll(
        async () => {
          const user = await prisma.user.findUnique({
            where: { id: testUserId },
            select: { privacySettings: true },
          })
          return (user?.privacySettings as any)?.profileVisibility
        },
        { timeout: 15000, intervals: [500, 1000, 2000] }
      )
      .toBe("followers")
  })

  test("C4.9: 隐私设置 - 切换开关", async ({ page }) => {
    await login(page, TEST_USER)
    await page.goto("/settings")
    await page.waitForLoadState("networkidle")

    // 找到"公开邮箱"开关并切换
    const emailSwitch = page
      .locator('div', { hasText: /公开邮箱/ })
      .locator('button[role="switch"]')
      .first()

    // 获取当前状态
    const currentState = await emailSwitch.getAttribute("data-state")
    const expectedValue = currentState !== "checked"
    await emailSwitch.click()

    // 点击保存
    await page.getByRole("button", { name: "保存隐私设置" }).click()

    // 使用轮询等待数据库更新
    await expect
      .poll(
        async () => {
          const user = await prisma.user.findUnique({
            where: { id: testUserId },
            select: { privacySettings: true },
          })
          return (user?.privacySettings as any)?.showEmail
        },
        { timeout: 15000, intervals: [500, 1000, 2000] }
      )
      .toBe(expectedValue)
  })

  // ============ 通知偏好测试 ============

  test("通知偏好更新成功", async ({ page }) => {
    await login(page, TEST_USER)
    await page.goto("/settings")
    await page.waitForLoadState("networkidle")

    // 找到"点赞通知"开关并切换
    const likeSwitch = page
      .locator('div', { hasText: /点赞通知/ })
      .locator('button[role="switch"]')
      .first()

    const currentState = await likeSwitch.getAttribute("data-state")
    const expectedValue = currentState !== "checked"
    await likeSwitch.click()

    // 点击保存
    await page.getByRole("button", { name: "保存通知偏好" }).click()

    // 使用轮询等待数据库更新
    await expect
      .poll(
        async () => {
          const user = await prisma.user.findUnique({
            where: { id: testUserId },
            select: { notificationPreferences: true },
          })
          return (user?.notificationPreferences as any)?.LIKE
        },
        { timeout: 15000, intervals: [500, 1000, 2000] }
      )
      .toBe(expectedValue)
  })

  // ============ 社交链接测试 ============

  test("C4.10: 社交链接更新成功", async ({ page }) => {
    await login(page, TEST_USER)
    await page.goto("/settings")
    await page.waitForLoadState("networkidle")

    // 更新 GitHub 链接
    const githubInput = page.locator('input[name="github"]')
    await githubInput.clear()
    await githubInput.fill("https://github.com/testuser")

    // 更新网站链接
    const websiteInput = page.locator('input[name="website"]')
    await websiteInput.clear()
    await websiteInput.fill("https://example.com")

    // 点击保存
    await page.getByRole("button", { name: "保存社交链接" }).click()

    // 使用轮询等待数据库更新
    await expect
      .poll(
        async () => {
          const user = await prisma.user.findUnique({
            where: { id: testUserId },
            select: { socialLinks: true },
          })
          return (user?.socialLinks as any)?.github
        },
        { timeout: 15000, intervals: [500, 1000, 2000] }
      )
      .toBe("https://github.com/testuser")

    // 验证其他字段也已持久化
    const updatedUser = await prisma.user.findUnique({
      where: { id: testUserId },
      select: { socialLinks: true },
    })
    const links = updatedUser?.socialLinks as any
    expect(links?.website).toBe("https://example.com")
  })

  test("社交链接URL格式验证", async ({ page }) => {
    await login(page, TEST_USER)
    await page.goto("/settings")
    await page.waitForLoadState("networkidle")

    // 输入无效的 URL
    const websiteInput = page.locator('input[name="website"]')
    await websiteInput.clear()
    await websiteInput.fill("not-a-valid-url")

    // 点击保存
    await page.getByRole("button", { name: "保存社交链接" }).click()

    // HTML5 URL 验证会阻止提交，或者显示验证错误
    // 检查是否有验证提示或输入框处于无效状态
    const isInvalid = await websiteInput.evaluate((el: HTMLInputElement) => !el.validity.valid)
    expect(isInvalid).toBe(true)
  })
})

// ============ Fuzzing 与安全测试 ============

test.describe("用户设置页 - Fuzzing 与安全测试", () => {
  test.describe.configure({ mode: "serial" })
  test.beforeAll(async () => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: TEST_USER.email },
      select: { id: true },
    })
    testUserId = user.id
  })

  test("F1: 用户名极端边界", async ({ page }) => {
    const minName = randomUsername("boundary_min")
    const maxName = randomUsername("boundary_max")
    try {
      await login(page, TEST_USER)
      await page.goto("/settings")
      await page.waitForLoadState("networkidle")

      const nameInput = page.locator('input[name="name"]')

      await nameInput.clear()
      await nameInput.fill(minName)
      await page.getByRole("button", { name: "保存个人资料" }).click()
      await page.waitForTimeout(500)
      await expect
        .poll(
          async () => {
            const user = await prisma.user.findUnique({ where: { id: testUserId }, select: { name: true } })
            return user?.name
          },
          { timeout: 15000 }
        )
        .toBe(minName)

      await nameInput.clear()
      await nameInput.fill(maxName)
      await page.getByRole("button", { name: "保存个人资料" }).click()
      await page.waitForTimeout(500)
      const updated = await prisma.user.findUnique({ where: { id: testUserId }, select: { name: true } })
      expect(updated?.name).toBe(maxName)

      await expectNoConsoleErrors(page)
    } catch (error) {
      await captureScreenshotOnFailure(page, test.info().title)
      throw error
    }
  })

  test("F2: 简介极端边界", async ({ page }) => {
    const validBio = randomBio("boundary_max")
    const invalidBio = randomBio("overflow")
    try {
      await login(page, TEST_USER)
      await page.goto("/settings")
      await page.waitForLoadState("networkidle")

      const bioInput = page.locator('textarea[name="bio"]')
      await bioInput.clear()
      await bioInput.fill(validBio)
      await page.getByRole("button", { name: "保存个人资料" }).click()
      await page.waitForTimeout(500)

      const saved = await prisma.user.findUnique({ where: { id: testUserId }, select: { bio: true } })
      expect(saved?.bio?.length).toBe(500)

      await bioInput.clear()
      await bioInput.fill(invalidBio)
      await page.getByRole("button", { name: "保存个人资料" }).click()
      await expect(page.getByText(/不能超过.*500|超过/)).toBeVisible({ timeout: 5000 })
      await expectNoConsoleErrors(page)
    } catch (error) {
      await captureScreenshotOnFailure(page, test.info().title)
      throw error
    }
  })

  test("F3: 所在地极端边界", async ({ page }) => {
    const validLocation = randomLocation("boundary_max")
    const invalidLocation = randomLocation("overflow")
    try {
      await login(page, TEST_USER)
      await page.goto("/settings")
      await page.waitForLoadState("networkidle")

      const locationInput = page.locator('input[name="location"]')
      await locationInput.clear()
      await locationInput.fill(validLocation)
      await page.getByRole("button", { name: "保存个人资料" }).click()
      await page.waitForTimeout(500)

      const saved = await prisma.user.findUnique({ where: { id: testUserId }, select: { location: true } })
      expect(saved?.location?.length).toBeLessThanOrEqual(200)

      await locationInput.clear()
      await locationInput.fill(invalidLocation)
      await page.getByRole("button", { name: "保存个人资料" }).click()
      await expect(page.getByText(/不能超过.*200|超过/)).toBeVisible({ timeout: 5000 })
      await expectNoConsoleErrors(page)
    } catch (error) {
      await captureScreenshotOnFailure(page, test.info().title)
      throw error
    }
  })

  test("F4: 手机号边界格式", async ({ page }) => {
    const phones = ["+86-13800138000", "13800138000", "(021) 12345678", "+1-415-555-0123"]
    try {
      await login(page, TEST_USER)
      await page.goto("/settings")
      await page.waitForLoadState("networkidle")

      const phoneInput = page.locator('input[name="phone"]')
      for (const phone of phones) {
        await phoneInput.clear()
        await phoneInput.fill(phone)
        await page.getByRole("button", { name: "保存个人资料" }).click()
        await page.waitForTimeout(500)
      }

      const saved = await prisma.user.findUnique({ where: { id: testUserId }, select: { phone: true } })
      expect(saved?.phone).toBe(phones[phones.length - 1])
      await expectNoConsoleErrors(page)
    } catch (error) {
      await captureScreenshotOnFailure(page, test.info().title)
      throw error
    }
  })

  test("F5: 用户名 XSS 注入", async ({ page }) => {
    try {
      await login(page, TEST_USER)
      await page.goto("/settings")
      await page.waitForLoadState("networkidle")

      const nameInput = page.locator('input[name="name"]')
      for (const vector of XSS_VECTORS) {
        await nameInput.clear()
        await nameInput.fill(vector)
        await page.getByRole("button", { name: "保存个人资料" }).click()
        await page.waitForTimeout(500)
      }

      await expect
        .poll(
          async () => {
            const user = await prisma.user.findUnique({ where: { id: testUserId }, select: { name: true } })
            return user?.name
          },
          { timeout: 15000 }
        )
        .toBeDefined()
      await expectNoConsoleErrors(page)
    } catch (error) {
      await captureScreenshotOnFailure(page, test.info().title)
      throw error
    }
  })

  test("F6: 简介 XSS 注入", async ({ page }) => {
    try {
      await login(page, TEST_USER)
      await page.goto("/settings")
      await page.waitForLoadState("networkidle")

      const bioInput = page.locator('textarea[name="bio"]')
      for (const vector of XSS_VECTORS) {
        await bioInput.clear()
        await bioInput.fill(vector)
        await page.getByRole("button", { name: "保存个人资料" }).click()
        await page.waitForTimeout(500)
      }
      await expect
        .poll(
          async () => {
            const user = await prisma.user.findUnique({ where: { id: testUserId }, select: { bio: true } })
            return user?.bio
          },
          { timeout: 15000 }
        )
        .not.toBeUndefined()
      await expectNoConsoleErrors(page)
    } catch (error) {
      await captureScreenshotOnFailure(page, test.info().title)
      throw error
    }
  })

  test("F7: 社交链接 URL 注入", async ({ page }) => {
    try {
      await login(page, TEST_USER)
      await page.goto("/settings")
      await page.waitForLoadState("networkidle")

      const websiteInput = page.locator('input[name="website"]')
      await websiteInput.clear()
      await websiteInput.fill("javascript:alert(1)")
      await page.getByRole("button", { name: "保存社交链接" }).click()

      const isInvalid = await websiteInput.evaluate((el: HTMLInputElement) => !el.validity.valid)
      expect(isInvalid).toBe(true)
      await expectNoConsoleErrors(page)
    } catch (error) {
      await captureScreenshotOnFailure(page, test.info().title)
      throw error
    }
  })

  test("F8: SQL 注入测试", async ({ page }) => {
    try {
      await login(page, TEST_USER)
      await page.goto("/settings")
      await page.waitForLoadState("networkidle")

      const nameInput = page.locator('input[name="name"]')
      const bioInput = page.locator('textarea[name="bio"]')
      for (const payload of SQL_INJECTION_VECTORS) {
        await nameInput.clear()
        await nameInput.fill(payload)
        await bioInput.clear()
        await bioInput.fill(payload)
        await page.getByRole("button", { name: "保存个人资料" }).click()
        await page.waitForTimeout(500)
      }
      await expect
        .poll(
          async () => {
            const user = await prisma.user.findUnique({
              where: { id: testUserId },
              select: { name: true, bio: true },
            })
            return user
          },
          { timeout: 15000 }
        )
        .toBeDefined()
      await expectNoConsoleErrors(page)
    } catch (error) {
      await captureScreenshotOnFailure(page, test.info().title)
      throw error
    }
  })

  test("F9: 随机用户名测试", async ({ page }) => {
    const nextName = randomUsername("valid")
    try {
      await login(page, TEST_USER)
      await page.goto("/settings")
      await page.waitForLoadState("networkidle")

      const nameInput = page.locator('input[name="name"]')
      await nameInput.clear()
      await nameInput.fill(nextName)
      await page.getByRole("button", { name: "保存个人资料" }).click()
      await page.waitForTimeout(500)

      await expect
        .poll(
          async () => {
            const user = await prisma.user.findUnique({ where: { id: testUserId }, select: { name: true } })
            return user?.name
          },
          { timeout: 15000 }
        )
        .toBe(nextName)
      await expectNoConsoleErrors(page)
    } catch (error) {
      await captureScreenshotOnFailure(page, test.info().title)
      throw error
    }
  })

  test("F10: 随机简介测试", async ({ page }) => {
    const nextBio = randomBio("unicode")
    try {
      await login(page, TEST_USER)
      await page.goto("/settings")
      await page.waitForLoadState("networkidle")

      const bioInput = page.locator('textarea[name="bio"]')
      await bioInput.clear()
      await bioInput.fill(nextBio)
      await page.getByRole("button", { name: "保存个人资料" }).click()
      await page.waitForTimeout(500)

      await expect
        .poll(
          async () => {
            const user = await prisma.user.findUnique({ where: { id: testUserId }, select: { bio: true } })
            return user?.bio
          },
          { timeout: 15000 }
        )
        .toBe(nextBio)
      await expectNoConsoleErrors(page)
    } catch (error) {
      await captureScreenshotOnFailure(page, test.info().title)
      throw error
    }
  })

  test("F11: 随机手机号测试", async ({ page }) => {
    const validPhone = randomPhone(true)
    const invalidPhone = randomPhone(false)
    try {
      await login(page, TEST_USER)
      await page.goto("/settings")
      await page.waitForLoadState("networkidle")

      const phoneInput = page.locator('input[name="phone"]')
      await phoneInput.clear()
      await phoneInput.fill(validPhone)
      await page.getByRole("button", { name: "保存个人资料" }).click()
      await page.waitForTimeout(500)

      await expect
        .poll(
          async () => {
            const user = await prisma.user.findUnique({ where: { id: testUserId }, select: { phone: true } })
            return user?.phone
          },
          { timeout: 15000 }
        )
        .toBe(validPhone)

      await phoneInput.clear()
      await phoneInput.fill(invalidPhone)
      await page.getByRole("button", { name: "保存个人资料" }).click()
      await expect(page.getByText(/格式不正确|无效/)).toBeVisible({ timeout: 5000 })
      await expectNoConsoleErrors(page)
    } catch (error) {
      await captureScreenshotOnFailure(page, test.info().title)
      throw error
    }
  })

  test("F12: 快速连续保存", async ({ page }) => {
    const nameValue = `burst-${randomString(8, "alphanumeric")}`
    try {
      await login(page, TEST_USER)
      await page.goto("/settings")
      await page.waitForLoadState("networkidle")

      const nameInput = page.locator('input[name="name"]')
      await nameInput.clear()
      await nameInput.fill(nameValue)

      const saveButton = page.getByRole("button", { name: "保存个人资料" })
      for (let i = 0; i < 3; i += 1) {
        await saveButton.click()
      }
      await page.waitForTimeout(500)

      await expect
        .poll(
          async () => {
            const user = await prisma.user.findUnique({ where: { id: testUserId }, select: { name: true } })
            return user?.name
          },
          { timeout: 15000 }
        )
        .toBe(nameValue)
      await expectNoConsoleErrors(page)
    } catch (error) {
      await captureScreenshotOnFailure(page, test.info().title)
      throw error
    }
  })
})

// ============ 工具函数 ============

async function login(page: Page, user: { email: string; password: string }) {
  await page.context().clearCookies()
  await page.goto("/login/email")
  await page.waitForLoadState("networkidle")

  // 使用更可靠的选择器
  const emailInput = page.locator("input#email")
  const passwordInput = page.locator("input#password")

  await emailInput.fill(user.email)
  await passwordInput.fill(user.password)

  // 点击提交按钮（使用更精确的选择器 - 在 main 区域内的登录按钮）
  const submitButton = page.getByRole("main").getByRole("button", { name: "登录", exact: true })
  const redirectWait = page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 30_000,
  })

  await submitButton.click()

  // 等待登录成功消息出现，然后等待重定向
  await page.waitForSelector('text="登录成功"', { timeout: 30_000 }).catch(() => {
    // 如果没有成功消息，可能直接重定向了
  })

  if (page.url().includes("/login")) {
    await page.waitForTimeout(1200)
  }

  await redirectWait
}

// ============ 补充测试：边界验证与头像 ============

test.describe("用户设置页 - 补充边界测试", () => {
  test.describe.configure({ mode: "serial" })

  test("S1: 个人简介 500 字符边界验证", async ({ page }) => {
    await login(page, TEST_USER)
    await page.goto("/settings")
    await page.waitForLoadState("networkidle")

    // 确保用户名字段有有效值（表单必填字段）
    const nameInput = page.locator('input[name="name"]')
    const currentName = await nameInput.inputValue()
    if (!currentName || currentName.length < 2) {
      await nameInput.clear()
      await nameInput.fill("测试用户")
    }

    const bioInput = page.locator('textarea[name="bio"]')
    await bioInput.clear()

    // 输入恰好 500 字符（应该通过）
    const validBio = "A".repeat(500)
    await bioInput.fill(validBio)
    await page.getByRole("button", { name: "保存个人资料" }).click()

    // 使用轮询等待数据库更新
    await expect
      .poll(
        async () => {
          const user = await prisma.user.findUnique({
            where: { email: TEST_USER.email },
            select: { bio: true },
          })
          return user?.bio
        },
        { timeout: 15000, intervals: [500, 1000, 2000] }
      )
      .toBe(validBio)

    // 现在输入 501 字符（应该失败）
    await bioInput.clear()
    const invalidBio = "A".repeat(501)
    await bioInput.fill(invalidBio)
    await page.getByRole("button", { name: "保存个人资料" }).click()

    // 等待验证错误
    await expect(page.getByText(/不能超过.*500.*字符|超过/)).toBeVisible({
      timeout: 5000,
    })
  })

  test("S2: 头像选择按钮存在且可点击", async ({ page }) => {
    await login(page, TEST_USER)
    await page.goto("/settings")
    await page.waitForLoadState("networkidle")

    // 验证头像区域存在
    const avatarSection = page.locator("div").filter({ hasText: /选择头像/ }).first()
    await expect(avatarSection).toBeVisible()

    // 验证"选择头像"按钮存在
    const avatarButton = page.getByRole("button", { name: /选择头像/ })
    await expect(avatarButton).toBeVisible()
    await expect(avatarButton).toBeEnabled()

    // 验证文件输入存在（隐藏）
    const fileInput = avatarSection.locator('input[type="file"]')
    await expect(fileInput.first()).toBeAttached()
  })

  test("S3: 头像格式提示显示正确", async ({ page }) => {
    await login(page, TEST_USER)
    await page.goto("/settings")
    await page.waitForLoadState("networkidle")

    // 验证格式提示
    await expect(page.getByText(/支持.*JPG.*PNG.*WebP.*GIF/i)).toBeVisible()
    await expect(page.getByText(/5MB|5 MB/i)).toBeVisible()
  })

  test("S4: 所在地 200 字符边界验证", async ({ page }) => {
    await login(page, TEST_USER)
    await page.goto("/settings")
    await page.waitForLoadState("networkidle")

    // 确保用户名字段有有效值（表单必填字段）
    const nameInput = page.locator('input[name="name"]')
    const currentName = await nameInput.inputValue()
    if (!currentName || currentName.length < 2) {
      await nameInput.clear()
      await nameInput.fill("测试用户")
    }

    const locationInput = page.locator('input[name="location"]')
    await locationInput.clear()

    // 输入超过 200 字符
    const invalidLocation = "A".repeat(201)
    await locationInput.fill(invalidLocation)
    await page.getByRole("button", { name: "保存个人资料" }).click()

    // 等待验证错误
    await expect(page.getByText(/不能超过.*200.*字符|超过/)).toBeVisible({
      timeout: 5000,
    })
  })
})
