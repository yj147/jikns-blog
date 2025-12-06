export type CommentTargetType = "post" | "activity"

export interface CommentAuthor {
  id: string
  name: string | null
  avatarUrl: string | null
}

export interface CommentCounts {
  replies: number
}

export interface CommentStats {
  likesCount: number
  repliesCount: number
}

export interface CommentBase {
  id: string
  content: string
  targetType: CommentTargetType
  targetId: string
  parentId: string | null
  authorId: string
  postId: string | null
  activityId: string | null
  isDeleted?: boolean
  deletedAt: string | Date | null
  createdAt: string | Date
  updatedAt: string | Date
}

export interface CommentRelations {
  author?: CommentAuthor | null
  parent?: {
    id: string
    content: string
    author: Pick<CommentAuthor, "id" | "name">
  } | null
  post?: {
    id: string
    title: string
    slug: string
  } | null
  activity?: {
    id: string
    content: string
  } | null
}

export interface CommentComputed {
  replies?: Comment[]
  _count?: CommentCounts
  childrenCount?: number
  canEdit?: boolean
  canDelete?: boolean
  stats?: CommentStats
}

export type Comment = CommentBase & CommentRelations & CommentComputed

export type CommentRealtimePayload = CommentBase &
  Pick<CommentRelations, "author"> &
  Partial<CommentComputed>
