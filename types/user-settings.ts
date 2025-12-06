import { z } from "zod"
import { NotificationType } from "@/lib/generated/prisma"

const SAFE_PROTOCOLS = ["http:", "https:", "mailto:"]

const socialLinkUrlSchema = z
  .string()
  .trim()
  .url("链接格式不正确")
  .max(200, "链接长度不能超过 200 个字符")
  .refine((value) => {
    try {
      const protocol = new URL(value).protocol
      return SAFE_PROTOCOLS.includes(protocol)
    } catch {
      return false
    }
  }, "仅支持 http/https/mailto 链接")

const optionalSocialLinkSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value
  const trimmed = value.trim()
  return trimmed === "" ? undefined : trimmed
}, socialLinkUrlSchema.optional())

export const socialLinksSchema = z.object({
  website: optionalSocialLinkSchema,
  github: optionalSocialLinkSchema,
  twitter: optionalSocialLinkSchema,
  linkedin: optionalSocialLinkSchema,
  email: optionalSocialLinkSchema,
})

export type SocialLinksInput = z.input<typeof socialLinksSchema>
export type SocialLinks = z.output<typeof socialLinksSchema>

export const notificationPreferenceDefaults: Record<NotificationType, boolean> = {
  LIKE: true,
  COMMENT: true,
  FOLLOW: true,
  SYSTEM: true,
  NEW_POST: true,
}

const notificationPreferencesBaseSchema = z
  .object({
    LIKE: z.boolean().optional(),
    COMMENT: z.boolean().optional(),
    FOLLOW: z.boolean().optional(),
    SYSTEM: z.boolean().optional(),
    NEW_POST: z.boolean().optional(),
  })
  .default({})

export const notificationPreferencesSchema = notificationPreferencesBaseSchema.transform((value) => ({
  ...notificationPreferenceDefaults,
  ...value,
}))

export type NotificationPreferencesInput = z.input<typeof notificationPreferencesBaseSchema>
export type NotificationPreferences = z.output<typeof notificationPreferencesSchema>
export type EmailSubscriptionPreferences = Partial<Record<NotificationType, boolean>>

export const resolveNotificationPreference = (
  prefs: NotificationPreferencesInput | null | undefined,
  type: NotificationType
): boolean => notificationPreferencesSchema.parse(prefs)[type]

export const privacySettingsDefaults = {
  profileVisibility: "public" as const,
  showEmail: false,
  showPhone: false,
  showLocation: false,
}

const privacySettingsBaseSchema = z
  .object({
    profileVisibility: z.enum(["public", "followers", "private"]).optional(),
    showEmail: z.boolean().optional(),
    showPhone: z.boolean().optional(),
    showLocation: z.boolean().optional(),
  })
  .default({})

export const privacySettingsSchema = privacySettingsBaseSchema.transform((value) => ({
  ...privacySettingsDefaults,
  ...value,
}))

export type PrivacySettingsInput = z.input<typeof privacySettingsBaseSchema>
export type PrivacySettings = z.output<typeof privacySettingsSchema>

export const userSettingsSchema = z.object({
  location: z.string().trim().max(200).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  notificationPreferences: notificationPreferencesSchema,
  privacySettings: privacySettingsSchema,
})

export type UserSettingsInput = z.input<typeof userSettingsSchema>
export type UserSettings = z.output<typeof userSettingsSchema>
