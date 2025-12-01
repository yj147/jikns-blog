import { Prisma } from "@/lib/generated/prisma"
import { prisma } from "@/lib/prisma"

// SEO 配置
export interface SeoMeta {
  title: string
  description: string
  keywords: string[]
}

// 注册开关
export interface RegistrationToggle {
  enabled: boolean
}

export type Json = Prisma.JsonValue

// 获取所有系统设置
export async function getAllSettings(): Promise<Record<string, Json>> {
  const records = await prisma.systemSetting.findMany({
    select: { key: true, value: true },
  })

  return records.reduce<Record<string, Json>>((acc, record) => {
    acc[record.key] = record.value as Json
    return acc
  }, {})
}

// 获取单个设置
export async function getSetting<T>(key: string): Promise<T | null> {
  const record = await prisma.systemSetting.findUnique({
    where: { key },
    select: { value: true },
  })

  if (!record) {
    return null
  }

  return record.value as T
}

// 写入或更新设置
export async function setSetting(key: string, value: Json, userId: string): Promise<void> {
  const inputValue = value as Prisma.JsonNullValueInput | Prisma.InputJsonValue

  await prisma.systemSetting.upsert({
    where: { key },
    update: {
      value: inputValue,
      updatedById: userId,
    },
    create: {
      key,
      value: inputValue,
      updatedById: userId,
    },
  })
}
