import {
  ADMIN_USERS_DEFAULT_LIMIT,
  ADMIN_USERS_DEFAULT_PAGE,
  getAdminUsersPayload,
  type AdminUsersPayload,
  type AdminUsersQuery,
  type RoleFilter,
  type StatusFilter,
} from "@/lib/services/admin-users"
import AdminUsersClient from "./_components/admin-users-client"

const DEFAULT_STATUS: StatusFilter = "all"
const DEFAULT_ROLE: RoleFilter = "all"

export const revalidate = 0

export default async function AdminUsersPage() {
  const initialQuery: AdminUsersQuery = {
    page: ADMIN_USERS_DEFAULT_PAGE,
    limit: ADMIN_USERS_DEFAULT_LIMIT,
    status: DEFAULT_STATUS,
    role: DEFAULT_ROLE,
    search: null,
  }

  const initialData: AdminUsersPayload = await getAdminUsersPayload(initialQuery)

  return <AdminUsersClient initialData={initialData} initialQuery={initialQuery} />
}
