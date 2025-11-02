import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
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
import {
  Search,
  Filter,
  MoreHorizontal,
  UserCheck,
  UserX,
  Shield,
  Mail,
  Calendar,
  Users,
  UserPlus,
} from "lucide-react"

// Mock users data
const users = [
  {
    id: 1,
    name: "张三",
    username: "@zhangsan",
    email: "zhang@example.com",
    avatar: "/author-writing.png?height=32&width=32&query=user 1",
    role: "admin",
    status: "active",
    joinDate: "2022年3月15日",
    lastActive: "2小时前",
    posts: 25,
    followers: 1234,
    verified: true,
  },
  {
    id: 2,
    name: "李四",
    username: "@lisi",
    email: "li@example.com",
    avatar: "/author-writing.png?height=32&width=32&query=user 2",
    role: "user",
    status: "active",
    joinDate: "2023年1月20日",
    lastActive: "1天前",
    posts: 12,
    followers: 456,
    verified: false,
  },
  {
    id: 3,
    name: "王五",
    username: "@wangwu",
    email: "wang@example.com",
    avatar: "/author-writing.png?height=32&width=32&query=user 3",
    role: "user",
    status: "suspended",
    joinDate: "2023年6月10日",
    lastActive: "1周前",
    posts: 8,
    followers: 123,
    verified: true,
  },
  {
    id: 4,
    name: "赵六",
    username: "@zhaoliu",
    email: "zhao@example.com",
    avatar: "/author-writing.png?height=32&width=32&query=user 4",
    role: "moderator",
    status: "active",
    joinDate: "2023年8月5日",
    lastActive: "30分钟前",
    posts: 18,
    followers: 789,
    verified: false,
  },
]

const getRoleBadge = (role: string) => {
  switch (role) {
    case "admin":
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">管理员</Badge>
    case "moderator":
      return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">版主</Badge>
    case "user":
      return <Badge variant="secondary">用户</Badge>
    default:
      return <Badge variant="outline">未知</Badge>
  }
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case "active":
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">活跃</Badge>
    case "suspended":
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">已封禁</Badge>
    case "inactive":
      return <Badge variant="secondary">不活跃</Badge>
    default:
      return <Badge variant="outline">未知</Badge>
  }
}

export default function AdminUsersPage() {
  return (
    <div className="bg-background min-h-screen">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="mb-2 text-3xl font-bold">用户管理</h1>
              <p className="text-muted-foreground">管理所有用户账户和权限</p>
            </div>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              邀请用户
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总用户数</CardTitle>
              <Users className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">12,456</div>
              <p className="text-muted-foreground text-xs">
                <span className="text-green-600">+156</span> 本月新增
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">活跃用户</CardTitle>
              <UserCheck className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">8,234</div>
              <p className="text-muted-foreground text-xs">66% 活跃率</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">已封禁</CardTitle>
              <UserX className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">23</div>
              <p className="text-muted-foreground text-xs">需要关注</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">管理员</CardTitle>
              <Shield className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">5</div>
              <p className="text-muted-foreground text-xs">系统管理员</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 md:flex-row">
              <div className="relative flex-1">
                <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform" />
                <Input placeholder="搜索用户名、邮箱..." className="pl-10" />
              </div>
              <Select>
                <SelectTrigger className="w-full md:w-48">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="角色筛选" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部角色</SelectItem>
                  <SelectItem value="admin">管理员</SelectItem>
                  <SelectItem value="moderator">版主</SelectItem>
                  <SelectItem value="user">普通用户</SelectItem>
                </SelectContent>
              </Select>
              <Select>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="状态筛选" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="active">活跃</SelectItem>
                  <SelectItem value="inactive">不活跃</SelectItem>
                  <SelectItem value="suspended">已封禁</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>用户列表</CardTitle>
            <CardDescription>管理所有用户账户</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用户</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>加入时间</TableHead>
                  <TableHead>最后活跃</TableHead>
                  <TableHead>数据</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={user.avatar || "/placeholder.svg"} alt={user.name} />
                          <AvatarFallback>{user.name[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center space-x-2">
                            <p className="font-medium">{user.name}</p>
                            {user.verified && (
                              <div className="bg-primary flex h-4 w-4 items-center justify-center rounded-full">
                                <div className="h-2 w-2 rounded-full bg-white" />
                              </div>
                            )}
                          </div>
                          <p className="text-muted-foreground text-sm">{user.username}</p>
                          <div className="text-muted-foreground flex items-center space-x-1 text-xs">
                            <Mail className="h-3 w-3" />
                            <span>{user.email}</span>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getRoleBadge(user.role)}</TableCell>
                    <TableCell>{getStatusBadge(user.status)}</TableCell>
                    <TableCell>
                      <div className="text-muted-foreground flex items-center space-x-1 text-sm">
                        <Calendar className="h-3 w-3" />
                        <span>{user.joinDate}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground text-sm">{user.lastActive}</span>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        <div>{user.posts} 文章</div>
                        <div className="text-muted-foreground">{user.followers} 关注者</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <UserCheck className="mr-2 h-4 w-4" />
                            查看详情
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Mail className="mr-2 h-4 w-4" />
                            发送消息
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Shield className="mr-2 h-4 w-4" />
                            修改权限
                          </DropdownMenuItem>
                          {user.status === "active" ? (
                            <DropdownMenuItem className="text-red-600">
                              <UserX className="mr-2 h-4 w-4" />
                              封禁用户
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem className="text-green-600">
                              <UserCheck className="mr-2 h-4 w-4" />
                              解除封禁
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pagination */}
        <div className="mt-6 flex justify-center">
          <div className="flex space-x-2">
            <Button variant="outline" disabled>
              上一页
            </Button>
            <Button variant="default">1</Button>
            <Button variant="outline">2</Button>
            <Button variant="outline">3</Button>
            <Button variant="outline">下一页</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
