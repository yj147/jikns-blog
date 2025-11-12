import { appendFile, mkdir } from "fs/promises"
import { constants } from "fs"
import { access } from "fs/promises"
import path from "path"
import { logger } from "@/lib/utils/logger"

interface AuditEntry {
  requestId?: string
  ipAddress?: string
  userAgent?: string
  referer?: string
  params: Record<string, unknown>
  returnedPosts: number
  containsAuthorEmail: boolean
  timestamp: string
}

const AUDIT_DIR = path.join(process.cwd(), "monitoring-data")
const AUDIT_FILE = path.join(AUDIT_DIR, "posts-public-email-audit.log")

async function ensureAuditFile() {
  try {
    await access(AUDIT_DIR, constants.F_OK)
  } catch {
    await mkdir(AUDIT_DIR, { recursive: true })
  }
}

export async function recordPostsPublicEmailAudit(entry: Omit<AuditEntry, "timestamp">) {
  if (process.env.NEXT_RUNTIME === "edge") return

  try {
    await ensureAuditFile()
    const payload: AuditEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    }
    await appendFile(AUDIT_FILE, JSON.stringify(payload) + "\n", "utf8")
  } catch (error) {
    // 避免观测失败影响主流程
    logger.error("Failed to record posts public email audit", {}, error)
  }
}

export const POSTS_PUBLIC_EMAIL_AUDIT_LOG_PATH = AUDIT_FILE
