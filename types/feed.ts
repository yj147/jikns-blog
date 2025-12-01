import { z } from "zod"
import type { Role, UserStatus } from "@/lib/generated/prisma"

export const adminFeedActionSchema = z.object({
  action: z.enum(["delete", "pin", "unpin", "hide", "unhide"]),
  ids: z.array(z.string().min(1)).nonempty().max(50),
})

export type AdminFeedActionInput = z.infer<typeof adminFeedActionSchema>

export interface FeedAuthor {
  id: string
  name: string | null
  email: string | null
  role: Role
  status: UserStatus
}

export interface FeedItem {
  id: string
  authorId: string
  content: string
  imageUrls: string[]
  isPinned: boolean
  deletedAt: string | null
  likesCount: number
  commentsCount: number
  viewsCount: number
  createdAt: string
  updatedAt: string
  author: FeedAuthor
}

export interface FeedListResponse {
  feeds: FeedItem[]
  pagination: {
    currentPage: number
    totalPages: number
    totalCount: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export interface FeedActionResult {
  affected: number
  action: AdminFeedActionInput["action"]
}
