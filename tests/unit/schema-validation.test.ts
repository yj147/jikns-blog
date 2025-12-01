import fs from "fs"
import path from "path"
import { describe, expect, it } from "vitest"
import { Prisma, NotificationType } from "@/lib/generated/prisma"
import {
  notificationPreferenceDefaults,
  notificationPreferencesSchema,
  privacySettingsDefaults,
  privacySettingsSchema,
  resolveNotificationPreference,
  userSettingsSchema,
} from "@/types/user-settings"
import {
  isNotificationUnread,
  normalizeNotification,
  notificationSchema,
  notificationTypeSchema,
} from "@/types/notification"

const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma")

describe("Prisma schema 用户设置扩展", () => {
  it("User 模型新增字段与默认值已生效", () => {
    const userModel = Prisma.dmmf.datamodel.models.find((model) => model.name === "User")
    expect(userModel).toBeDefined()

    const locationField = userModel?.fields.find((field) => field.name === "location")
    const phoneField = userModel?.fields.find((field) => field.name === "phone")
    const notificationPreferencesField = userModel?.fields.find(
      (field) => field.name === "notificationPreferences"
    )
    const privacySettingsField = userModel?.fields.find((field) => field.name === "privacySettings")

    expect(locationField?.isRequired).toBe(false)
    expect(phoneField?.isRequired).toBe(false)
    expect(notificationPreferencesField?.type).toBe("Json")
    expect(notificationPreferencesField?.hasDefaultValue).toBe(true)
    expect(notificationPreferencesField?.default).toBe("{}")
    expect(privacySettingsField?.type).toBe("Json")
    expect(privacySettingsField?.hasDefaultValue).toBe(true)
    expect(privacySettingsField?.default).toBe("{}")
  })

  it("Notification 模型与枚举定义正确映射", () => {
    const notificationModel = Prisma.dmmf.datamodel.models.find(
      (model) => model.name === "Notification"
    )
    const fieldNames = notificationModel?.fields.map((field) => field.name)

    expect(fieldNames).toEqual(
      expect.arrayContaining([
        "id",
        "recipientId",
        "actorId",
        "type",
        "readAt",
        "createdAt",
        "postId",
        "commentId",
      ])
    )

    const actorRelation = notificationModel?.fields.find((field) => field.name === "actor")
    const recipientRelation = notificationModel?.fields.find((field) => field.name === "recipient")
    const postRelation = notificationModel?.fields.find((field) => field.name === "post")
    const commentRelation = notificationModel?.fields.find((field) => field.name === "comment")

    expect(actorRelation?.relationName).toBe("NotificationActor")
    expect(recipientRelation?.relationName).toBe("NotificationRecipient")
    expect(postRelation?.relationName).toBe("NotificationPost")
    expect(commentRelation?.relationName).toBe("NotificationComment")
  })

  it("@@index([recipientId, readAt]) 已写入 schema 文件", () => {
    const schemaContent = fs.readFileSync(schemaPath, "utf8")
    expect(schemaContent.includes("@@index([recipientId, readAt])")).toBe(true)
  })

  it("NotificationType 枚举值完整且可验证", () => {
    expect(notificationTypeSchema.safeParse(NotificationType.LIKE).success).toBe(true)
    expect(notificationTypeSchema.safeParse("UNKNOWN").success).toBe(false)
  })
})

describe("用户设置类型守护", () => {
  it("notificationPreferences 默认全量开启并可覆盖", () => {
    const defaults = notificationPreferencesSchema.parse(undefined)
    expect(defaults).toEqual(notificationPreferenceDefaults)

    const custom = notificationPreferencesSchema.parse({ LIKE: false, SYSTEM: false })
    expect(custom).toMatchObject({ LIKE: false, SYSTEM: false, COMMENT: true, FOLLOW: true })

    expect(resolveNotificationPreference({}, NotificationType.COMMENT)).toBe(true)
    expect(resolveNotificationPreference({ LIKE: false }, NotificationType.LIKE)).toBe(false)
  })

  it("privacySettings 默认值与覆盖逻辑", () => {
    const defaults = privacySettingsSchema.parse(undefined)
    expect(defaults).toEqual(privacySettingsDefaults)

    const custom = privacySettingsSchema.parse({ profileVisibility: "private", showEmail: true })
    expect(custom.profileVisibility).toBe("private")
    expect(custom.showEmail).toBe(true)
    expect(custom.showPhone).toBe(false)
  })

  it("userSettingsSchema 合并嵌套设置并校验联系信息", () => {
    const parsed = userSettingsSchema.parse({
      location: "San Francisco",
      phone: null,
      notificationPreferences: { FOLLOW: false },
      privacySettings: { showLocation: true },
    })

    expect(parsed.location).toBe("San Francisco")
    expect(parsed.phone).toBeNull()
    expect(parsed.notificationPreferences.FOLLOW).toBe(false)
    expect(parsed.notificationPreferences.SYSTEM).toBe(true)
    expect(parsed.privacySettings.showLocation).toBe(true)
    expect(parsed.privacySettings.profileVisibility).toBe("public")
  })
})

describe("通知类型守护", () => {
  it("normalizeNotification 支持字符串时间并保持可选外键", () => {
    const normalized = normalizeNotification({
      id: "00000000-0000-0000-0000-000000000001",
      recipientId: "00000000-0000-0000-0000-000000000002",
      actorId: "00000000-0000-0000-0000-000000000003",
      type: NotificationType.FOLLOW,
      readAt: null,
      createdAt: "2025-01-01T00:00:00.000Z",
      postId: null,
      commentId: undefined,
    })

    expect(normalized.createdAt).toBeInstanceOf(Date)
    expect(normalized.readAt).toBeNull()
    expect(isNotificationUnread(normalized)).toBe(true)
  })

  it("已读通知识别", () => {
    const normalized = normalizeNotification({
      id: "00000000-0000-0000-0000-000000000010",
      recipientId: "00000000-0000-0000-0000-000000000011",
      actorId: "00000000-0000-0000-0000-000000000012",
      type: NotificationType.COMMENT,
      readAt: "2025-02-02T10:00:00.000Z",
      createdAt: new Date(),
      postId: "00000000-0000-0000-0000-000000000099",
    })

    expect(isNotificationUnread(normalized)).toBe(false)
  })

  it("非法枚举值会被拒绝", () => {
    const result = notificationSchema.safeParse({
      id: "00000000-0000-0000-0000-000000000020",
      recipientId: "00000000-0000-0000-0000-000000000021",
      actorId: "00000000-0000-0000-0000-000000000022",
      type: "INVALID",
      createdAt: new Date().toISOString(),
    })

    expect(result.success).toBe(false)
  })
})
