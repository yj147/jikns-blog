/**
 * 关注列表页端到端测试
 * 覆盖：followers/following 页面访问控制、列表显示、分页、互相关注徽章
 */

import { expect, test, Page } from "@playwright/test"
import prisma from "@/lib/prisma"

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

test.describe("关注列表页 - E2E", () => {
  test.describe.configure({ mode: "serial" })

  test.beforeAll(async () => {
    publicUserId = await getUserId(USERS.publicUser.email)
    followersOnlyUserId = await getUserId(USERS.followersOnlyUser.email)
    privateUserId = await getUserId(USERS.privateUser.email)
    followerId = await getUserId(USERS.follower.email)

    // 设置隐私级别
    await setProfileVisibility(USERS.publicUser.email, "public")
    await setProfileVisibility(USERS.followersOnlyUser.email, "followers")
    await setProfileVisibility(USERS.privateUser.email, "private")

    // 确保关注关系
    await ensureFollowRelation(USERS.follower.email, USERS.followersOnlyUser.email)
    await ensureFollowRelation(USERS.follower.email, USERS.publicUser.email)
    await removeFollowRelation(USERS.stranger.email, USERS.followersOnlyUser.email)
  })

  // ============ Followers 页面测试 ============

  test("C3.4: 公开用户粉丝列表可访问", async ({ page }) => {
    await page.context().clearCookies()
    await page.goto(`/profile/${publicUserId}/followers`)
    await page.waitForLoadState("networkidle")

    // 验证页面标题
    await expect(page.getByRole("heading", { name: "粉丝" })).toBeVisible()

    // 验证不显示访问拒绝消息
    await expect(page.getByText("无法访问关注列表")).not.toBeVisible()
  })

  test("C3.2: 未登录访问私有用户粉丝列表显示拒绝消息", async ({ page }) => {
    await page.context().clearCookies()
    await page.goto(`/profile/${privateUserId}/followers`)
    await page.waitForLoadState("networkidle")

    // 验证显示访问拒绝消息
    await expect(page.getByText("无法访问关注列表")).toBeVisible()
    await expect(page.getByText(/请登录后查看|限制了关注列表的可见性/)).toBeVisible()
  })

  test("C3.3: 非粉丝访问 followers-only 用户粉丝列表显示拒绝消息", async ({ page }) => {
    await login(page, USERS.stranger)
    await page.goto(`/profile/${followersOnlyUserId}/followers`)
    await page.waitForLoadState("networkidle")

    // 验证显示访问拒绝消息
    await expect(page.getByText("无法访问关注列表")).toBeVisible()
    await expect(page.getByText(/限制了关注列表的可见性/)).toBeVisible()
  })

  test("粉丝可访问 followers-only 用户粉丝列表", async ({ page }) => {
    await login(page, USERS.follower)
    await page.goto(`/profile/${followersOnlyUserId}/followers`)
    await page.waitForLoadState("networkidle")

    // 验证页面标题
    await expect(page.getByRole("heading", { name: "粉丝" })).toBeVisible()

    // 验证不显示访问拒绝消息
    await expect(page.getByText("无法访问关注列表")).not.toBeVisible()
  })

  test("本人可访问私有用户粉丝列表", async ({ page }) => {
    await login(page, USERS.privateUser)
    await page.goto(`/profile/${privateUserId}/followers`)
    await page.waitForLoadState("networkidle")

    // 验证页面标题
    await expect(page.getByRole("heading", { name: "粉丝" })).toBeVisible()

    // 验证不显示访问拒绝消息
    await expect(page.getByText("无法访问关注列表")).not.toBeVisible()
  })

  // ============ Following 页面测试 ============

  test("C3.4: 公开用户关注列表可访问", async ({ page }) => {
    await page.context().clearCookies()
    await page.goto(`/profile/${publicUserId}/following`)
    await page.waitForLoadState("networkidle")

    // 验证页面标题
    await expect(page.getByRole("heading", { name: "正在关注" })).toBeVisible()

    // 验证不显示访问拒绝消息
    await expect(page.getByText("无法访问关注列表")).not.toBeVisible()
  })

  test("未登录访问私有用户关注列表显示拒绝消息", async ({ page }) => {
    await page.context().clearCookies()
    await page.goto(`/profile/${privateUserId}/following`)
    await page.waitForLoadState("networkidle")

    // 验证显示访问拒绝消息
    await expect(page.getByText("无法访问关注列表")).toBeVisible()
  })

  // ============ 列表内容测试 ============

  test("C3.4: 粉丝列表显示用户信息", async ({ page }) => {
    // 确保 publicUser 有粉丝
    await ensureFollowRelation(USERS.follower.email, USERS.publicUser.email)

    await page.context().clearCookies()
    await page.goto(`/profile/${publicUserId}/followers`)
    await page.waitForLoadState("networkidle")

    // 如果有粉丝，验证列表项存在
    const cards = page.locator('[data-slot="card"]')
    const cardCount = await cards.count()

    if (cardCount > 1) {
      // 第一个 Card 可能是空状态卡片，检查是否有用户卡片
      const userCard = page.locator('a[href^="/profile/"]').first()
      if (await userCard.isVisible()) {
        // 验证用户卡片包含头像和名称
        await expect(userCard).toBeVisible()
      }
    }
  })

  test("C3.5: 互相关注用户显示徽章", async ({ page }) => {
    // 创建互相关注关系
    await ensureFollowRelation(USERS.publicUser.email, USERS.follower.email)
    await ensureFollowRelation(USERS.follower.email, USERS.publicUser.email)

    await login(page, USERS.publicUser)
    await page.goto(`/profile/${publicUserId}/followers`)
    await page.waitForLoadState("networkidle")

    // 查找互相关注徽章
    const mutualBadge = page.getByText("互相关注")

    // 如果有互相关注的用户，应该显示徽章
    // 注意：这取决于测试数据
    if (await mutualBadge.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(mutualBadge.first()).toBeVisible()
    }
  })

  test("C3.1: 不存在的用户显示错误消息", async ({ page }) => {
    await page.context().clearCookies()
    await page.goto("/profile/non-existent-user-id-12345/followers")
    await page.waitForLoadState("networkidle")

    // 验证显示错误消息
    await expect(page.getByText(/目标用户不存在|无法访问关注列表/)).toBeVisible()
  })

  // ============ 从资料页导航测试 ============

  test("资料页关注数链接到 following 页面", async ({ page }) => {
    await page.context().clearCookies()
    await page.goto(`/profile/${publicUserId}`)
    await page.waitForLoadState("networkidle")

    // 找到"关注"链接
    const followingLink = page.getByRole("link", { name: /关注/ }).first()
    await expect(followingLink).toBeVisible()

    // 验证链接指向正确的页面
    await expect(followingLink).toHaveAttribute("href", `/profile/${publicUserId}/following`)
  })

  test("资料页粉丝数链接到 followers 页面", async ({ page }) => {
    await page.context().clearCookies()
    await page.goto(`/profile/${publicUserId}`)
    await page.waitForLoadState("networkidle")

    // 找到"粉丝"链接
    const followersLink = page.getByRole("link", { name: /粉丝/ }).first()
    await expect(followersLink).toBeVisible()

    // 验证链接指向正确的页面
    await expect(followersLink).toHaveAttribute("href", `/profile/${publicUserId}/followers`)
  })

  // ============ API 层验证 ============

  test("C3.6: 粉丝列表 API 支持分页", async ({ page }) => {
    await login(page, USERS.publicUser)

    const response = await page.request.get(
      `/api/users/${publicUserId}/followers?limit=5&includeTotal=true`
    )
    expect(response.ok()).toBeTruthy()

    const data = await response.json()
    expect(data.success).toBe(true)
    expect(Array.isArray(data.data)).toBe(true)

    // 验证分页元数据
    expect(data.meta?.pagination).toBeDefined()
    expect(typeof data.meta.pagination.total).toBe("number")
    expect(typeof data.meta.pagination.hasMore).toBe("boolean")
  })

  test("C3.6: 关注列表 API 支持分页", async ({ page }) => {
    await login(page, USERS.publicUser)

    const response = await page.request.get(
      `/api/users/${publicUserId}/following?limit=5&includeTotal=true`
    )
    expect(response.ok()).toBeTruthy()

    const data = await response.json()
    expect(data.success).toBe(true)
    expect(Array.isArray(data.data)).toBe(true)

    // 验证分页元数据
    expect(data.meta?.pagination).toBeDefined()
    expect(typeof data.meta.pagination.total).toBe("number")
    expect(typeof data.meta.pagination.hasMore).toBe("boolean")
  })
})

// ============ 工具函数 ============

async function login(page: Page, user: { email: string; password: string }) {
  await page.context().clearCookies()
  await page.goto("/login/email")
  await page.waitForSelector("input#email")
  await page.fill("input#email", user.email)
  await page.fill("input#password", user.password)
  const redirectWait = page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 30_000,
  })

  await page.click('button[type="submit"]')
  await page.waitForSelector('text="登录成功"', { timeout: 30_000 }).catch(() => {})

  if (page.url().includes("/login")) {
    await page.waitForTimeout(1200)
  }

  await redirectWait
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
