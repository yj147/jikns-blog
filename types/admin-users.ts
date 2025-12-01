export type AdminUserStatus = "ACTIVE" | "BANNED"
export type AdminUserRole = "USER" | "AUTHOR" | "ADMIN"
export type StatusFilter = AdminUserStatus | "INACTIVE" | "all"
export type RoleFilter = AdminUserRole | "all"

export interface AdminUserMetrics {
  posts: number
  comments: number
  activities: number
}

export interface AdminUserListItem {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  role: AdminUserRole
  status: AdminUserStatus
  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
  metrics: AdminUserMetrics
}

export interface AdminUsersPagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasMore: boolean
}

export interface AdminUsersSummary {
  totalUsers: number
  activeUsers: number
  adminUsers: number
  todayNewUsers: number
  bannedUsers: number
}

export interface AdminUsersQuery {
  page?: number
  limit?: number
  status?: StatusFilter
  role?: RoleFilter
  search?: string | null
}

export interface AdminUsersPayload {
  users: AdminUserListItem[]
  pagination: AdminUsersPagination
  summary: AdminUsersSummary
}
