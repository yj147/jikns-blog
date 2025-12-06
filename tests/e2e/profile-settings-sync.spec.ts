/**
 * Profile↔Settings 数据一致性专项 E2E
 * 覆盖：社交链接同步、隐私联动、保存失败回退
 */

import { expect, test, Page } from "@playwright/test"
import prisma from "@/lib/prisma"

const SETTINGS_USER = { email: "feed-analyst@example.com", password: "feedanalyst123" }
const VIEWER_USER = { email: "feed-guest@example.com", password: "feedguest123" }

const BASELINE_NAME = "同步基线用户"
const BASELINE_BIO = "E2E 基线简介"
const BASELINE_LOCATION = "上海"
const BASELINE_PHONE = "+86 138 0000 0003"

let settingsUserId: string
let originalProfile: {
  name: string | null
  bio: string | null
  location: string | null
  phone: string | null
  privacySettings: Record<string, unknown> | null
  socialLinks: Record<string, string> | null
} = {
  name: null,
  bio: null,
  location: null,
  phone: null,
  privacySettings: null,
  socialLinks: null,
}

test.describe("Profile↔Settings 数据一致性", () => {
  test.describe.configure({ mode: "serial" })

  test.beforeAll(async () => {
    const settingsUser = await prisma.user.findUniqueOrThrow({
      where: { email: SETTINGS_USER.email },
      select: {
        id: true,
        name: true,
        bio: true,
        location: true,
        phone: true,
        privacySettings: true,
        socialLinks: true,
      },
    })

    settingsUserId = settingsUser.id
    originalProfile = {
      name: settingsUser.name,
      bio: settingsUser.bio,
      location: settingsUser.location,
      phone: settingsUser.phone,
      privacySettings: (settingsUser.privacySettings as Record<string, unknown> | null) ?? null,
      socialLinks: (settingsUser.socialLinks as Record<string, string> | null) ?? null,
    }

    const viewerUser = await prisma.user.findUniqueOrThrow({
      where: { email: VIEWER_USER.email },
      select: { id: true },
    })
    if (!viewerUser.id) {
      throw new Error("viewer user not seeded")
    }

    await prisma.user.update({
      where: { id: settingsUserId },
      data: {
        name: BASELINE_NAME,
        bio: BASELINE_BIO,
        location: BASELINE_LOCATION,
        phone: BASELINE_PHONE,
        privacySettings: {
          profileVisibility: "public",
          showEmail: false,
          showPhone: false,
          showLocation: false,
        },
        socialLinks: null,
      },
    })
  })

  test.afterAll(async () => {
    await prisma.user.update({
      where: { id: settingsUserId },
      data: {
        name: originalProfile.name ?? "数据分析师",
        bio: originalProfile.bio,
        location: originalProfile.location,
        phone: originalProfile.phone,
        privacySettings: originalProfile.privacySettings ?? null,
        socialLinks: originalProfile.socialLinks ?? null,
      },
    })
  })

  test("社交链接更新后 Profile 渲染正确", async ({ page }) => {
    const website = "https://sync.example.com"
    const github = "https://github.com/sync-e2e"
    const twitter = "https://twitter.com/sync-e2e"

    await login(page, SETTINGS_USER)
    await page.goto("/settings")
    await page.waitForLoadState("networkidle")

    await page.locator('input[name="website"]').fill(website)
    await page.locator('input[name="github"]').fill(github)
    await page.locator('input[name="twitter"]').fill(twitter)

    await page.getByRole("button", { name: "保存社交链接" }).click()
    await expect(page.getByText("社交链接已保存")).toBeVisible({ timeout: 10000 })

    await page.goto(`/profile/${settingsUserId}`)
    await page.waitForLoadState("networkidle")

    await expect(page.locator(`a[href="${website}"]`).first()).toBeVisible()
    await expect(page.locator(`a[href="${github}"]`).first()).toBeVisible()
    await expect(page.locator(`a[href="${twitter}"]`).first()).toBeVisible()
  })

  test("隐私设置联动：显示与隐藏邮箱/电话/位置", async ({ page }) => {
    await login(page, SETTINGS_USER)
    await page.goto("/settings")
    await page.waitForLoadState("networkidle")

    await page.locator('input[name="location"]').fill(BASELINE_LOCATION)
    await page.locator('input[name="phone"]').fill(BASELINE_PHONE)

    await setSwitchState(page, /公开邮箱/, true)
    await setSwitchState(page, /公开手机号/, true)
    await setSwitchState(page, /公开所在地/, true)

    await page.getByRole("button", { name: "保存隐私设置" }).click()
    await expect(page.getByText("隐私设置已保存")).toBeVisible({ timeout: 10000 })

    await clearAuthState(page)
    await login(page, VIEWER_USER)
    await page.goto(`/profile/${settingsUserId}`)
    await page.waitForLoadState("networkidle")

    await expect(page.locator('a[href^="mailto:"]').first()).toBeVisible()
    await expect(page.getByText(BASELINE_PHONE)).toBeVisible()
    await expect(page.getByText(BASELINE_LOCATION)).toBeVisible()

    await clearAuthState(page)
    await login(page, SETTINGS_USER)
    await page.goto("/settings")
    await page.waitForLoadState("networkidle")

    await setSwitchState(page, /公开邮箱/, false)
    await setSwitchState(page, /公开手机号/, false)
    await setSwitchState(page, /公开所在地/, false)

    await page.getByRole("button", { name: "保存隐私设置" }).click()
    await expect(page.getByText("隐私设置已保存")).toBeVisible({ timeout: 10000 })

    await clearAuthState(page)
    await login(page, VIEWER_USER)
    await page.goto(`/profile/${settingsUserId}`)
    await page.waitForLoadState("networkidle")

    await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0)
    await expect(page.getByText(BASELINE_PHONE)).toHaveCount(0)
    await expect(page.getByText(BASELINE_LOCATION)).toHaveCount(0)
  })

  test("保存失败时提示并回退", async ({ page }) => {
    await login(page, SETTINGS_USER)
    await page.goto("/settings")
    await page.waitForLoadState("networkidle")

    await page.locator('input[name="name"]').fill("回退校验用户")

    await clearAuthState(page)

    await page.getByRole("button", { name: "保存个人资料" }).click()

    await expect(page.getByText(/请先登录|用户未登录/)).toBeVisible({ timeout: 10000 })

    await expect
      .poll(
        async () => {
          const user = await prisma.user.findUnique({
            where: { id: settingsUserId },
            select: { name: true },
          })
          return user?.name
        },
        { timeout: 10000, intervals: [500, 1000, 2000] }
      )
      .toBe(BASELINE_NAME)
  })
})

async function login(page: Page, user: { email: string; password: string }) {
  await clearAuthState(page)
  await page.goto("/login/email")
  await page.waitForLoadState("networkidle")

  await page.locator("input#email").fill(user.email)
  await page.locator("input#password").fill(user.password)

  await page.getByRole("main").getByRole("button", { name: "登录", exact: true }).click()

  await page.waitForSelector('text="登录成功"', { timeout: 30000 }).catch(() => {})
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 })
}

async function clearAuthState(page: Page) {
  await page.context().clearCookies()
  try {
    // about:blank 环境会抛 SecurityError，需要先切回站点域名
    if (page.url() === "about:blank") {
      await page.goto("/")
    }
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
  } catch {
    // 如果仍然因为跨域限制失败，忽略清理错误，避免阻塞后续用例
  }
}

async function setSwitchState(page: Page, labelPattern: RegExp, targetChecked: boolean) {
  const switchButton = page
    .locator("div", { hasText: labelPattern })
    .locator('button[role="switch"]')
    .first()

  const currentState = await switchButton.getAttribute("data-state")
  const isChecked = currentState === "checked"

  if (isChecked !== targetChecked) {
    await switchButton.click()
  }
}
