import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest"
import { notificationPreferencesSchema, privacySettingsSchema } from "@/types/user-settings"
import { realPrisma, disconnectRealDb } from "./setup-real-db"
import { TEST_USERS } from "../helpers/test-data"
import { setCurrentTestUser, resetMocks } from "../__mocks__/supabase"

type UpdateProfile = typeof import("@/app/actions/settings")["updateProfile"]
type UpdateNotificationPreferences = typeof import("@/app/actions/settings")["updateNotificationPreferences"]
type UpdatePrivacySettings = typeof import("@/app/actions/settings")["updatePrivacySettings"]

vi.doUnmock("@/lib/prisma")
vi.mock("@/lib/prisma", () => ({
  prisma: realPrisma,
  default: realPrisma,
}))

let updateProfile: UpdateProfile
let updateNotificationPreferences: UpdateNotificationPreferences
let updatePrivacySettings: UpdatePrivacySettings

const userFixture = TEST_USERS.user

async function ensureTestUser() {
  await realPrisma.user.upsert({
    where: { id: userFixture.id },
    update: {
      email: userFixture.email,
      name: userFixture.name,
      role: "USER",
      status: "ACTIVE",
      lastLoginAt: new Date(),
      updatedAt: new Date(),
    },
    create: {
      id: userFixture.id,
      email: userFixture.email,
      name: userFixture.name,
      role: "USER",
      status: "ACTIVE",
      lastLoginAt: new Date(),
      updatedAt: new Date(),
    },
  })
}

describe("用户设置 Server Actions 集成", () => {
  beforeAll(async () => {
    const actions = await import("@/app/actions/settings")
    updateProfile = actions.updateProfile
    updateNotificationPreferences = actions.updateNotificationPreferences
    updatePrivacySettings = actions.updatePrivacySettings

    await ensureTestUser()
  })

  afterAll(async () => {
    await realPrisma.user.deleteMany({ where: { id: userFixture.id } })
    await disconnectRealDb()
    resetMocks()
  })

  beforeEach(() => {
    setCurrentTestUser("user")
    return ensureTestUser()
  })

  it("保存个人资料、隐私与通知偏好并持久化", async () => {
    const profileResult = await updateProfile(userFixture.id, {
      location: "San Jose, CA",
      phone: "+1 415 555 0000",
      bio: "Integration test user",
    })

    expect(profileResult.success).toBe(true)

    const notificationResult = await updateNotificationPreferences(userFixture.id, {
      LIKE: false,
      COMMENT: true,
      FOLLOW: false,
      SYSTEM: true,
    })

    expect(notificationResult.success).toBe(true)

    const privacyResult = await updatePrivacySettings(userFixture.id, {
      profileVisibility: "followers",
      showEmail: true,
      showLocation: true,
      showPhone: false,
    })

    expect(privacyResult.success).toBe(true)

    const record = await realPrisma.user.findUniqueOrThrow({
      where: { id: userFixture.id },
      select: {
        location: true,
        phone: true,
        bio: true,
        notificationPreferences: true,
        privacySettings: true,
      },
    })

    expect(record.location).toBe("San Jose, CA")
    expect(record.phone).toBe("+1 415 555 0000")
    expect(record.bio).toBe("Integration test user")

    expect(notificationPreferencesSchema.parse(record.notificationPreferences)).toMatchObject({
      LIKE: false,
      COMMENT: true,
      FOLLOW: false,
      SYSTEM: true,
    })

    expect(privacySettingsSchema.parse(record.privacySettings)).toMatchObject({
      profileVisibility: "followers",
      showEmail: true,
      showLocation: true,
      showPhone: false,
    })
  })

  it("无效输入应被 Zod 拦截", async () => {
    const invalidProfile = await updateProfile(userFixture.id, {
      phone: "bad-number#",
    })

    expect(invalidProfile.success).toBe(false)
    if (!invalidProfile.success) {
      expect(invalidProfile.code).toBe("VALIDATION_ERROR")
      expect(invalidProfile.field).toBe("phone")
    }

    const invalidPreferences = await updateNotificationPreferences(userFixture.id, {
      LIKE: "yes",
    } as any)

    expect(invalidPreferences.success).toBe(false)
    if (!invalidPreferences.success) {
      expect(invalidPreferences.code).toBe("VALIDATION_ERROR")
    }
  })
})
