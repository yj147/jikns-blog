"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { fetchGet, fetchJson, FetchError } from "@/lib/api/fetch-json"
import { useToast } from "@/components/ui/use-toast"
import {
  Search,
  Users,
  UserCheck,
  UserX,
  Shield,
  UserPlus,
  MoreHorizontal,
  Loader2,
} from "lucide-react"

type UserRole = "ADMIN" | "USER"
type UserStatus = "ACTIVE" | "BANNED"

interface AdminUserRecord {
  id: string
  name: string | null
  email: string
  role: UserRole
  status: UserStatus
  avatarUrl: string | null
  createdAt: string
  lastLoginAt: string | null
  _count: {
    posts: number
    activities: number
    comments: number
  }
}

interface UsersResponse {
  users: AdminUserRecord[]
  pagination: {
    page: number
    limit: number
    totalCount: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
  summary: {
    totalUsers: number
    activeUsers: number
    bannedUsers: number
    adminUsers: number
  }
}

const DEFAULT_PAGINATION = {
  page: 1,
  limit: 20,
  totalCount: 0,
  totalPages: 1,
  hasNext: false,
  hasPrev: false,
}

const DEFAULT_SUMMARY = {
  totalUsers: 0,
  activeUsers: 0,
  bannedUsers: 0,
  adminUsers: 0,
}

export default function AdminUsersPage() {
  const { toast } = useToast()
  const [query, setQuery] = useState({ search: "", status: "all", role: "all", page: 1 })
  const [searchInput, setSearchInput] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [users, setUsers] = useState<AdminUserRecord[]>([])
  const [pagination, setPagination] = useState(DEFAULT_PAGINATION)
  const [summary, setSummary] = useState(DEFAULT_SUMMARY)
  const [actionUserId, setActionUserId] = useState<string | null>(null)

  const loadUsers = useCallback(
    async (params = query) => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetchGet<{ data?: UsersResponse }>("/api/admin/users", {
          page: params.page,
          limit: DEFAULT_PAGINATION.limit,
          search: params.search || undefined,
          status: params.status !== "all" ? params.status : undefined,
          role: params.role !== "all" ? params.role : undefined,
        })

        const payload = ((response as any)?.data ?? response) as UsersResponse
        setUsers(payload.users)
        setPagination(payload.pagination ?? DEFAULT_PAGINATION)
        setSummary(payload.summary ?? DEFAULT_SUMMARY)
      } catch (error) {
        const message = error instanceof FetchError ? error.message : "加载用户失败"
        setError(message)
        setUsers([])
      } finally {
        setLoading(false)
      }
    },
    [query]
  )

  useEffect(() => {
    loadUsers(query)
  }, [query, loadUsers])

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setQuery((prev) => ({ ...prev, search: searchInput.trim(), page: 1 }))
  }

  const handleStatusChange = (value: string) => {
    setQuery((prev) => ({ ...prev, status: value, page: 1 }))
  }

  const handleRoleChange = (value: string) => {
    setQuery((prev) => ({ ...prev, role: value, page: 1 }))
  }

  const handlePageChange = (direction: "prev" | "next") => {
    setQuery((prev) => ({ ...prev, page: Math.max(1, prev.page + (direction === "next" ? 1 : -1)) }))
  }

  const updateUser = async (userId: string, payload: Record<string, any>, successMessage: string) => {
    try {
      setActionUserId(userId)
      await fetchJson(`/api/admin/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      })
      toast({ title: successMessage })
      await loadUsers({ ...query })
    } catch (error) {
      const message = error instanceof FetchError ? error.message : "操作失败"
      toast({ variant: "destructive", title: message })
    } finally {
      setActionUserId(null)
    }
  }

  const summaryCards = useMemo(
    () => [
      { title: "总用户", value: summary.totalUsers, icon: <Users className="h-4 w-4" /> },
      { title: "活跃用户", value: summary.activeUsers, icon: <UserCheck className="h-4 w-4" /> },
      { title: "封禁用户", value: summary.bannedUsers, icon: <UserX className="h-4 w-4" /> },
      { title: "管理员", value: summary.adminUsers, icon: <Shield className="h-4 w-4" /> },
    ],
    [summary]
  )

  return (
    <div className="bg-background min-h-screen">

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="mb-1 text-3xl font-bold">用户管理</h1>
            <p className="text-muted-foreground">管理账号、角色与状态，所有数据均来自实时 API</p>
          </div>
          <Button variant="outline">
            <UserPlus className="mr-2 h-4 w-4" /> 邀请用户
          </Button>
        </div>

        <section className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {summaryCards.map((card) => (
            <Card key={card.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <span className="text-muted-foreground">{card.icon}</span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value.toLocaleString()}</div>
              </CardContent>
            </Card>
          ))}
        </section>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>筛选与搜索</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearchSubmit} className="grid gap-4 md:grid-cols-3">
              <div>
                <Label htmlFor="search">关键词</Label>
                <div className="relative mt-2">
                  <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                  <Input
                    id="search"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="搜索姓名或邮箱"
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="status">状态</Label>
                <Select defaultValue="all" value={query.status} onValueChange={handleStatusChange}>
                  <SelectTrigger id="status" className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="ACTIVE">活跃</SelectItem>
                    <SelectItem value="BANNED">已封禁</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="role">角色</Label>
                <Select defaultValue="all" value={query.role} onValueChange={handleRoleChange}>
                  <SelectTrigger id="role" className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="ADMIN">管理员</SelectItem>
                    <SelectItem value="USER">普通用户</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-3">
                <Button type="submit" className="w-full md:w-auto">
                  <Search className="mr-2 h-4 w-4" /> 搜索
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>用户列表</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {error}
              </div>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用户</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>内容统计</TableHead>
                  <TableHead>最近活跃</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                      暂无符合条件的用户
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name ?? user.email} />
                            <AvatarFallback>{user.name?.charAt(0) ?? user.email[0]}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold">{user.name ?? "未设置昵称"}</p>
                            <p className="text-muted-foreground text-sm">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.role === "ADMIN" ? (
                          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">管理员</Badge>
                        ) : (
                          <Badge variant="secondary">用户</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.status === "ACTIVE" ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">活跃</Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">已封禁</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <div className="flex gap-3">
                          <span>文章 {user._count.posts}</span>
                          <span>动态 {user._count.activities}</span>
                          <span>评论 {user._count.comments}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              {actionUserId === user.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreHorizontal className="h-4 w-4" />
                              )}
                              <span className="sr-only">打开操作菜单</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {user.status === "ACTIVE" ? (
                              <DropdownMenuItem onClick={() => updateUser(user.id, { status: "BANNED" }, "用户已封禁")}>封禁</DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => updateUser(user.id, { status: "ACTIVE" }, "用户已解封")}>解除封禁</DropdownMenuItem>
                            )}
                            {user.role === "ADMIN" ? (
                              <DropdownMenuItem onClick={() => updateUser(user.id, { role: "USER" }, "已降级为普通用户")}>
                                设为普通用户
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => updateUser(user.id, { role: "ADMIN" }, "已授予管理员权限")}>
                                提升为管理员
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between border-t pt-4 text-sm">
              <span>
                第 {pagination.page} / {pagination.totalPages} 页，共 {pagination.totalCount} 人
              </span>
              <div className="space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange("prev")}
                  disabled={loading || !pagination.hasPrev}
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange("next")}
                  disabled={loading || !pagination.hasNext}
                >
                  下一页
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
