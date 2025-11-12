import { z } from "zod"

export const TAG_NAME_REGEX = /^[a-zA-Z0-9\u4e00-\u9fa5\s\-_\.]+$/

export const TagNameSchema = z
  .string()
  .trim()
  .min(1, "标签名称不能为空")
  .max(50, "标签名称最多50个字符")
  .regex(TAG_NAME_REGEX, "标签名称只能包含字母、数字、中文、空格、连字符、下划线和点")

export function sanitizeTagName(raw: string): string | null {
  const result = TagNameSchema.safeParse(raw)
  if (!result.success) return null
  return result.data
}
