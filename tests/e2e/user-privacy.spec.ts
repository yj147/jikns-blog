/**
 * 用户隐私端到端测试
 * 覆盖资料页可见性、关注列表访问控制与媒体签名 URL 安全性
 */

import { expect, test, Page } from "@playwright/test"
import { randomUUID } from "crypto"
import prisma from "@/lib/prisma"
import { createServiceRoleClient } from "@/lib/supabase"

type Visibility = "public" | "followers" | "private"

const USERS = {
  publicUser: { email: "user@example.com", password: "user123456" },
  followersOnlyUser: { email: "feed-ops@example.com", password: "feedops123" },
  privateUser: { email: "feed-writer@example.com", password: "feedwriter123" },
  follower: { email: "feed-reader@example.com", password: "feedreader123" },
  stranger: { email: "feed-guest@example.com", password: "feedguest123" },
  admin: { email: "admin@example.com", password: "admin123456" },
}

const STORAGE_BUCKET = "activity-images"

let publicUserId: string
let followersOnlyUserId: string
let privateUserId: string

let serviceClient: ReturnType<typeof createServiceRoleClient> | null = null
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

const mediaPath = `avatars/privacy-e2e/${randomUUID()}.txt`

test.describe("privacy e2e", () => {
  test.describe.configure({ mode: "serial" })

  test.beforeAll(async () => {
    serviceClient = createServiceRoleClient()

    publicUserId = await getUserId(USERS.publicUser.email)
    followersOnlyUserId = await getUserId(USERS.followersOnlyUser.email)
    privateUserId = await getUserId(USERS.privateUser.email)
    await ensureFollowRelation(USERS.follower.email, USERS.followersOnlyUser.email)
    await removeFollowRelation(USERS.stranger.email, USERS.followersOnlyUser.email)

    await setProfileVisibility(USERS.publicUser.email, "public")
    await setProfileVisibility(USERS.followersOnlyUser.email, "followers")
    await setProfileVisibility(USERS.privateUser.email, "private")

    await prisma.user.update({
      where: { email: USERS.followersOnlyUser.email },
      data: { avatarUrl: mediaPath },
    })

    await uploadMediaFixture(mediaPath)
  })

  test.afterAll(async () => {
    if (serviceClient) {
      await serviceClient.storage.from(STORAGE_BUCKET).remove([mediaPath])
    }
  })

  test("公开资料匿名可访问 [privacy]", async ({ page }) => {
    await page.context().clearCookies()

    const profileResponse = await page.goto(`/profile/${publicUserId}`)
    expect(profileResponse?.status()).toBe(200)
    await expect(page.getByRole("heading", { name: /示例用户|user/ })).toBeVisible()

    const followersResp = await page.request.get(`/api/users/${publicUserId}/followers`)
    expect(followersResp.status()).toBe(200)

    await page.goto(`/profile/${publicUserId}/followers`)
    await expect(page.getByText("无法访问关注列表")).not.toBeVisible()
  })

  test("followers-only 粉丝可访问，非粉丝被拒绝 [privacy]", async ({ page }) => {
    await login(page, USERS.follower)

    const profileResponse = await page.goto(`/profile/${followersOnlyUserId}`)
    expect(profileResponse?.status()).toBe(200)
    await expect(page.getByTestId("follow-button")).toBeVisible()

    const followerListResp = await page.request.get(`/api/users/${followersOnlyUserId}/followers`)
    expect(followerListResp.status()).toBe(200)

    await page.goto(`/profile/${followersOnlyUserId}/followers`)
    await expect(page.getByText("无法访问关注列表")).not.toBeVisible()

    await login(page, USERS.stranger)

    const strangerProfile = await page.goto(`/profile/${followersOnlyUserId}`)
    expect([403, 404]).toContain(strangerProfile?.status() ?? 0)

    const strangerListResp = await page.request.get(`/api/users/${followersOnlyUserId}/followers`)
    expect(strangerListResp.status()).toBe(403)

    await page.goto(`/profile/${followersOnlyUserId}/followers`)
    await expect(page.getByText("无法访问关注列表")).toBeVisible()
  })

  test("private 仅本人或管理员可访问 [privacy]", async ({ page }) => {
    await login(page, USERS.privateUser)

    const ownProfile = await page.goto(`/profile/${privateUserId}`)
    expect(ownProfile?.status()).toBe(200)

    const ownList = await page.request.get(`/api/users/${privateUserId}/followers`)
    expect(ownList.status()).toBe(200)

    await page.goto(`/profile/${privateUserId}/followers`)
    await expect(page.getByText("无法访问关注列表")).not.toBeVisible()

    await page.context().clearCookies()
    const anonProfile = await page.goto(`/profile/${privateUserId}`)
    expect(anonProfile?.status()).toBe(404)

    const anonList = await page.request.get(`/api/users/${privateUserId}/followers`)
    expect(anonList.status()).toBe(403)

    await page.goto(`/profile/${privateUserId}/followers`)
    await expect(page.getByText("无法访问关注列表")).toBeVisible()

    await login(page, USERS.admin)
    const adminList = await page.request.get(`/api/users/${privateUserId}/followers`)
    expect(adminList.status()).toBe(200)
  })

  test("媒体资源使用签名 URL 且直链拒绝访问 [privacy]", async ({ page }) => {
    await page.context().clearCookies()
    const profileResponse = await page.goto(`/profile/${followersOnlyUserId}`)
    expect(profileResponse?.status()).toBe(200)

    const avatar = page.locator(`img[src*="${mediaPath}"]`).first()
    await expect(avatar).toBeVisible()
    const src = await avatar.getAttribute("src")
    expect(src).toBeTruthy()
    expect(src!).toContain("/sign/")
    expect(src!).toContain(encodeURIComponent(mediaPath).replace(/%2F/g, "/"))

    if (!supabaseUrl) {
      throw new Error("缺少 NEXT_PUBLIC_SUPABASE_URL 环境变量")
    }
    const directUrl = `${supabaseUrl}/storage/v1/object/${STORAGE_BUCKET}/${mediaPath}`
    const directResp = await page.request.get(directUrl)
    expect(directResp.status()).toBeGreaterThanOrEqual(400)
  })

  test("签名 URL 过期后拒绝访问 [privacy]", async ({ page }) => {
    if (!serviceClient) {
      throw new Error("Service role client 未初始化")
    }

    const { data, error } = await serviceClient.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(mediaPath, 1)

    if (error || !data?.signedUrl) {
      throw new Error(`签名 URL 生成失败: ${error?.message}`)
    }

    const initial = await page.request.get(data.signedUrl)
    expect(initial.status()).toBe(200)

    await page.waitForTimeout(2000)
    const expired = await page.request.get(data.signedUrl)
    expect(expired.status()).toBeGreaterThanOrEqual(400)
  })
})

async function login(page: Page, user: { email: string; password: string }) {
  await page.context().clearCookies()
  await page.goto("/login/email")
  await page.waitForSelector("input#email")
  await page.fill("input#email", user.email)
  await page.fill("input#password", user.password)
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => !url.pathname.includes("/login"))
}

async function getUserId(email: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email },
    select: { id: true },
  })
  return user.id
}

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

async function uploadMediaFixture(path: string) {
  if (!serviceClient) {
    throw new Error("Service role client 未初始化")
  }
  // 创建一个最小的有效 PNG 图片（1x1 透明像素）
  const pngBuffer = Buffer.from([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a, // PNG signature
    0x00,
    0x00,
    0x00,
    0x0d,
    0x49,
    0x48,
    0x44,
    0x52, // IHDR chunk
    0x00,
    0x00,
    0x00,
    0x01,
    0x00,
    0x00,
    0x00,
    0x01,
    0x08,
    0x06,
    0x00,
    0x00,
    0x00,
    0x1f,
    0x15,
    0xc4,
    0x89,
    0x00,
    0x00,
    0x00,
    0x0a,
    0x49,
    0x44,
    0x41, // IDAT chunk
    0x54,
    0x78,
    0x9c,
    0x63,
    0x00,
    0x01,
    0x00,
    0x00,
    0x05,
    0x00,
    0x01,
    0x0d,
    0x0a,
    0x2d,
    0xb4,
    0x00,
    0x00,
    0x00,
    0x00,
    0x49,
    0x45,
    0x4e,
    0x44,
    0xae, // IEND chunk
    0x42,
    0x60,
    0x82,
  ])
  const { error } = await serviceClient.storage.from(STORAGE_BUCKET).upload(path, pngBuffer, {
    upsert: true,
    contentType: "image/png",
  })

  if (error) {
    throw new Error(`上传测试媒体失败: ${error.message}`)
  }
}
