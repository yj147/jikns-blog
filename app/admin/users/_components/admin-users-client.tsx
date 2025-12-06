"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import useSWR from "swr"
import { ChevronDown, Loader2, RefreshCw, Search, Shield, UserCheck, UserPlus, UserX, Users } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import { fetchJson, FetchError } from "@/lib/api/fetch-json"
import { useDebounce } from "@/hooks/use-debounce"
import type {
  AdminUserListItem,
  AdminUserRole,
  AdminUserStatus,
  AdminUsersPayload,
  AdminUsersQuery,
  RoleFilter,
  StatusFilter,
} from "@/types/admin-users"

const CLIENT_PAGE_SIZE_FALLBACK = 50

const API_BASE_PATH = "/api/admin/users"
const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "全部状态",
  ACTIVE: "活跃",
  BANNED: "已封禁",
  INACTIVE: "非活跃",
}

const ROLE_LABELS: Record<RoleFilter, string> = {
  all: "全部角色",
  USER: "普通用户",
  AUTHOR: "作者",
  ADMIN: "管理员",
}

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
})

const numberFormatter = new Intl.NumberFormat("zh-CN")

type ConfirmAction =
  | { type: "status"; user: AdminUserListItem; nextStatus: AdminUserStatus }
  | { type: "role"; user: AdminUserListItem; nextRole: AdminUserRole }

interface AdminUsersClientProps {
  initialData: AdminUsersPayload
  initialQuery: AdminUsersQuery
}

export default function AdminUsersClient({ initialData, initialQuery }: AdminUsersClientProps) {
  const { toast } = useToast()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialQuery.status ?? "all")
  const [roleFilter, setRoleFilter] = useState<RoleFilter>(initialQuery.role ?? "all")
  const [page, setPage] = useState(initialQuery.page ?? 1)
  const [searchInput, setSearchInput] = useState(initialQuery.search ?? "")
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const debouncedSearch = useDebounce(searchInput, 350)
  const pageSize = initialQuery.limit ?? initialData.pagination.limit ?? CLIENT_PAGE_SIZE_FALLBACK

  useEffect(() => {
    setPage(1)
  }, [statusFilter, roleFilter, debouncedSearch])

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    params.set("page", page.toString())
    params.set("limit", pageSize.toString())
    if (statusFilter !== "all") params.set("status", statusFilter)
    if (roleFilter !== "all") params.set("role", roleFilter)
    if (debouncedSearch) params.set("search", debouncedSearch)
    return params.toString()
  }, [page, pageSize, statusFilter, roleFilter, debouncedSearch])

  const endpoint = useMemo(() => {
    return queryString ? `${API_BASE_PATH}?${queryString}` : API_BASE_PATH
  }, [queryString])

  const { data, error, isLoading, isValidating, mutate } = useSWR<AdminUsersPayload>(
    endpoint,
    fetchAdminUsers,
    {
      fallbackData: initialData,
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  )

  const currentData = data ?? initialData
  const pagination = currentData.pagination
  const users = currentData.users
  const summary = currentData.summary
  const isFetching = isValidating && !!data
  const hasError = Boolean(error)

  const busyUserId = actionLoading && confirmAction ? confirmAction.user.id : null

  const handleRetry = useCallback(() => {
    void mutate()
  }, [mutate])

  const handleClearFilters = useCallback(() => {
    setStatusFilter("all")
    setRoleFilter("all")
    setSearchInput("")
    setPage(1)
  }, [])

  const openStatusDialog = (user: AdminUserListItem, nextStatus: AdminUserStatus) => {
    setConfirmAction({ type: "status", user, nextStatus })
  }

  const openRoleDialog = (user: AdminUserListItem, nextRole: AdminUserRole) => {
    setConfirmAction({ type: "role", user, nextRole })
  }

  const handleConfirmAction = async () => {
    if (!confirmAction) return

    const payload =
      confirmAction.type === "status"
        ? { status: confirmAction.nextStatus }
        : { role: confirmAction.nextRole }

    const successMessage = confirmAction.type === "status"
      ? confirmAction.nextStatus === "BANNED"
        ? "用户已被封禁"
        : "用户已解封"
      : confirmAction.nextRole === "ADMIN"
        ? "已提升为管理员"
        : "已降级为普通用户"

    setActionLoading(true)
    try {
      await fetchJson(`${API_BASE_PATH}/${confirmAction.user.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      })
      toast({ title: successMessage })
      await mutate()
    } catch (err) {
      const message = err instanceof FetchError ? err.message : (err as Error)?.message ?? "操作失败"
      toast({ variant: "destructive", title: message })
    } finally {
      setActionLoading(false)
      setConfirmAction(null)
    }
  }

  const errorMessage = error instanceof Error ? error.message : "加载用户失败"

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">用户管理</h1>
          <p className="text-muted-foreground">管理账号、角色与状态，所有数据实时来源于 API</p>
        </div>
        <div className="flex items-center gap-3">
          {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <Button variant="outline" onClick={() => void mutate()} disabled={isFetching}>
            <RefreshCw className="mr-2 h-4 w-4" /> 刷新
          </Button>
          <Button
            variant="secondary"
            disabled
            title="功能开发中"
            onClick={() => toast({ title: "功能开发中", description: "邀请用户功能即将推出" })}
          >
            <UserPlus className="mr-2 h-4 w-4" /> 邀请用户
          </Button>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Users className="h-4 w-4 text-muted-foreground" />} title="总用户" value={summary.totalUsers} helper={`今日新增 ${summary.todayNewUsers}`} />
        <StatCard icon={<UserCheck className="h-4 w-4 text-muted-foreground" />} title="活跃用户" value={summary.activeUsers} helper="状态为 ACTIVE" />
        <StatCard icon={<Shield className="h-4 w-4 text-muted-foreground" />} title="管理员" value={summary.adminUsers} helper="拥有管理权限" />
        <StatCard icon={<UserX className="h-4 w-4 text-muted-foreground" />} title="封禁用户" value={summary.bannedUsers} helper="需关注风险账号" />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Label className="text-sm font-medium">搜索</Label>
          <div className="relative mt-2">
            <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <Input
              className="pl-9"
              placeholder="按姓名或邮箱搜索"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>
        </div>
        <div>
          <Label className="text-sm font-medium">状态</Label>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
            <SelectTrigger className="mt-2">
              <SelectValue placeholder="选择状态" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((value) => (
                <SelectItem key={value} value={value}>
                  {STATUS_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-sm font-medium">角色</Label>
          <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as RoleFilter)}>
            <SelectTrigger className="mt-2">
              <SelectValue placeholder="选择角色" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ROLE_LABELS) as RoleFilter[]).map((value) => (
                <SelectItem key={value} value={value}>
                  {ROLE_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      {hasError && (
        <Alert variant="destructive">
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{errorMessage}</span>
            <Button variant="outline" size="sm" onClick={handleRetry}>
              重试
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>用户</TableHead>
              <TableHead>邮箱</TableHead>
              <TableHead>角色</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>注册时间</TableHead>
              <TableHead>统计</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Users className="h-6 w-6" />
                    <p>没有符合条件的用户</p>
                    <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                      重置筛选
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id} className="hover:bg-muted/30">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name ?? user.email} />
                        <AvatarFallback>{(user.name ?? user.email)[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium leading-tight">{user.name || "未命名用户"}</p>
                        <p className="text-muted-foreground text-xs">ID: {user.id.slice(0, 8)}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="font-mono text-sm">{user.email}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>{ROLE_LABELS[user.role]}</Badge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={user.status} />
                  </TableCell>
                  <TableCell>
                    <p className="text-sm">{dateFormatter.format(new Date(user.createdAt))}</p>
                    {user.lastLoginAt && (
                      <p className="text-muted-foreground text-xs">最后活跃 {dateFormatter.format(new Date(user.lastLoginAt))}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <p className="text-sm">文章 {user.metrics.posts}</p>
                    <p className="text-sm">评论 {user.metrics.comments}</p>
                    <p className="text-sm">动态 {user.metrics.activities}</p>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant={user.status === "BANNED" ? "secondary" : "destructive"}
                        size="sm"
                        onClick={() => openStatusDialog(user, user.status === "BANNED" ? "ACTIVE" : "BANNED")}
                        disabled={actionLoading}
                      >
                        {busyUserId === user.id && confirmAction?.type === "status" ? (
                          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        ) : user.status === "BANNED" ? (
                          <UserCheck className="mr-1.5 h-3.5 w-3.5" />
                        ) : (
                          <UserX className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        {user.status === "BANNED" ? "解封" : "封禁"}
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" disabled={actionLoading}>
                            {ROLE_LABELS[user.role]}
                            <ChevronDown className="ml-1 h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem
                            disabled={user.role === "ADMIN"}
                            onClick={() => openRoleDialog(user, "ADMIN")}
                          >
                            设为管理员
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={user.role === "USER"}
                            onClick={() => openRoleDialog(user, "USER")}
                          >
                            设为普通用户
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <footer className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="text-muted-foreground text-sm">
          第 {pagination.page} / {pagination.totalPages} 页 · 共 {numberFormatter.format(pagination.total)} 人
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={pagination.page <= 1 || isFetching}
          >
            上一页
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((prev) => Math.min(pagination.totalPages, prev + 1))}
            disabled={pagination.page >= pagination.totalPages || isFetching}
          >
            下一页
          </Button>
        </div>
      </footer>

      <AlertDialog
        open={Boolean(confirmAction)}
        onOpenChange={(open) => {
          if (!open && !actionLoading) {
            setConfirmAction(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{getDialogTitle(confirmAction)}</AlertDialogTitle>
            <AlertDialogDescription>{getDialogDescription(confirmAction)}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              disabled={actionLoading}
              className={confirmAction?.type === "status" && confirmAction?.nextStatus === "BANNED" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
            >
              {actionLoading ? "处理中..." : getDialogActionLabel(confirmAction)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function getDialogTitle(action: ConfirmAction | null): string {
  if (!action) return "确认操作"
  if (action.type === "status") {
    return action.nextStatus === "BANNED" ? "确认封禁用户" : "解除封禁"
  }
  return action.nextRole === "ADMIN" ? "提升为管理员" : "降级为普通用户"
}

function getDialogDescription(action: ConfirmAction | null): string {
  if (!action) return "该操作不可撤销"
  const base = `用户：${action.user?.name ?? action.user?.email}`
  if (action.type === "status") {
    return action.nextStatus === "BANNED"
      ? `${base} 将被立即封禁，无法登录。确认继续？`
      : `${base} 将恢复正常访问权限。`
  }
  return action.nextRole === "ADMIN"
    ? `${base} 将获得后台管理员权限，请谨慎授权。`
    : `${base} 将失去管理员权限。`
}

function getDialogActionLabel(action: ConfirmAction | null): string {
  if (!action) return "确认"
  if (action.type === "status") {
    return action.nextStatus === "BANNED" ? "封禁" : "解封"
  }
  return action.nextRole === "ADMIN" ? "设为管理员" : "设为普通用户"
}

function StatusBadge({ status }: { status: AdminUserStatus }) {
  if (status === "ACTIVE") {
    return <Badge variant="secondary">活跃</Badge>
  }
  return <Badge variant="destructive">已封禁</Badge>
}

function StatCard({
  title,
  value,
  helper,
  icon,
}: {
  title: string
  value: number
  helper?: string
  icon: ReactNode
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{numberFormatter.format(value)}</div>
        {helper && <p className="text-muted-foreground text-sm">{helper}</p>}
      </CardContent>
    </Card>
  )
}

async function fetchAdminUsers(url: string): Promise<AdminUsersPayload> {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store" })
  if (!response.ok) {
    throw new Error(`请求失败 (${response.status})`)
  }
  const payload = await response.json()
  if (!payload?.success || !payload?.data) {
    throw new Error(payload?.error?.message ?? "获取用户列表失败")
  }
  return payload.data as AdminUsersPayload
}
