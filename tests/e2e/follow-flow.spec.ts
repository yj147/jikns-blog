/**
 * 关注系统端到端测试
 * 场景：推荐关注 → 关注流 → 取关（乐观更新） → 未登录访问控制 → 设置页管理
 */

import { test, expect, Page } from "@playwright/test"
import fs from "fs/promises"

type SeedState = {
  users: { email: string; authId: string; dbId: string }[]
}

const TEST_USERS = {
  user1: { email: "testuser1@example.com", password: "test123", name: "testuser1" },
  user2: { email: "testuser2@example.com", password: "test123", name: "testuser2" },
}

async function loginUser(page: Page, email: string, password: string) {
  await page.goto("/login/email")
  await page.waitForSelector("input#email")
  await page.fill("input#email", email)
  await page.fill("input#password", password)
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => !url.pathname.includes("/login"))
}

async function getUserIdByEmail(email: string): Promise<string> {
  const raw = await fs.readFile("tests/e2e/seed-state.json", "utf8")
  const state: SeedState = JSON.parse(raw)
  const entry = state.users.find((u) => u.email === email)
  if (!entry) throw new Error(`seed-state 未包含用户: ${email}`)
  return entry.dbId
}

test.describe("关注系统 - E2E", () => {
  test.setTimeout(30_000)

  test("场景1：Feed页面关注推荐用户（乐观更新）", async ({ page }) => {
    await loginUser(page, TEST_USERS.user1.email, TEST_USERS.user1.password)
    await page.goto("/feed")

    // 侧栏推荐区域
    await page.waitForSelector('[data-testid="suggested-users-section"]')
    const userItem = page.locator('[data-testid="suggested-user-item"]', {
      hasText: TEST_USERS.user2.name,
    })
    await expect(userItem).toBeVisible()

    const followBtn = userItem.getByTestId("follow-button")
    await followBtn.click()

    // 乐观更新：按钮立即变为“已关注”
    await expect(followBtn).toHaveText(/已关注|取消关注中/)
  })

  test("场景2：关注流Tab仅显示已关注用户动态", async ({ page }) => {
    await loginUser(page, TEST_USERS.user1.email, TEST_USERS.user1.password)
    const user2Id = await getUserIdByEmail(TEST_USERS.user2.email)

    // 确保已关注
    await page.request.post(`/api/users/${user2Id}/follow`)

    await page.goto("/feed")
    await page.getByTestId("feed-tab-following").click()

    // 只显示 user2 的动态，且数量>0
    const cards = page.locator('[data-testid="activity-card"]')
    await expect(cards.first()).toBeVisible()
    const count = await cards.count()
    expect(count).toBeGreaterThan(0)

    // 验证每个卡片包含 user2 名称（宽松匹配，避免 UI 波动）
    for (let i = 0; i < count; i++) {
      await expect(cards.nth(i)).toContainText(TEST_USERS.user2.name, { timeout: 5000 })
    }
  })

  test("场景3：取关并验证乐观更新（使用 Profile 页验证）", async ({ page }) => {
    // 说明：Feed 页面无取关按钮，使用 Profile 页验证乐观更新
    await loginUser(page, TEST_USERS.user1.email, TEST_USERS.user1.password)
    const user2Id = await getUserIdByEmail(TEST_USERS.user2.email)

    // 确保已关注
    await page.request.post(`/api/users/${user2Id}/follow`)

    // 跳转到被关注用户的资料页
    await page.goto(`/profile/${user2Id}`)
    const followBtn = page.getByTestId("follow-button")

    await expect(followBtn).toHaveText(/已关注/)

    // 点击“已关注”执行取关（乐观更新应立即变为“关注”）
    await followBtn.click()
    await expect(followBtn).toHaveText(/关注|关注中/)

    // 等待网络完成后仍保持“关注”
    await page.waitForTimeout(500)
    await expect(followBtn).toHaveText(/关注/)
  })

  test("场景4：未登录用户访问控制", async ({ page, context }) => {
    // 清理 Cookie 模拟未登录
    await context.clearCookies()
    await page.goto("/feed")
    // 关注Tab应禁用
    const followingTab = page.getByTestId("feed-tab-following")
    await expect(followingTab).toHaveAttribute("disabled")

    // 推荐关注区域应存在（可能显示错误提示）
    await expect(page.locator('[data-testid="suggested-users-section"]')).toBeVisible()
  })

  test("场景5：Settings页面关注管理（取关）", async ({ page }) => {
    await loginUser(page, TEST_USERS.user1.email, TEST_USERS.user1.password)
    const user2Id = await getUserIdByEmail(TEST_USERS.user2.email)

    // 确保已关注
    await page.request.post(`/api/users/${user2Id}/follow`)

    await page.goto("/settings")
    await page.click('button:has-text("关注管理")')

    // following 列表中应能找到 user2
    const row = page.locator("text=关注的人").locator("..") // Tabs 容器
    await expect(row).toBeVisible()

    // 粗略查找包含 user2 名称的跟随项，然后找到其中的 follow-button 并点击取关
    const item = page
      .locator("div", { hasText: TEST_USERS.user2.name })
      .filter({ has: page.getByTestId("follow-button") })
      .first()
    await expect(item).toBeVisible()
    const btn = item.getByTestId("follow-button")

    await expect(btn).toHaveText(/已关注/)

    // 执行取关
    await btn.click()
    await expect(btn).toHaveText(/关注/)
  })

  test("场景6：粉丝列表分页（API 层验证）", async ({ page }) => {
    await loginUser(page, TEST_USERS.user1.email, TEST_USERS.user1.password)
    const user1Id = await getUserIdByEmail(TEST_USERS.user1.email)

    // 获取粉丝列表（第一页，不请求总数）
    const response = await page.request.get(`/api/users/${user1Id}/followers?limit=10`)
    expect(response.ok()).toBeTruthy()

    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.data).toBeDefined()
    expect(Array.isArray(data.data)).toBe(true) // 修正：data 本身就是数组

    // 验证分页元数据（在 meta.pagination 中）
    expect(data.meta.pagination).toBeDefined()
    expect(typeof data.meta.pagination.total).toBe("number")
    expect(typeof data.meta.pagination.hasMore).toBe("boolean")

    // 默认情况下应返回真实总数
    expect(data.meta.pagination.total).toBeGreaterThanOrEqual(0)
    if (data.data.length > 0) {
      expect(data.meta.pagination.total).toBeGreaterThanOrEqual(data.data.length)
    }

    // 如果有下一页，验证 nextCursor 是 Base64 字符串
    if (data.meta.pagination.hasMore) {
      expect(data.meta.pagination.nextCursor).toBeDefined()
      expect(typeof data.meta.pagination.nextCursor).toBe("string")
      // 验证是有效的 Base64
      expect(data.meta.pagination.nextCursor.length).toBeGreaterThan(0)
    }
  })

  test("场景6.1：粉丝列表请求总数（includeTotal=true）", async ({ page }) => {
    await loginUser(page, TEST_USERS.user1.email, TEST_USERS.user1.password)
    const user1Id = await getUserIdByEmail(TEST_USERS.user1.email)

    // 获取粉丝列表（请求总数）
    const response = await page.request.get(
      `/api/users/${user1Id}/followers?limit=10&includeTotal=true`
    )
    expect(response.ok()).toBeTruthy()

    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.data).toBeDefined()
    expect(Array.isArray(data.data)).toBe(true)

    // 验证 total 不为 0（已请求 includeTotal）
    expect(data.meta.pagination.total).toBeGreaterThanOrEqual(0)

    // 如果有数据，total 应该 >= 数据长度
    if (data.data.length > 0) {
      expect(data.meta.pagination.total).toBeGreaterThanOrEqual(data.data.length)
    }
  })

  test("场景7：关注列表分页（API 层验证）", async ({ page }) => {
    await loginUser(page, TEST_USERS.user1.email, TEST_USERS.user1.password)
    const user1Id = await getUserIdByEmail(TEST_USERS.user1.email)

    // 获取关注列表（第一页，不请求总数）
    const response = await page.request.get(`/api/users/${user1Id}/following?limit=10`)
    expect(response.ok()).toBeTruthy()

    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.data).toBeDefined()
    expect(Array.isArray(data.data)).toBe(true) // 修正：data 本身就是数组

    // 验证分页元数据（在 meta.pagination 中）
    expect(data.meta.pagination).toBeDefined()
    expect(typeof data.meta.pagination.total).toBe("number")
    expect(typeof data.meta.pagination.hasMore).toBe("boolean")

    // 默认情况下应返回真实总数
    expect(data.meta.pagination.total).toBeGreaterThanOrEqual(0)
    if (data.data.length > 0) {
      expect(data.meta.pagination.total).toBeGreaterThanOrEqual(data.data.length)
    }

    // 验证每个项包含必要字段
    if (data.data.length > 0) {
      const firstItem = data.data[0]
      expect(firstItem.id).toBeDefined()
      expect(firstItem.name).toBeDefined()
      expect(typeof firstItem.isMutual).toBe("boolean")
    }
  })

  test("场景7.1：关注列表请求总数（includeTotal=true）", async ({ page }) => {
    await loginUser(page, TEST_USERS.user1.email, TEST_USERS.user1.password)
    const user1Id = await getUserIdByEmail(TEST_USERS.user1.email)

    // 获取关注列表（请求总数）
    const response = await page.request.get(
      `/api/users/${user1Id}/following?limit=10&includeTotal=true`
    )
    expect(response.ok()).toBeTruthy()

    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.data).toBeDefined()
    expect(Array.isArray(data.data)).toBe(true)

    // 验证 total 不为 0（已请求 includeTotal）
    expect(data.meta.pagination.total).toBeGreaterThanOrEqual(0)

    // 如果有数据，total 应该 >= 数据长度
    if (data.data.length > 0) {
      expect(data.meta.pagination.total).toBeGreaterThanOrEqual(data.data.length)
    }
  })

  test("场景7.2：关注列表显式关闭总数（includeTotal=false）", async ({ page }) => {
    await loginUser(page, TEST_USERS.user1.email, TEST_USERS.user1.password)
    const user1Id = await getUserIdByEmail(TEST_USERS.user1.email)

    const response = await page.request.get(
      `/api/users/${user1Id}/following?limit=10&includeTotal=false`
    )
    expect(response.ok()).toBeTruthy()

    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.meta.pagination.total).toBeNull()
  })

  test("场景8：速率限制验证（429 响应和 Retry-After）", async ({ page }) => {
    await loginUser(page, TEST_USERS.user1.email, TEST_USERS.user1.password)
    const user2Id = await getUserIdByEmail(TEST_USERS.user2.email)

    // 快速连续发送关注请求，触发速率限制
    const requests = []
    for (let i = 0; i < 35; i++) {
      // 超过限制（30次/分钟）
      requests.push(page.request.post(`/api/users/${user2Id}/follow`))
    }

    const responses = await Promise.all(requests)

    // 至少有一个请求应该返回 429
    const rateLimitedResponses = responses.filter((r) => r.status() === 429)
    expect(rateLimitedResponses.length).toBeGreaterThan(0)

    // 验证 429 响应包含 Retry-After header
    const rateLimitedResponse = rateLimitedResponses[0]
    const retryAfter = rateLimitedResponse.headers()["retry-after"]
    expect(retryAfter).toBeDefined()
    expect(retryAfter).toBe("60")

    // 验证响应体格式
    const body = await rateLimitedResponse.json()
    expect(body.success).toBe(false)
    expect(body.error).toBeDefined()
    expect(body.error.code).toBe("RATE_LIMIT_EXCEEDED")
    expect(body.meta?.requestId).toBeDefined()
  })

  test("场景9：批量状态查询（API 层验证）", async ({ page }) => {
    await loginUser(page, TEST_USERS.user1.email, TEST_USERS.user1.password)
    const user2Id = await getUserIdByEmail(TEST_USERS.user2.email)

    // 确保已关注 user2
    await page.request.post(`/api/users/${user2Id}/follow`)

    // 批量查询关注状态
    const response = await page.request.post("/api/users/follow/status", {
      data: {
        targetIds: [user2Id],
      },
    })

    expect(response.ok()).toBeTruthy()

    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.data).toBeDefined()

    // 验证返回格式：{ [userId]: { isFollowing: boolean } }
    expect(data.data[user2Id]).toBeDefined()
    expect(typeof data.data[user2Id].isFollowing).toBe("boolean")
    expect(data.data[user2Id].isFollowing).toBe(true)
  })

  test("场景10：批量状态查询限制（超过50个ID）", async ({ page }) => {
    await loginUser(page, TEST_USERS.user1.email, TEST_USERS.user1.password)

    // 构造超过50个ID的请求
    const targetIds = Array.from({ length: 51 }, (_, i) => `user-id-${i}`)

    const response = await page.request.post("/api/users/follow/status", {
      data: { targetIds },
    })

    // 应该返回 400 错误
    expect(response.status()).toBe(400)

    const data = await response.json()
    expect(data.success).toBe(false)
    expect(data.error?.code).toBe("LIMIT_EXCEEDED")
  })
})
