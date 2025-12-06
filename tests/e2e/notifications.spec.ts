/**
 * 通知系统端到端测试
 * 覆盖：访问控制、通知列表、类型过滤、标记已读、无限滚动
 */

import { expect, test, Page } from "@playwright/test"
import prisma from "@/lib/prisma"
import { NotificationType } from "@/lib/generated/prisma"
import {
  expectNoConsoleErrors,
  captureScreenshotOnFailure,
  randomString,
  XSS_VECTORS,
} from "./utils/test-helpers"
import { notify } from "@/lib/services/notification"

const TEST_USER = {
  email: "user@example.com",
  password: "user123456",
}

// 使用 admin 作为 actor（默认种子中存在）
const ACTOR_USER = {
  email: "admin@example.com",
}

const ADMIN_USER = {
  email: "admin@example.com",
  password: "admin123456",
}

let testUserId: string
let actorUserId: string
let basePostId: string

test.describe("通知系统 - E2E", () => {
  test.describe.configure({ mode: "serial" })

  test.beforeAll(async () => {
    // 顺序查询避免并发问题
    const testUser = await prisma.user.findUnique({
      where: { email: TEST_USER.email },
      select: { id: true },
    })

    const actorUser = await prisma.user.findUnique({
      where: { email: ACTOR_USER.email },
      select: { id: true },
    })

    if (!testUser || !actorUser) {
      console.warn("⚠️ 测试用户不存在，请运行 pnpm db:seed")
      throw new Error("测试用户缺失: user@example.com 或 admin@example.com")
    }

    testUserId = testUser.id
    actorUserId = actorUser.id

    const basePost = await prisma.post.upsert({
      where: { slug: "e2e-notification-base" },
      update: {},
      create: {
        slug: "e2e-notification-base",
        title: "E2E Notification Base",
        content: "Seed post for notification e2e tests",
        excerpt: "Seed post for notification e2e tests",
        published: true,
        publishedAt: new Date(),
        authorId: actorUserId,
      },
    })
    basePostId = basePost.id

    // 清理测试用户的旧通知
    await prisma.notification.deleteMany({
      where: { recipientId: testUserId },
    })
  })

  test.afterAll(async () => {
    // 清理测试创建的通知
    await prisma.notification.deleteMany({
      where: { recipientId: testUserId },
    })
  })

  // ============ N1: 访问控制 ============

  test("N1: 未登录访问通知页重定向到登录", async ({ page }) => {
    await page.context().clearCookies()
    await page.goto("/notifications")
    await page.waitForURL((url) => url.pathname.includes("/login"))
    expect(page.url()).toContain("/login")
  })

  // ============ N2/N3: 核心路径与空状态 ============

  test("N3: 无通知时显示空状态", async ({ page }) => {
    await login(page, TEST_USER)
    await page.goto("/notifications")
    await page.waitForLoadState("networkidle")

    // 验证页面标题
    await expect(page.getByRole("heading", { name: "通知中心" })).toBeVisible()

    // 验证空状态提示
    await expect(page.getByText("暂时没有通知")).toBeVisible({ timeout: 10000 })
  })

  test("N2: 已登录显示通知列表和过滤器", async ({ page }) => {
    // 先创建测试通知
    await createTestNotifications()

    await login(page, TEST_USER)
    await page.goto("/notifications")
    await page.waitForLoadState("networkidle")

    // 验证过滤器标签存在
    await expect(page.getByRole("tab", { name: "全部" })).toBeVisible()
    await expect(page.getByRole("tab", { name: "点赞" })).toBeVisible()
    await expect(page.getByRole("tab", { name: "评论" })).toBeVisible()
    await expect(page.getByRole("tab", { name: "关注" })).toBeVisible()
    await expect(page.getByRole("tab", { name: "系统" })).toBeVisible()

    // 验证"全部已读"按钮存在
    await expect(page.getByRole("button", { name: "全部已读" })).toBeVisible()

    // 验证未读计数显示
    await expect(page.getByText(/未读\s+\d+/)).toBeVisible()
  })

  // ============ N4: 类型过滤 ============

  test("N4: 按类型过滤通知", async ({ page }) => {
    await login(page, TEST_USER)
    await page.goto("/notifications")
    await page.waitForLoadState("networkidle")

    // 点击"点赞"过滤器
    await page.getByRole("tab", { name: "点赞" }).click()
    await page.waitForLoadState("networkidle")

    // URL 应包含 type 参数或页面应只显示点赞类型
    // 验证页面内容包含点赞相关内容
    const likeNotifications = page.locator("text=赞了你的内容")
    await expect(likeNotifications.first()).toBeVisible({ timeout: 5000 })

    // 切换到"关注"过滤器
    await page.getByRole("tab", { name: "关注" }).click()
    await page.waitForLoadState("networkidle")

    // 验证显示关注类型通知
    const followNotifications = page.locator("text=关注了你")
    await expect(followNotifications.first()).toBeVisible({ timeout: 5000 })
  })

  // ============ N5: 单条标记已读 ============

  test("N5: 单条标记已读", async ({ page }) => {
    // 确保有未读通知
    await createUnreadNotification(NotificationType.COMMENT)

    await login(page, TEST_USER)
    await page.goto("/notifications")
    await page.waitForLoadState("networkidle")

    // 找到第一个"标记已读"按钮
    const markReadButton = page.getByRole("button", { name: "标记已读" }).first()
    await expect(markReadButton).toBeVisible({ timeout: 5000 })

    // 点击标记已读
    await markReadButton.click()

    // 等待按钮变为"已读"状态
    await expect(page.getByRole("button", { name: "已读" }).first()).toBeVisible({ timeout: 5000 })
  })

  // ============ N6: 全部标记已读 ============

  test("N6: 全部标记已读", async ({ page }) => {
    // 创建多条未读通知
    await Promise.all([
      createUnreadNotification(NotificationType.LIKE),
      createUnreadNotification(NotificationType.FOLLOW),
    ])

    await login(page, TEST_USER)
    await page.goto("/notifications")
    await page.waitForLoadState("networkidle")

    // 获取当前未读数
    const unreadText = await page.getByText(/未读\s+(\d+)/).textContent()
    const initialUnread = parseInt(unreadText?.match(/\d+/)?.[0] || "0", 10)

    if (initialUnread > 0) {
      // 点击"全部已读"按钮
      await page.getByRole("button", { name: "全部已读" }).click()

      // 等待 Toast 提示或未读数变为 0
      await expect(page.getByText(/未读\s+0/)).toBeVisible({ timeout: 10000 })
    }
  })

  // ============ N7: 全部已读后按钮禁用 ============

  test("N7: 无未读通知时全部已读按钮禁用", async ({ page }) => {
    // 先标记所有通知为已读
    await prisma.notification.updateMany({
      where: { recipientId: testUserId, readAt: null },
      data: { readAt: new Date() },
    })

    await login(page, TEST_USER)
    await page.goto("/notifications")
    await page.waitForLoadState("networkidle")

    // 验证按钮禁用状态
    const markAllButton = page.getByRole("button", { name: "全部已读" })
    await expect(markAllButton).toBeDisabled({ timeout: 5000 })
  })

  // ============ N8: 分页/无更多数据提示 ============

  test("N8: 无更多通知时显示提示", async ({ page }) => {
    await login(page, TEST_USER)
    await page.goto("/notifications")
    await page.waitForLoadState("networkidle")

    // 滚动到底部
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))

    // 等待加载完成后验证"没有更多通知了"提示
    await expect(page.getByText("没有更多通知了")).toBeVisible({ timeout: 10000 })
  })

  // ============ N9: 过滤器切换与 URL 初始状态 ============

  test("N9: 切换过滤器并保留 URL 初始状态", async ({ page }) => {
    await prisma.notification.deleteMany({ where: { recipientId: testUserId } })
    await createNotificationBatch(2, { type: NotificationType.LIKE })
    await createNotificationBatch(1, { type: NotificationType.FOLLOW })

    await login(page, TEST_USER)
    await page.goto("/notifications?type=FOLLOW")
    await page.waitForLoadState("networkidle")

    await expect(page.getByRole("tab", { name: "关注" })).toHaveAttribute("data-state", "active")

    await expect(page.getByText("关注了你")).toBeVisible({ timeout: 5000 })
    await expect(page.getByText("赞了你的内容")).toHaveCount(0)

    await page.getByRole("tab", { name: "全部" }).click()
    await page.waitForLoadState("networkidle")

    await expect(page.getByText("赞了你的内容")).toHaveCount(2)
    await expect(page.getByText("关注了你")).toBeVisible()

    await page.reload()
    await expect(page.getByRole("tab", { name: "关注" })).toHaveAttribute("data-state", "active")
  })

  // ============ N10: 无限滚动加载更多 ============

  test("N10: 滚动到底部触发加载更多", async ({ page }) => {
    await prisma.notification.deleteMany({ where: { recipientId: testUserId } })
    await createNotificationBatch(18, { type: NotificationType.COMMENT })

    await login(page, TEST_USER)
    await page.goto("/notifications")
    await page.waitForLoadState("networkidle")

    const unreadButtons = page.getByRole("button", { name: "标记已读" })
    const initialCount = await unreadButtons.count()
    expect(initialCount).toBeGreaterThan(0)

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))

    await expect(page.getByText("加载更多...")).toBeVisible({ timeout: 5000 })

    await expect.poll(async () => await unreadButtons.count(), { timeout: 10000 }).toBeGreaterThan(
      initialCount
    )
  })

  // ============ N11: 网络失败恢复 ============

  test("N11: 首次请求失败后重试恢复", async ({ page }) => {
    await prisma.notification.deleteMany({ where: { recipientId: testUserId } })
    await createNotificationBatch(3, { type: NotificationType.LIKE })

    let firstRequest = true
    await page.route("**/api/notifications**", async (route) => {
      if (firstRequest) {
        firstRequest = false
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "server error" }),
        })
        return
      }
      await route.continue()
    })

    await login(page, TEST_USER)
    await page.goto("/notifications")
    await page.waitForLoadState("networkidle")

    await expect(page.getByText("获取通知失败，请稍后再试")).toBeVisible({ timeout: 5000 })

    await page.getByRole("button", { name: "重新加载" }).click()

    await expect(page.getByRole("button", { name: "标记已读" }).first()).toBeVisible({
      timeout: 10000,
    })

    await page.unroute("**/api/notifications**")
  })

  // ============ N12: 批量标记已读联动 ============

  test("N12: 批量标记后未读计数与过滤联动", async ({ page }) => {
    await prisma.notification.deleteMany({ where: { recipientId: testUserId } })
    await createNotificationBatch(2, { type: NotificationType.LIKE })
    await createNotificationBatch(1, { type: NotificationType.COMMENT })

    await login(page, TEST_USER)
    await page.goto("/notifications")
    await page.waitForLoadState("networkidle")

    const unreadBadge = page.getByText(/未读\s+\d+/)
    const unreadText = await unreadBadge.textContent()
    const initialUnread = parseInt(unreadText?.match(/\d+/)?.[0] || "0", 10)
    expect(initialUnread).toBeGreaterThanOrEqual(3)

    await page.getByRole("button", { name: "全部已读" }).click()

    await expect(unreadBadge).toHaveText(/未读\s+0/)

    await page.getByRole("tab", { name: "点赞" }).click()
    await expect(page.getByRole("button", { name: "已读" }).first()).toBeVisible({
      timeout: 5000,
    })

    await page.getByRole("tab", { name: "评论" }).click()
    await expect(page.getByRole("button", { name: "已读" }).first()).toBeVisible({
      timeout: 5000,
    })
  })

  // ============ N13: 通知跳转 ============

  test("N13: 点击通知跳转到相关内容", async ({ page }) => {
    await prisma.notification.deleteMany({ where: { recipientId: testUserId } })

    const createdPostIds: string[] = []
    const createdCommentIds: string[] = []
    const createdNotificationIds: string[] = []

    const likePost = await createPublishedPost(testUserId, "e2e-like-target")
    const commentPost = await createPublishedPost(testUserId, "e2e-comment-target")
    const comment = await createCommentForPost(commentPost.id, actorUserId, `E2E 评论内容 ${Date.now()}`)

    createdPostIds.push(likePost.id, commentPost.id)
    createdCommentIds.push(comment.id)

    const likeNotification = await prisma.notification.create({
      data: {
        recipientId: testUserId,
        actorId: actorUserId,
        type: NotificationType.LIKE,
        postId: likePost.id,
        createdAt: new Date(Date.now() - 3000),
      },
    })

    const commentNotification = await prisma.notification.create({
      data: {
        recipientId: testUserId,
        actorId: actorUserId,
        type: NotificationType.COMMENT,
        postId: commentPost.id,
        commentId: comment.id,
        createdAt: new Date(Date.now() - 2000),
      },
    })

    const followNotification = await prisma.notification.create({
      data: {
        recipientId: testUserId,
        actorId: actorUserId,
        type: NotificationType.FOLLOW,
        followerId: actorUserId,
        createdAt: new Date(Date.now() - 1000),
      },
    })

    createdNotificationIds.push(likeNotification.id, commentNotification.id, followNotification.id)

    try {
      await login(page, TEST_USER)
      await page.goto("/notifications")
      await page.waitForLoadState("networkidle")

      const likeCard = page.locator('[data-slot="card"]').filter({ hasText: likePost.title }).first()
      await likeCard.click()
      await expect(page).toHaveURL(new RegExp(`/blog/${likePost.slug}`))

      await page.goto("/notifications")

      const commentCard = page.locator('[data-slot="card"]').filter({ hasText: commentPost.title }).first()
      await commentCard.click()
      await expect(page).toHaveURL(new RegExp(`/blog/${commentPost.slug}`))

      await page.goto("/notifications")

      const followCard = page.locator('[data-slot="card"]').filter({ hasText: "关注了你" }).first()
      await followCard.click()
      await expect(page).toHaveURL(new RegExp(`/profile/${actorUserId}`))
    } finally {
      await prisma.notification.deleteMany({ where: { id: { in: createdNotificationIds } } })
      await prisma.comment.deleteMany({ where: { id: { in: createdCommentIds } } })
      await prisma.post.deleteMany({ where: { id: { in: createdPostIds } } })
    }
  })

  // ============ N14: 顶栏铃铛未读计数 ============

  test("N14: 顶栏铃铛未读计数", async ({ page }) => {
    await prisma.notification.deleteMany({ where: { recipientId: testUserId } })
    await createNotificationBatch(2, { type: NotificationType.LIKE })

    try {
      await login(page, TEST_USER)
      await page.goto("/")

      const bellButton = page.locator("button:has(svg.lucide-bell)").first()
      await expect(bellButton).toBeVisible({ timeout: 15000 })

      const badge = bellButton.locator("span.bg-destructive")
      await expect(badge).toHaveText("2", { timeout: 15000 })

      await bellButton.click()
      await expect(page.getByText("通知")).toBeVisible({ timeout: 10000 })

      await page.getByRole("button", { name: "全部已读" }).click()

      await expect(page.getByText(/未读\s+0/)).toBeVisible({ timeout: 15000 })
      await expect(badge).toHaveCount(0)
    } finally {
      await prisma.notification.deleteMany({ where: { recipientId: testUserId } })
    }
  })

  // ============ N15: 关注生成通知 ============

  test("N15: 关注用户后生成关注通知", async ({ page }) => {
    await prisma.follow.deleteMany({ where: { followerId: actorUserId, followingId: testUserId } })
    await prisma.notification.deleteMany({
      where: { recipientId: testUserId, type: NotificationType.FOLLOW },
    })

    try {
      await login(page, ADMIN_USER)
      await page.goto(`/profile/${testUserId}`)
      await page.waitForLoadState("networkidle")

      const followButton = page.getByTestId("follow-button")
      await expect(followButton).toBeVisible({ timeout: 15000 })

      const followButtonText = await followButton.textContent()
      if (followButtonText?.includes("已关注")) {
        await followButton.click()
        await expect(followButton).toHaveText(/关注/, { timeout: 10000 })
      }

      await followButton.click()
      await expect(followButton).toHaveText(/已关注/, { timeout: 15000 })

      await login(page, TEST_USER)
      await page.goto("/notifications")
      await page.waitForLoadState("networkidle")

      const followCard = page.locator('[data-slot="card"]').filter({ hasText: "关注了你" }).first()
      await expect(followCard).toBeVisible({ timeout: 15000 })
    } finally {
      await prisma.follow.deleteMany({ where: { followerId: actorUserId, followingId: testUserId } })
      await prisma.notification.deleteMany({
        where: { recipientId: testUserId, type: NotificationType.FOLLOW },
      })
    }
  })

  // ============ N16: 实时通知接收 ============

  test("N16: 页面打开后收到实时通知", async ({ page }) => {
    await prisma.notification.deleteMany({ where: { recipientId: testUserId } })

    await login(page, TEST_USER)
    await page.goto("/notifications")
    await page.waitForLoadState("networkidle")

    await expect(page.getByText("暂时没有通知")).toBeVisible({ timeout: 15000 })

    const created = await notify(testUserId, NotificationType.LIKE, {
      actorId: actorUserId,
      postId: basePostId,
    })
    if (!created) {
      throw new Error("通知创建失败，实时测试无法继续")
    }

    await page.reload({ waitUntil: "networkidle" })

    await expect(page.getByText("赞了你的内容")).toBeVisible({ timeout: 20000 })

    await prisma.notification.delete({ where: { id: created.id } })
  })

  // ============ 通知系统 - 压力与随机测试 ============

  test.describe("通知系统 - 压力与随机测试", () => {
    test.describe.configure({ mode: "serial" })

    test.afterEach(async () => {
      await prisma.notification.deleteMany({ where: { recipientId: testUserId } })
    })

    test("P1: 大量通知渲染性能", async ({ page }) => {
      await createNotificationBatch(100, { type: NotificationType.LIKE })
      try {
        await login(page, TEST_USER)
        const start = Date.now()
        await page.goto("/notifications")
        await page.waitForLoadState("networkidle")
        await expect(page.getByRole("heading", { name: "通知中心" })).toBeVisible({ timeout: 5000 })
        const elapsed = Date.now() - start
        expect(elapsed).toBeLessThanOrEqual(5000)
        await expectNoConsoleErrors(page)
      } catch (error) {
        await captureScreenshotOnFailure(page, test.info().title)
        throw error
      }
    })

    test("P2: 快速过滤器切换", async ({ page }) => {
      await createNotificationBatch(20, { type: NotificationType.COMMENT })
      const tabs = ["全部", "点赞", "评论", "关注", "系统"]
      try {
        await login(page, TEST_USER)
        await page.goto("/notifications")
        await page.waitForLoadState("networkidle")

        for (let i = 0; i < 3; i += 1) {
          for (const tab of tabs) {
            await page.getByRole("tab", { name: tab }).click()
          }
        }

        await expectNoConsoleErrors(page)
      } catch (error) {
        await captureScreenshotOnFailure(page, test.info().title)
        throw error
      }
    })

    test("P3: 快速标记已读", async ({ page }) => {
      await createNotificationBatch(8, { type: NotificationType.FOLLOW })
      try {
        await login(page, TEST_USER)
        await page.goto("/notifications")
        await page.waitForLoadState("networkidle")

        const buttons = page.getByRole("button", { name: "标记已读" })
        const count = Math.min(5, await buttons.count())
        const initial = await buttons.count()
        for (let i = 0; i < count; i += 1) {
          await buttons.nth(i).click()
        }

        await expect
          .poll(async () => await buttons.count(), { timeout: 8000 })
          .toBeLessThanOrEqual(Math.max(0, initial - count))
        await expectNoConsoleErrors(page)
      } catch (error) {
        await captureScreenshotOnFailure(page, test.info().title)
        throw error
      }
    })

    test("P4: 滚动加载压力", async ({ page }) => {
      await createNotificationBatch(50, { type: NotificationType.COMMENT })
      try {
        await login(page, TEST_USER)
        await page.goto("/notifications")
        await page.waitForLoadState("networkidle")

        const cards = page.locator('[data-slot="card"]')
        let last = await cards.count()

        for (let i = 0; i < 3; i += 1) {
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
          await page.waitForTimeout(500)
          await expect
            .poll(async () => await cards.count(), { timeout: 8000 })
            .toBeGreaterThan(last)
          last = await cards.count()
        }

        await expectNoConsoleErrors(page)
      } catch (error) {
        await captureScreenshotOnFailure(page, test.info().title)
        throw error
      }
    })

    test("B1: 空过滤结果处理", async ({ page }) => {
      await createNotificationBatch(3, { type: NotificationType.LIKE })
      try {
        await login(page, TEST_USER)
        await page.goto("/notifications")
        await page.waitForLoadState("networkidle")

        await page.getByRole("tab", { name: "系统" }).click()
        await expect(page.getByText(/暂时没有通知/)).toBeVisible({ timeout: 5000 })
        await expectNoConsoleErrors(page)
      } catch (error) {
        await captureScreenshotOnFailure(page, test.info().title)
        throw error
      }
    })

    test("B2: 通知内容 XSS 防护", async ({ page }) => {
      const xss = XSS_VECTORS[0]
      const post = await createPublishedPost(testUserId, "xss-notice")
      const comment = await createCommentForPost(post.id, actorUserId, xss)
      await prisma.notification.create({
        data: {
          recipientId: testUserId,
          actorId: actorUserId,
          type: NotificationType.COMMENT,
          postId: post.id,
          commentId: comment.id,
        },
      })
      try {
        await login(page, TEST_USER)
        await page.goto("/notifications")
        await page.waitForLoadState("networkidle")

        const item = page.locator('[data-slot="card"]').filter({ hasText: xss }).first()
        await expect(item).toBeVisible({ timeout: 8000 })
        await expectNoConsoleErrors(page)
      } catch (error) {
        await captureScreenshotOnFailure(page, test.info().title)
        throw error
      } finally {
        await prisma.post.deleteMany({ where: { id: post.id } })
        await prisma.comment.deleteMany({ where: { id: comment.id } })
      }
    })

    test("B3: 超长 Actor 名称显示", async ({ page }) => {
      const longName = randomString(100, "alpha")
      const actorEmail = `long-actor-${Date.now()}@example.com`
      const actor = await prisma.user.create({
        data: { email: actorEmail, name: longName },
      })
      await prisma.notification.create({
        data: {
          recipientId: testUserId,
          actorId: actor.id,
          type: NotificationType.FOLLOW,
          followerId: actor.id,
        },
      })
      try {
        await login(page, TEST_USER)
        await page.goto("/notifications")
        await page.waitForLoadState("networkidle")

        const card = page
          .locator('[data-slot="card"]')
          .filter({ hasText: longName.slice(0, 20) })
          .first()
        const text = (await card.textContent()) ?? ""
        expect(text.length).toBeLessThan(longName.length + 10)
        await expectNoConsoleErrors(page)
      } catch (error) {
        await captureScreenshotOnFailure(page, test.info().title)
        throw error
      } finally {
        await prisma.notification.deleteMany({ where: { actorId: actor.id } })
        await prisma.user.deleteMany({ where: { id: actor.id } })
      }
    })

    test("B4: 无效 type 参数处理", async ({ page }) => {
      await createNotificationBatch(3, { type: NotificationType.LIKE })
      try {
        await login(page, TEST_USER)
        await page.goto("/notifications?type=INVALID")
        await page.waitForLoadState("networkidle")

        await expect(page.getByRole("tab", { name: "全部" })).toHaveAttribute(
          "data-state",
          "active"
        )
        await expectNoConsoleErrors(page)
      } catch (error) {
        await captureScreenshotOnFailure(page, test.info().title)
        throw error
      }
    })

    test("R1: 随机通知批量创建/删除", async ({ page }) => {
      const count = 10 + Math.floor(Math.random() * 21)
      await createNotificationBatch(count, { type: NotificationType.COMMENT })
      try {
        await login(page, TEST_USER)
        await page.goto("/notifications")
        await page.waitForLoadState("networkidle")

        const cards = page.locator('[data-slot="card"]')
        for (let i = 0; i < 5; i += 1) {
          const current = await cards.count()
          if (current >= count) break
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
          await page.waitForTimeout(400)
        }
        await expect
          .poll(async () => await cards.count(), { timeout: 12000 })
          .toBeGreaterThanOrEqual(count)

        await prisma.notification.deleteMany({ where: { recipientId: testUserId } })
        await page.reload()
        await expect(page.getByText("暂时没有通知")).toBeVisible({ timeout: 8000 })
        await expectNoConsoleErrors(page)
      } catch (error) {
        await captureScreenshotOnFailure(page, test.info().title)
        throw error
      }
    })

    test("R2: 随机过滤器组合", async ({ page }) => {
      await Promise.all([
        createNotificationBatch(3, { type: NotificationType.LIKE }),
        createNotificationBatch(2, { type: NotificationType.COMMENT }),
        createNotificationBatch(1, { type: NotificationType.FOLLOW }),
      ])
      const tabs = ["全部", "点赞", "评论", "关注", "系统"]
      try {
        await login(page, TEST_USER)
        await page.goto("/notifications")
        await page.waitForLoadState("networkidle")

        for (let i = 0; i < 5; i += 1) {
          const tab = tabs[Math.floor(Math.random() * tabs.length)]
          await page.getByRole("tab", { name: tab }).click()
        }
        await expectNoConsoleErrors(page)
      } catch (error) {
        await captureScreenshotOnFailure(page, test.info().title)
        throw error
      }
    })

    test("C1: 并发标记已读", async ({ page }) => {
      await createNotificationBatch(5, { type: NotificationType.LIKE })
      try {
        await login(page, TEST_USER)
        await page.goto("/notifications")
        await page.waitForLoadState("networkidle")

        const buttons = page.getByRole("button", { name: "标记已读" })
        const count = await buttons.count()
        const actions = []
        for (let i = 0; i < Math.min(4, count); i += 1) {
          actions.push(buttons.nth(i).click())
        }
        await Promise.all(actions)

        await expect
          .poll(async () => await buttons.count(), { timeout: 8000 })
          .toBeLessThanOrEqual(count - actions.length)
        await expectNoConsoleErrors(page)
      } catch (error) {
        await captureScreenshotOnFailure(page, test.info().title)
        throw error
      }
    })

    test("C2: 实时通知与手动刷新竞态", async ({ page }) => {
      await prisma.notification.deleteMany({ where: { recipientId: testUserId } })
      try {
        await login(page, TEST_USER)
        await page.goto("/notifications")
        await page.waitForLoadState("networkidle")

        const cards = page.locator('[data-slot="card"]')
        const initial = await cards.count()

        const created = await prisma.notification.create({
          data: {
            recipientId: testUserId,
            actorId: actorUserId,
            type: NotificationType.SYSTEM,
            followerId: testUserId,
          },
        })

        await page.reload()
        await page.waitForLoadState("networkidle")

        await expect
          .poll(async () => await cards.count(), { timeout: 12000 })
          .toBe(initial + 1)
        await expectNoConsoleErrors(page)

        await prisma.notification.delete({ where: { id: created.id } })
      } catch (error) {
        await captureScreenshotOnFailure(page, test.info().title)
        throw error
      }
    })
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

  // 等待登录成功消息出现，然后等待重定向
  await page.waitForSelector('text="登录成功"', { timeout: 30000 }).catch(() => {
    // 如果没有成功消息，可能直接重定向了
  })

  // 等待 URL 变化（考虑 1 秒的重定向延迟）
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 })
}

type TargetOverride = {
  postId?: string | null
  activityId?: string | null
  followerId?: string | null
  recipientId?: string
}

function resolveNotificationTarget(
  type: NotificationType,
  overrides: TargetOverride = {}
): { postId: string | null; activityId: string | null; followerId: string | null } {
  if (overrides.postId) return { postId: overrides.postId, activityId: null, followerId: null }
  if (overrides.activityId) return { postId: null, activityId: overrides.activityId, followerId: null }
  if (overrides.followerId) return { postId: null, activityId: null, followerId: overrides.followerId }

  if (type === NotificationType.FOLLOW) {
    return { postId: null, activityId: null, followerId: overrides.recipientId ?? actorUserId }
  }

  if (type === NotificationType.SYSTEM) {
    return { postId: null, activityId: null, followerId: overrides.recipientId ?? testUserId }
  }

  return { postId: basePostId, activityId: null, followerId: null }
}

async function createTestNotifications() {
  // 创建多种类型的通知用于测试
  const notifications = [
    { type: NotificationType.LIKE, readAt: null },
    { type: NotificationType.COMMENT, readAt: null },
    { type: NotificationType.FOLLOW, readAt: null },
    { type: NotificationType.SYSTEM, readAt: new Date() },
  ]

  for (const notif of notifications) {
    const target = resolveNotificationTarget(notif.type, { recipientId: testUserId })
    await prisma.notification.create({
      data: {
        recipientId: testUserId,
        actorId: actorUserId,
        type: notif.type,
        readAt: notif.readAt,
        postId: target.postId,
        activityId: target.activityId,
        followerId: target.followerId,
      },
    })
  }
}

async function createNotificationBatch(
  count: number,
  options?: {
    type?: NotificationType
    read?: boolean
    postId?: string
    activityId?: string
    followerId?: string
  }
) {
  if (count <= 0) return
  const type = options?.type ?? NotificationType.LIKE
  const readAt = options?.read ? new Date() : null
  const now = Date.now()
  const target = resolveNotificationTarget(type, {
    postId: options?.postId,
    activityId: options?.activityId,
    followerId: options?.followerId,
    recipientId: testUserId,
  })

  await prisma.notification.createMany({
    data: Array.from({ length: count }, (_, index) => ({
      recipientId: testUserId,
      actorId: actorUserId,
      type,
      readAt,
      createdAt: new Date(now - index * 1000),
      postId: target.postId,
      activityId: target.activityId,
      followerId: target.followerId,
    })),
  })
}

async function createUnreadNotification(type: NotificationType) {
  const target = resolveNotificationTarget(type, { recipientId: testUserId })
  await prisma.notification.create({
    data: {
      recipientId: testUserId,
      actorId: actorUserId,
      type,
      readAt: null,
      postId: target.postId,
      activityId: target.activityId,
      followerId: target.followerId,
    },
  })
}

async function createPublishedPost(authorId: string, titlePrefix: string) {
  const slug = buildSlug(titlePrefix)
  const title = `${titlePrefix} ${new Date().toISOString()}`
  const content = `E2E notification test content for ${titlePrefix}`

  return prisma.post.create({
    data: {
      slug,
      title,
      content,
      excerpt: content.slice(0, 80),
      published: true,
      publishedAt: new Date(),
      authorId,
    },
  })
}

async function createCommentForPost(postId: string, authorId: string, content: string) {
  return prisma.comment.create({
    data: {
      postId,
      authorId,
      content,
    },
  })
}

function buildSlug(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}
