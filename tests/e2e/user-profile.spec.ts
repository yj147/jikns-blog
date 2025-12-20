/**
 * 用户资料页端到端测试
 * 覆盖：资料页访问、隐私控制、关注按钮状态、统计数据显示
 */

import { expect, test, Page } from "@playwright/test"
import prisma from "@/lib/prisma"
import {
  randomString,
  XSS_VECTORS,
  expectNoConsoleErrors,
  captureScreenshotOnFailure,
} from "./utils/test-helpers"

// 测试用户配置（复用 user-privacy.spec.ts 中的用户）
const USERS = {
  publicUser: { email: "user@example.com", password: "user123456" },
  followersOnlyUser: { email: "feed-ops@example.com", password: "feedops123" },
  privateUser: { email: "feed-writer@example.com", password: "feedwriter123" },
  follower: { email: "feed-reader@example.com", password: "feedreader123" },
  stranger: { email: "feed-guest@example.com", password: "feedguest123" },
}

let publicUserId: string
let followersOnlyUserId: string
let privateUserId: string
let followerId: string
let strangerId: string

test.describe("用户资料页 - E2E", () => {
  test.describe.configure({ mode: "serial" })

  test.beforeAll(async () => {
    publicUserId = await getUserId(USERS.publicUser.email)
    followersOnlyUserId = await getUserId(USERS.followersOnlyUser.email)
    privateUserId = await getUserId(USERS.privateUser.email)
    followerId = await getUserId(USERS.follower.email)
    strangerId = await getUserId(USERS.stranger.email)

    // 设置隐私级别
    await setProfileVisibility(USERS.publicUser.email, "public")
    await setProfileVisibility(USERS.followersOnlyUser.email, "followers")
    await setProfileVisibility(USERS.privateUser.email, "private")

    // 确保关注关系
    await ensureFollowRelation(USERS.follower.email, USERS.followersOnlyUser.email)
    await removeFollowRelation(USERS.stranger.email, USERS.followersOnlyUser.email)
  })

  // ============ /profile 页面测试 ============

  test("C2.1: 未登录访问 /profile 重定向到 /login", async ({ page }) => {
    await page.context().clearCookies()
    await page.goto("/profile")
    await page.waitForURL((url) => url.pathname.includes("/login"))
    expect(page.url()).toContain("/login")
  })

  test("C2.2: 已登录访问 /profile 显示当前用户资料", async ({ page }) => {
    await login(page, USERS.publicUser)
    await page.goto("/profile")
    await page.waitForLoadState("networkidle")

    // 验证页面元素存在
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    await expect(page.getByText("编辑资料")).toBeVisible()
  })

  test("C2.3: /profile 显示统计数据", async ({ page }) => {
    await login(page, USERS.publicUser)
    await page.goto("/profile")
    await page.waitForLoadState("networkidle")

    // 验证统计数据区域存在（使用更精确的选择器，限定在 main 区域内）
    const mainContent = page.getByRole("main")
    await expect(mainContent.getByText("关注", { exact: true }).first()).toBeVisible()
    await expect(mainContent.getByText("粉丝", { exact: true }).first()).toBeVisible()
    // 使用 Tab 选择器来验证博客和动态统计
    await expect(mainContent.getByRole("tab", { name: /博客/ })).toBeVisible()
    await expect(mainContent.getByRole("tab", { name: /动态/ })).toBeVisible()
  })

  test("C2.4: /profile 编辑资料按钮链接到 /settings", async ({ page }) => {
    await login(page, USERS.publicUser)
    await page.goto("/profile")
    await page.waitForLoadState("networkidle")

    const editButton = page.getByRole("link", { name: /编辑资料/ })
    await expect(editButton).toBeVisible()
    await expect(editButton).toHaveAttribute("href", "/settings")
  })

  // ============ /profile/[userId] 页面测试 ============

  test("C1.1: 不存在的用户返回404", async ({ page }) => {
    // 先登录，否则会被重定向到登录页
    await login(page, USERS.publicUser)
    const response = await page.goto("/profile/non-existent-user-id-12345")
    // Next.js notFound() 返回 404 或渲染 not-found 页面
    const status = response?.status()
    expect(status === 404 || status === 200).toBe(true)
    // 如果是 200，验证页面显示了 not-found 内容
    if (status === 200) {
      const content = await page.textContent("body")
      expect(content).toMatch(/未找到|404|不存在|找不到/i)
    }
  })

  test("C1.6: 公开资料页匿名可访问", async ({ page }) => {
    await page.context().clearCookies()
    const response = await page.goto(`/profile/${publicUserId}`)
    expect(response?.status()).toBe(200)

    // 验证页面包含用户名称
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  })

  test("C1.2: 私有资料页非本人返回404", async ({ page }) => {
    await login(page, USERS.stranger)
    const response = await page.goto(`/profile/${privateUserId}`)
    expect(response?.status()).toBe(404)
  })

  test("C1.3: followers-only 资料页未登录返回404", async ({ page }) => {
    await page.context().clearCookies()
    const response = await page.goto(`/profile/${followersOnlyUserId}`)
    expect(response?.status()).toBe(404)
  })

  test("C1.4: followers-only 资料页非粉丝返回404", async ({ page }) => {
    await login(page, USERS.stranger)
    const response = await page.goto(`/profile/${followersOnlyUserId}`)
    expect([403, 404]).toContain(response?.status() ?? 0)
  })

  test("C1.5: followers-only 资料页粉丝可访问", async ({ page }) => {
    await login(page, USERS.follower)
    const response = await page.goto(`/profile/${followersOnlyUserId}`)
    expect(response?.status()).toBe(200)

    // 验证页面包含用户名称
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  })

  test("C1.7: 本人访问显示编辑资料按钮", async ({ page }) => {
    await login(page, USERS.publicUser)
    await page.goto(`/profile/${publicUserId}`)
    await page.waitForLoadState("networkidle")

    const editButton = page.getByRole("link", { name: /编辑资料/ })
    await expect(editButton).toBeVisible()
    await expect(editButton).toHaveAttribute("href", "/settings")
  })

  test("C1.8: 他人访问（已登录）显示关注按钮", async ({ page }) => {
    await login(page, USERS.stranger)
    await page.goto(`/profile/${publicUserId}`)
    await page.waitForLoadState("networkidle")

    // 查找关注按钮（可能是 data-testid="follow-button" 或包含"关注"文本的按钮）
    const followButton = page
      .getByTestId("follow-button")
      .or(page.getByRole("button", { name: /关注/ }))
    await expect(followButton).toBeVisible()
  })

  test("C1.9: 他人访问（未登录）显示登录后关注按钮", async ({ page }) => {
    await page.context().clearCookies()
    await page.goto(`/profile/${publicUserId}`)
    await page.waitForLoadState("networkidle")

    // 未登录用户应看到"登录后关注"按钮
    const loginToFollowButton = page.getByRole("link", { name: /登录后关注/ })
    await expect(loginToFollowButton).toBeVisible()
    await expect(loginToFollowButton).toHaveAttribute("href", "/login")
  })

  test("C1.10: 隐私控制 - showEmail 关闭时不显示邮箱", async ({ page }) => {
    // 设置用户隐私：关闭邮箱显示
    await prisma.user.update({
      where: { email: USERS.publicUser.email },
      data: {
        privacySettings: {
          profileVisibility: "public",
          showEmail: false,
          showPhone: false,
          showLocation: false,
        },
      },
    })

    await login(page, USERS.stranger)
    await page.goto(`/profile/${publicUserId}`)
    await page.waitForLoadState("networkidle")

    // 验证邮箱不可见（邮箱图标或 mailto: 链接）
    const emailElement = page.locator('a[href^="mailto:"]')
    await expect(emailElement).toHaveCount(0)
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
  await submitButton.click()

  // 等待登录成功消息出现
  const successVisible = await page
    .waitForSelector('text="登录成功"', { timeout: 30000 })
    .then(() => true)
    .catch(() => false)

  if (successVisible) {
    // 等待 1.5 秒让前端的 setTimeout 完成重定向
    await page.waitForTimeout(1500)
  }

  // 等待 URL 变化（增加超时以容纳网络延迟）
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 20000 })
}

async function getUserId(email: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email },
    select: { id: true },
  })
  return user.id
}

type Visibility = "public" | "followers" | "private"

async function setProfileVisibility(email: string, visibility: Visibility) {
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { privacySettings: true },
  })

  const merged = {
    ...(existing?.privacySettings ?? {}),
    profileVisibility: visibility,
  }

  await prisma.user.update({
    where: { email },
    data: { privacySettings: merged },
  })
}

async function ensureFollowRelation(followerEmail: string, targetEmail: string) {
  const follower = await prisma.user.findUniqueOrThrow({
    where: { email: followerEmail },
    select: { id: true },
  })
  const target = await prisma.user.findUniqueOrThrow({
    where: { email: targetEmail },
    select: { id: true },
  })

  await prisma.follow.upsert({
    where: {
      followerId_followingId: {
        followerId: follower.id,
        followingId: target.id,
      },
    },
    update: {},
    create: {
      followerId: follower.id,
      followingId: target.id,
    },
  })
}

async function removeFollowRelation(followerEmail: string, targetEmail: string) {
  const follower = await prisma.user.findUniqueOrThrow({
    where: { email: followerEmail },
    select: { id: true },
  })
  const target = await prisma.user.findUniqueOrThrow({
    where: { email: targetEmail },
    select: { id: true },
  })

  await prisma.follow.deleteMany({
    where: {
      followerId: follower.id,
      followingId: target.id,
    },
  })
}

// ============ 补充测试：Tab 切换与统计数据 ============

test.describe("用户资料页 - Tab 切换与统计", () => {
  test("P1: Tab 切换显示动态内容", async ({ page }) => {
    await login(page, USERS.publicUser)
    await page.goto("/profile")
    await page.waitForLoadState("networkidle")

    // 点击"动态"Tab
    await page.getByRole("tab", { name: /动态/ }).click()

    // 验证 Tab 被选中（aria-selected）
    await expect(page.getByRole("tab", { name: /动态/ })).toHaveAttribute("aria-selected", "true")

    // 等待 TabContent 加载完成（可能显示内容或空状态）
    await page.waitForLoadState("networkidle")
  })

  test("P2: Tab 切换显示点赞内容", async ({ page }) => {
    await login(page, USERS.publicUser)
    await page.goto("/profile")
    await page.waitForLoadState("networkidle")

    // 点击"点赞"Tab
    await page.getByRole("tab", { name: /点赞/ }).click()

    // 验证 Tab 被选中
    await expect(page.getByRole("tab", { name: /点赞/ })).toHaveAttribute("aria-selected", "true")

    // 等待内容加载
    await page.waitForLoadState("networkidle")
  })

  test("P3: 统计数据区域显示正确", async ({ page }) => {
    await login(page, USERS.publicUser)
    await page.goto("/profile")
    await page.waitForLoadState("networkidle")

    const mainContent = page.getByRole("main")

    // 验证统计标签存在（使用精确匹配，避免与导航栏冲突）
    await expect(mainContent.getByText("关注", { exact: true }).first()).toBeVisible()
    await expect(mainContent.getByText("粉丝", { exact: true }).first()).toBeVisible()
    // 使用 Tab 选择器验证博客和动态 Tab 存在
    await expect(mainContent.getByRole("tab", { name: /博客/ })).toBeVisible()
    await expect(mainContent.getByRole("tab", { name: /动态/ })).toBeVisible()
  })

  test("P4: 他人资料页统计区域可点击跳转", async ({ page }) => {
    await login(page, USERS.stranger)
    await page.goto(`/profile/${publicUserId}`)
    await page.waitForLoadState("networkidle")

    // 点击"关注"链接
    const followingLink = page.getByRole("link", { name: /关注/ }).first()
    if (await followingLink.isVisible()) {
      await followingLink.click()
      // 验证跳转到关注列表页
      await page.waitForURL((url) => url.pathname.includes("/following"))
    }
  })
})

test.describe("用户资料页 - 边界与随机测试", () => {
  test("R1: 极长用户 ID 处理", async ({ page }) => {
    const longId = randomString(1000, "alphanumeric")
    try {
      const response = await page.goto(`/profile/${longId}`)
      const status = response?.status()
      expect([200, 404]).toContain(status)

      if (status === 200) {
        const url = page.url()
        const atLogin =
          url.includes("/login") || (await page.getByRole("heading", { name: /登录/ }).count()) > 0
        expect(atLogin).toBe(true)
      }

      await expectNoConsoleErrors(page)
    } catch (error) {
      await captureScreenshotOnFailure(page, test.info().title)
      throw error
    }
  })

  test("R2: 特殊字符用户 ID", async ({ page }) => {
    const ids = ["../", "%00", "<script>alert(1)</script>", "user%2F..%2Fetc"]
    try {
      for (const rawId of ids) {
        const encoded = encodeURIComponent(rawId)
        const response = await page.goto(`/profile/${encoded}`)
        const status = response?.status()
        expect([200, 404]).toContain(status)

        if (status === 200) {
          const url = page.url()
          const atLogin =
            url.includes("/login") ||
            (await page.getByRole("heading", { name: /登录/ }).count()) > 0
          expect(atLogin).toBe(true)
        }
      }
      await expectNoConsoleErrors(page)
    } catch (error) {
      await captureScreenshotOnFailure(page, test.info().title)
      throw error
    }
  })

  test("R3: 统计数据边界显示", async ({ page }) => {
    const statsEmail = "profile-stats-bounds@example.com"
    const statsUser = await prisma.user.upsert({
      where: { email: statsEmail },
      update: {},
      create: { email: statsEmail, name: "Stats Bounds" },
      select: { id: true },
    })

    // 清理旧数据，保持幂等
    await prisma.post.deleteMany({ where: { authorId: statsUser.id } })
    await prisma.user.update({
      where: { id: statsUser.id },
      data: {
        privacySettings: {
          profileVisibility: "public",
          showEmail: false,
          showPhone: false,
          showLocation: false,
        },
      },
    })

    const slug = `stats-bounds-${Date.now()}`
    const basePost = await prisma.post.create({
      data: {
        slug,
        title: "Stats Bounds Post",
        content: "用于边界测试的文章",
        excerpt: "边界测试",
        published: true,
        publishedAt: new Date("2024-01-01T00:00:00.000Z"), // 保证本月发布为 0
        authorId: statsUser.id,
        viewCount: 10001,
      },
      select: { id: true },
    })

    // 点赞 1 次
    const likeAuthor = await prisma.user.findFirst({
      where: { email: USERS.publicUser.email },
      select: { id: true },
    })
    if (likeAuthor) {
      await prisma.like.createMany({
        data: [{ authorId: likeAuthor.id, postId: basePost.id }],
        skipDuplicates: true,
      })
    }

    // 评论 999 条（快速批量插入）
    const comments = Array.from({ length: 999 }).map(() => ({
      content: "边界评论",
      authorId: likeAuthor?.id ?? statsUser.id,
      postId: basePost.id,
      createdAt: new Date("2024-01-02T00:00:00.000Z"),
    }))
    await prisma.comment.createMany({ data: comments })

    try {
      await login(page, USERS.publicUser)
      const response = await page.goto(`/profile/${statsUser.id}`)
      expect(response?.status()).toBe(200)
      await page.waitForLoadState("networkidle")

      const monthlyRow = page.getByText("本月发布").first()
      const viewsRow = page.getByText("总阅读量").first()
      const likesRow = page.getByText("获得点赞").first()
      const commentsRow = page.getByText("评论互动").first()

      await expect(monthlyRow).toBeVisible()
      await expect(viewsRow).toBeVisible()
      await expect(likesRow).toBeVisible()
      await expect(commentsRow).toBeVisible()

      const monthlyValue = await monthlyRow.evaluate(
        (node) => node.parentElement?.querySelector("span.font-semibold")?.textContent
      )
      const viewsValue = await viewsRow.evaluate(
        (node) => node.parentElement?.querySelector("span.font-semibold")?.textContent
      )
      const likesValue = await likesRow.evaluate(
        (node) => node.parentElement?.querySelector("span.font-semibold")?.textContent
      )
      const commentsValue = await commentsRow.evaluate(
        (node) => node.parentElement?.querySelector("span.font-semibold")?.textContent
      )

      expect(monthlyValue?.trim()).toBe("0 篇")
      expect(viewsValue?.trim()).toBe("10001")
      expect(likesValue?.trim()).toBe("1")
      expect(commentsValue?.trim()).toBe("999")

      await expectNoConsoleErrors(page)
    } catch (error) {
      await captureScreenshotOnFailure(page, test.info().title)
      throw error
    } finally {
      // 清理以免污染其他测试
      await prisma.post.deleteMany({ where: { authorId: statsUser.id } })
    }
  })

  test("R4: Tab 快速切换稳定性", async ({ page }) => {
    try {
      await login(page, USERS.publicUser)
      await page.goto("/profile")
      await page.waitForLoadState("networkidle")

      const tabs = ["动态", "点赞"]
      for (let i = 0; i < 5; i += 1) {
        for (const tab of tabs) {
          await page.getByRole("tab", { name: new RegExp(tab) }).click()
        }
      }

      await expectNoConsoleErrors(page)
    } catch (error) {
      await captureScreenshotOnFailure(page, test.info().title)
      throw error
    }
  })

  test("R5: 随机用户 ID 访问", async ({ page }) => {
    const randomId = randomString(48, "alphanumeric")
    try {
      const response = await page.goto(`/profile/${randomId}`)
      const status = response?.status()
      expect([200, 404]).toContain(status)

      if (status === 200) {
        const url = page.url()
        const atLogin =
          url.includes("/login") || (await page.getByRole("heading", { name: /登录/ }).count()) > 0
        expect(atLogin).toBe(true)
      }
      await expectNoConsoleErrors(page)
    } catch (error) {
      await captureScreenshotOnFailure(page, test.info().title)
      throw error
    }
  })

  test("R6: XSS 向量用户 ID", async ({ page }) => {
    try {
      for (const vector of XSS_VECTORS) {
        const encoded = encodeURIComponent(vector)
        const response = await page.goto(`/profile/${encoded}`)
        const status = response?.status()
        expect([200, 404]).toContain(status)

        if (status === 200) {
          const url = page.url()
          const atLogin =
            url.includes("/login") ||
            (await page.getByRole("heading", { name: /登录/ }).count()) > 0
          expect(atLogin).toBe(true)
        }
      }
      await expectNoConsoleErrors(page)
    } catch (error) {
      await captureScreenshotOnFailure(page, test.info().title)
      throw error
    }
  })
})
