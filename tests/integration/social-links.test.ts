import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest"
import { socialLinksSchema } from "@/types/user-settings"
import { realPrisma, disconnectRealDb } from "./setup-real-db"
import { TEST_USERS } from "../helpers/test-data"
import { resetMocks, setCurrentTestUser } from "../__mocks__/supabase"

type UpdateSocialLinks = typeof import("@/app/actions/settings")["updateSocialLinks"]

const auditLogMock = { logEvent: vi.fn().mockResolvedValue(undefined) }

vi.mock("@/lib/audit-log", async () => {
  const actual = await vi.importActual<typeof import("@/lib/audit-log")>("@/lib/audit-log")
  return {
    ...actual,
    auditLogger: auditLogMock,
  }
})

vi.doUnmock("@/lib/prisma")
vi.mock("@/lib/prisma", () => ({
  prisma: realPrisma,
  default: realPrisma,
}))

let updateSocialLinks: UpdateSocialLinks

const userFixture = TEST_USERS.user
const adminFixture = TEST_USERS.admin
let dbAvailable = true

async function ensureUser(user = userFixture) {
  await realPrisma.user.upsert({
    where: { id: user.id },
    update: {
      email: user.email,
      name: user.name,
      role: user.role as any,
      status: user.status as any,
      lastLoginAt: new Date(),
      updatedAt: new Date(),
      socialLinks: null,
    },
    create: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as any,
      status: user.status as any,
      lastLoginAt: new Date(),
      updatedAt: new Date(),
    },
  })
}

const skipIfNoDb = () => {
  if (dbAvailable) return false
  expect(true).toBe(true)
  return true
}

describe("社交链接 Server Action", () => {
  beforeAll(async () => {
    try {
      await realPrisma.$connect()
    } catch {
      dbAvailable = false
      return
    }

    const actions = await import("@/app/actions/settings")
    updateSocialLinks = actions.updateSocialLinks

    await ensureUser(userFixture)
    await ensureUser(adminFixture)
  })

  afterAll(async () => {
    if (dbAvailable) {
      await realPrisma.user.deleteMany({ where: { id: { in: [userFixture.id, adminFixture.id] } } })
      await disconnectRealDb()
    }
    resetMocks()
  })

  beforeEach(async () => {
    auditLogMock.logEvent.mockReset()
    if (!dbAvailable) return
    await realPrisma.user.updateMany({
      where: { id: { in: [userFixture.id, adminFixture.id] } },
      data: { socialLinks: null },
    })
    setCurrentTestUser("user")
  })

  it("有效 URL 应被保存", async () => {
    if (skipIfNoDb()) return
    const payload = {
      website: "https://example.com",
      github: "https://github.com/test-user",
      twitter: "https://twitter.com/test-user",
    }

    const result = await updateSocialLinks(userFixture.id, payload)

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data).toMatchObject(payload)

    const record = await realPrisma.user.findUniqueOrThrow({
      where: { id: userFixture.id },
      select: { socialLinks: true },
    })

    expect(socialLinksSchema.parse(record.socialLinks)).toMatchObject(payload)
  })

  it("无效 URL 应被拒绝", async () => {
    if (skipIfNoDb()) return
    const result = await updateSocialLinks(userFixture.id, { github: "not-a-url" })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.code).toBe("VALIDATION_ERROR")
    expect(result.field).toBe("github")
  })

  it("超过长度限制的链接会被拒绝", async () => {
    if (skipIfNoDb()) return
    const longUrl = `https://example.com/${"a".repeat(210)}`

    const result = await updateSocialLinks(userFixture.id, { website: longUrl })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.code).toBe("VALIDATION_ERROR")
    expect(result.field).toBe("website")

    const record = await realPrisma.user.findUniqueOrThrow({
      where: { id: userFixture.id },
      select: { socialLinks: true },
    })
    expect(record.socialLinks).toBeNull()
  })

  it("空字符串应清除对应字段", async () => {
    if (skipIfNoDb()) return
    await realPrisma.user.update({
      where: { id: userFixture.id },
      data: {
        socialLinks: {
          website: "https://keep.me",
          email: "mailto:keep@example.com",
        },
      },
    })

    const result = await updateSocialLinks(userFixture.id, { website: "", email: "" })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data).toBeNull()

    const record = await realPrisma.user.findUniqueOrThrow({
      where: { id: userFixture.id },
      select: { socialLinks: true },
    })

    expect(record.socialLinks).toBeNull()
  })

  it("仅本人或管理员可更新", async () => {
    if (skipIfNoDb()) return
    // 普通用户尝试修改他人
    const denyResult = await updateSocialLinks(adminFixture.id, {
      website: "https://malicious.example.com",
    })

    expect(denyResult.success).toBe(false)
    if (denyResult.success) return
    expect(denyResult.error).toContain("禁止修改其他用户")

    // 管理员可以修改他人
    setCurrentTestUser("admin")
    const allowResult = await updateSocialLinks(userFixture.id, {
      linkedin: "https://www.linkedin.com/in/admin-edited",
    })

    expect(allowResult.success).toBe(true)
    if (!allowResult.success) return

    const record = await realPrisma.user.findUniqueOrThrow({
      where: { id: userFixture.id },
      select: { socialLinks: true },
    })

    expect(record.socialLinks).toMatchObject({
      linkedin: "https://www.linkedin.com/in/admin-edited",
    })
  })

  it("管理员代他人更新社交链接会写入审计日志", async () => {
    if (skipIfNoDb()) return
    setCurrentTestUser("admin")
    const payload = { twitter: "https://twitter.com/admin-updated" }

    const result = await updateSocialLinks(userFixture.id, payload)

    expect(result.success).toBe(true)
    expect(auditLogMock.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ADMIN_UPDATE_SOCIAL_LINKS",
        resource: `user:${userFixture.id}`,
        details: expect.objectContaining({
          actorUserId: adminFixture.id,
          targetUserId: userFixture.id,
          socialLinks: payload,
        }),
      })
    )
  })
})
