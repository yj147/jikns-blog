import { createHmac, timingSafeEqual } from "node:crypto"
import { logger } from "@/lib/utils/logger"

/**
 * 关注系统游标编码/解码工具
 *
 * Linus 原则：消除重复实现
 * 服务端统一使用这个工具，避免二次实现风险
 */

/**
 * 游标数据结构
 */
export interface CursorData {
  createdAt: Date
  id: string
}

/**
 * 游标解码错误
 */
export class CursorDecodeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CursorDecodeError"
  }
}

const CURSOR_VERSION = 1
const SECRET_ENV_KEY = "FOLLOW_CURSOR_SECRET"
const ALLOW_LEGACY_ENV_KEY = "ALLOW_LEGACY_FOLLOW_CURSOR"

type SignedCursorPayload = {
  version: number
  createdAt: string
  id: string
}

type SignedCursorEnvelope = SignedCursorPayload & {
  signature: string
}

let cachedSecret: string | null = null
let legacyWarningIssued = false

function isLegacyCursorAllowed(): boolean {
  const raw = process.env[ALLOW_LEGACY_ENV_KEY]
  const allowed = typeof raw === "string" && raw.toLowerCase() === "true"

  if (allowed && !legacyWarningIssued && process.env.NODE_ENV !== "test") {
    legacyWarningIssued = true
    logger.warn("ALLOW_LEGACY_FOLLOW_CURSOR 已启用，仅用于紧急兼容，请尽快撤销并清理旧游标")
  }

  return allowed
}

function getCursorSecret(): string {
  if (cachedSecret) {
    return cachedSecret
  }

  const secret = process.env[SECRET_ENV_KEY]
  if (!secret || secret.trim().length === 0) {
    throw new Error(`Missing ${SECRET_ENV_KEY} environment variable for follow cursor signing`)
  }

  cachedSecret = secret
  return cachedSecret
}

function normaliseSignatureInput(envelope: SignedCursorEnvelope): SignedCursorPayload {
  return {
    version: typeof envelope.version === "number" ? envelope.version : CURSOR_VERSION,
    createdAt: envelope.createdAt,
    id: envelope.id,
  }
}

function signPayload(payload: SignedCursorPayload): string {
  return createHmac("sha256", getCursorSecret()).update(JSON.stringify(payload)).digest("hex")
}

function verifySignature(envelope: SignedCursorEnvelope): void {
  const payload = normaliseSignatureInput(envelope)
  const expected = signPayload(payload)

  try {
    const providedBuffer = Buffer.from(envelope.signature, "hex")
    const expectedBuffer = Buffer.from(expected, "hex")

    if (providedBuffer.length !== expectedBuffer.length) {
      throw new Error("signature length mismatch")
    }

    if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
      throw new Error("signature mismatch")
    }
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "invalid signature")
  }
}

function parseIsoDate(value: string): Date {
  const createdAt = new Date(value)
  if (Number.isNaN(createdAt.getTime())) {
    throw new Error("invalid date")
  }
  return createdAt
}

function parseLegacyCursor(data: unknown): CursorData {
  if (!data || typeof data !== "object") {
    throw new Error("invalid structure")
  }

  const record = data as { createdAt?: unknown; id?: unknown }

  if (typeof record.createdAt !== "string" || typeof record.id !== "string") {
    throw new Error("missing fields")
  }

  return {
    createdAt: parseIsoDate(record.createdAt),
    id: record.id,
  }
}

function parseSignedCursor(data: unknown): CursorData {
  if (!data || typeof data !== "object") {
    throw new Error("invalid structure")
  }

  const record = data as {
    createdAt?: unknown
    id?: unknown
    signature?: unknown
    version?: unknown
  }

  if (
    typeof record.createdAt !== "string" ||
    typeof record.id !== "string" ||
    typeof record.signature !== "string"
  ) {
    throw new Error("missing fields")
  }

  const envelope: SignedCursorEnvelope = {
    version: typeof record.version === "number" ? record.version : CURSOR_VERSION,
    createdAt: record.createdAt,
    id: record.id,
    signature: record.signature,
  }

  verifySignature(envelope)

  return {
    createdAt: parseIsoDate(envelope.createdAt),
    id: envelope.id,
  }
}

/**
 * 编码关注游标（带签名）
 *
 * @param createdAt - 关注时间
 * @param id - 用户 ID
 * @returns Base64 编码且附带签名的游标字符串
 */
export function encodeFollowCursor(createdAt: Date, id: string): string {
  const payload: SignedCursorPayload = {
    version: CURSOR_VERSION,
    createdAt: createdAt.toISOString(),
    id,
  }

  const envelope: SignedCursorEnvelope = {
    ...payload,
    signature: signPayload(payload),
  }

  return Buffer.from(JSON.stringify(envelope)).toString("base64")
}

/**
 * 解码关注游标
 *
 * @param cursor - Base64 编码的游标字符串
 * @returns 解码后的游标数据
 * @throws {CursorDecodeError} 当游标格式或签名无效时
 */
export function decodeFollowCursor(cursor: string): CursorData {
  try {
    const decoded = Buffer.from(cursor, "base64").toString("utf-8")
    const data = JSON.parse(decoded) as Record<string, unknown>

    if (typeof data?.signature === "string") {
      return parseSignedCursor(data)
    }

    if (!isLegacyCursorAllowed()) {
      throw new Error(
        "unsigned cursor rejected; enable ALLOW_LEGACY_FOLLOW_CURSOR=true temporarily if rollout requires"
      )
    }

    return parseLegacyCursor(data)
  } catch (error) {
    throw new CursorDecodeError(
      `Invalid pagination cursor: ${error instanceof Error ? error.message : "unknown error"}`
    )
  }
}
