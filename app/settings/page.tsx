import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { User, Bell, Shield, Palette, Globe, Trash2, Camera } from "lucide-react"

export default function SettingsPage() {
  return (
    <div className="bg-background min-h-screen">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8">
            <h1 className="mb-2 text-3xl font-bold">设置</h1>
            <p className="text-muted-foreground">管理你的账户设置和偏好</p>
          </div>

          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="profile" className="flex items-center">
                <User className="mr-2 h-4 w-4" />
                个人资料
              </TabsTrigger>
              <TabsTrigger value="notifications" className="flex items-center">
                <Bell className="mr-2 h-4 w-4" />
                通知
              </TabsTrigger>
              <TabsTrigger value="privacy" className="flex items-center">
                <Shield className="mr-2 h-4 w-4" />
                隐私
              </TabsTrigger>
              <TabsTrigger value="appearance" className="flex items-center">
                <Palette className="mr-2 h-4 w-4" />
                外观
              </TabsTrigger>
              <TabsTrigger value="account" className="flex items-center">
                <Globe className="mr-2 h-4 w-4" />
                账户
              </TabsTrigger>
            </TabsList>

            {/* Profile Settings */}
            <TabsContent value="profile" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>个人信息</CardTitle>
                  <CardDescription>更新你的个人资料信息</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Avatar */}
                  <div className="flex items-center space-x-4">
                    <Avatar className="h-20 w-20">
                      <AvatarImage
                        src="/author-writing.png?height=80&width=80&query=settings user"
                        alt="头像"
                      />
                      <AvatarFallback>张</AvatarFallback>
                    </Avatar>
                    <div className="space-y-2">
                      <Button variant="outline" size="sm">
                        <Camera className="mr-2 h-4 w-4" />
                        更换头像
                      </Button>
                      <p className="text-muted-foreground text-sm">
                        推荐尺寸：400x400px，支持JPG、PNG格式
                      </p>
                    </div>
                  </div>

                  <Separator />

                  {/* Basic Info */}
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">姓名</Label>
                      <Input id="name" defaultValue="张三" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="username">用户名</Label>
                      <Input id="username" defaultValue="zhangsan" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">邮箱</Label>
                      <Input id="email" type="email" defaultValue="zhang@example.com" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">手机号</Label>
                      <Input id="phone" defaultValue="+86 138 0013 8000" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bio">个人简介</Label>
                    <Textarea
                      id="bio"
                      placeholder="介绍一下你自己..."
                      defaultValue="全栈开发工程师 | React & Node.js 爱好者 | 开源贡献者"
                      className="min-h-[100px]"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="location">所在地</Label>
                      <Input id="location" defaultValue="北京, 中国" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="website">个人网站</Label>
                      <Input id="website" defaultValue="https://zhangsan.dev" />
                    </div>
                  </div>

                  <Button>保存更改</Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notification Settings */}
            <TabsContent value="notifications" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>通知设置</CardTitle>
                  <CardDescription>选择你希望接收的通知类型</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>邮件通知</Label>
                        <p className="text-muted-foreground text-sm">接收重要更新的邮件通知</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>新评论通知</Label>
                        <p className="text-muted-foreground text-sm">有人评论你的内容时通知你</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>点赞通知</Label>
                        <p className="text-muted-foreground text-sm">有人点赞你的内容时通知你</p>
                      </div>
                      <Switch />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>关注通知</Label>
                        <p className="text-muted-foreground text-sm">有新用户关注你时通知你</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>系统通知</Label>
                        <p className="text-muted-foreground text-sm">接收系统更新和维护通知</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </div>

                  <Button>保存设置</Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Privacy Settings */}
            <TabsContent value="privacy" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>隐私设置</CardTitle>
                  <CardDescription>控制你的信息可见性和隐私选项</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>公开个人资料</Label>
                        <p className="text-muted-foreground text-sm">
                          允许其他用户查看你的个人资料
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>显示邮箱地址</Label>
                        <p className="text-muted-foreground text-sm">在个人资料中显示邮箱地址</p>
                      </div>
                      <Switch />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>允许搜索</Label>
                        <p className="text-muted-foreground text-sm">允许其他用户通过搜索找到你</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <Label>谁可以评论你的内容</Label>
                      <Select defaultValue="everyone">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="everyone">所有人</SelectItem>
                          <SelectItem value="following">我关注的人</SelectItem>
                          <SelectItem value="followers">关注我的人</SelectItem>
                          <SelectItem value="none">没有人</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button>保存设置</Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Appearance Settings */}
            <TabsContent value="appearance" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>外观设置</CardTitle>
                  <CardDescription>自定义界面外观和主题</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>主题模式</Label>
                      <Select defaultValue="system">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="light">浅色模式</SelectItem>
                          <SelectItem value="dark">深色模式</SelectItem>
                          <SelectItem value="system">跟随系统</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>语言</Label>
                      <Select defaultValue="zh-CN">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="zh-CN">简体中文</SelectItem>
                          <SelectItem value="zh-TW">繁体中文</SelectItem>
                          <SelectItem value="en-US">English</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>字体大小</Label>
                      <Select defaultValue="medium">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="small">小</SelectItem>
                          <SelectItem value="medium">中</SelectItem>
                          <SelectItem value="large">大</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button>保存设置</Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Account Settings */}
            <TabsContent value="account" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>账户安全</CardTitle>
                  <CardDescription>管理你的账户安全设置</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="current-password">当前密码</Label>
                      <Input id="current-password" type="password" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-password">新密码</Label>
                      <Input id="new-password" type="password" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">确认新密码</Label>
                      <Input id="confirm-password" type="password" />
                    </div>
                  </div>

                  <Button>更新密码</Button>

                  <Separator />

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>两步验证</Label>
                        <p className="text-muted-foreground text-sm">
                          为你的账户添加额外的安全保护
                        </p>
                      </div>
                      <Button variant="outline">启用</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-destructive">
                <CardHeader>
                  <CardTitle className="text-destructive">危险区域</CardTitle>
                  <CardDescription>这些操作无法撤销，请谨慎操作</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>删除账户</Label>
                      <p className="text-muted-foreground text-sm">永久删除你的账户和所有数据</p>
                    </div>
                    <Button variant="destructive">
                      <Trash2 className="mr-2 h-4 w-4" />
                      删除账户
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
