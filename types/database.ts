/**
 * 数据库类型定义
 * 基于 Prisma schema 的增强类型
 */

import { Prisma } from "@prisma/client"

// ============================================================================
// 基础数据模型类型
// ============================================================================

export type User = Prisma.UserGetPayload<{
  select: {
    id: true
    email: true
    name: true
    avatarUrl: true
    bio: true
    socialLinks: true
    role: true
    status: true
    createdAt: true
    updatedAt: true
    lastLoginAt: true
  }
}>

export type Post = Prisma.PostGetPayload<{
  select: {
    id: true
    slug: true
    title: true
    content: true
    excerpt: true
    published: true
    isPinned: true
    canonicalUrl: true
    seoTitle: true
    seoDescription: true
    viewCount: true
    createdAt: true
    updatedAt: true
    publishedAt: true
    authorId: true
    seriesId: true
  }
}>

// ============================================================================
// 增强的数据模型类型（包含关联）
// ============================================================================

export type PostWithAuthor = Prisma.PostGetPayload<{
  include: {
    author: {
      select: {
        id: true
        name: true
        email: true
        avatarUrl: true
        bio: true
      }
    }
  }
}>

export type PostWithDetails = Prisma.PostGetPayload<{
  include: {
    author: {
      select: {
        id: true
        name: true
        email: true
        avatarUrl: true
        bio: true
      }
    }
    series: {
      select: {
        id: true
        title: true
        slug: true
        description: true
      }
    }
    tags: {
      include: {
        tag: {
          select: {
            id: true
            name: true
            slug: true
            color: true
          }
        }
      }
    }
    _count: {
      select: {
        comments: true
        likes: true
        bookmarks: true
      }
    }
  }
}>

export type PostWithFullDetails = Prisma.PostGetPayload<{
  include: {
    author: true
    series: true
    tags: {
      include: {
        tag: true
      }
    }
    comments: {
      include: {
        author: {
          select: {
            id: true
            name: true
            avatarUrl: true
          }
        }
        replies: {
          include: {
            author: {
              select: {
                id: true
                name: true
                avatarUrl: true
              }
            }
          }
        }
      }
    }
    likes: {
      include: {
        author: {
          select: {
            id: true
            name: true
          }
        }
      }
    }
    bookmarks: true
    _count: {
      select: {
        comments: true
        likes: true
        bookmarks: true
      }
    }
  }
}>

export type UserWithStats = Prisma.UserGetPayload<{
  include: {
    _count: {
      select: {
        posts: true
        activities: true
        comments: true
        likes: true
        bookmarks: true
        followers: true
        following: true
      }
    }
  }
}>

export type TagWithCount = Prisma.TagGetPayload<{
  select: {
    id: true
    name: true
    slug: true
    description: true
    color: true
    postsCount: true
    createdAt: true
    updatedAt: true
  }
}>

export type SeriesWithPosts = Prisma.SeriesGetPayload<{
  include: {
    posts: {
      select: {
        id: true
        title: true
        slug: true
        excerpt: true
        published: true
        publishedAt: true
        viewCount: true
      }
      where: {
        published: true
      }
      orderBy: {
        publishedAt: "asc"
      }
    }
    author: {
      select: {
        id: true
        name: true
        avatarUrl: true
      }
    }
    _count: {
      select: {
        posts: true
      }
    }
  }
}>

// ============================================================================
// API 输入类型
// ============================================================================

export type CreatePostInput = {
  title: string
  content: string
  excerpt?: string
  published?: boolean
  publishedAt?: Date
  canonicalUrl?: string
  seoTitle?: string
  seoDescription?: string
  seriesId?: string
  tagNames?: string[]
}

export type UpdatePostInput = Partial<CreatePostInput> & {
  id: string
  slug?: string
}

export type GetPostsParams = {
  published?: boolean
  authorId?: string
  seriesId?: string
  tag?: string
  search?: string
  cursor?: string
  limit?: number
  orderBy?: "publishedAt" | "createdAt" | "updatedAt" | "viewCount"
  order?: "asc" | "desc"
}

// ============================================================================
// API 返回类型
// ============================================================================

export type ApiResult<T> = {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: unknown
  }
}

export type PaginatedResult<T> = {
  items: T[]
  nextCursor?: string
  hasMore: boolean
  total: number
}

// ============================================================================
// 数据库查询构建器类型
// ============================================================================

export type PostWhereInput = Prisma.PostWhereInput
export type PostOrderByInput = Prisma.PostOrderByWithRelationInput
export type PostInclude = Prisma.PostInclude
export type PostSelect = Prisma.PostSelect

export type UserWhereInput = Prisma.UserWhereInput
export type UserOrderByInput = Prisma.UserOrderByWithRelationInput
export type UserInclude = Prisma.UserInclude
export type UserSelect = Prisma.UserSelect

// ============================================================================
// 实用类型
// ============================================================================

export type PostStatus = "draft" | "published"
export type SortOrder = "asc" | "desc"

export interface PostListItem {
  id: string
  title: string
  slug: string
  excerpt: string | null
  published: boolean
  isPinned: boolean
  viewCount: number
  publishedAt: Date | null
  createdAt: Date
  author: {
    id: string
    name: string | null
    avatarUrl: string | null
  }
  tags: Array<{
    name: string
    slug: string
    color: string | null
  }>
  _count: {
    comments: number
    likes: number
    bookmarks: number
  }
}

export interface PostSEOData {
  title: string
  description: string | null
  canonicalUrl: string | null
  publishedAt: Date | null
  modifiedAt: Date
  authorName: string | null
  tags: string[]
  excerpt: string | null
}

// ============================================================================
// Supabase 数据库类型（用于 Supabase 客户端）
// ============================================================================

export interface Database {
  public: {
    Tables: {
      users: {
        Row: User
        Insert: Omit<User, "id" | "createdAt" | "updatedAt">
        Update: Partial<Omit<User, "id" | "createdAt" | "updatedAt">>
      }
      posts: {
        Row: Post
        Insert: Omit<Post, "id" | "createdAt" | "updatedAt">
        Update: Partial<Omit<Post, "id" | "createdAt" | "updatedAt">>
      }
      // 可以根据需要添加其他表
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      Role: "USER" | "ADMIN"
      UserStatus: "ACTIVE" | "BANNED"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// ============================================================================
// 枚举类型导出
// ============================================================================

export { Role, UserStatus } from "@prisma/client"
