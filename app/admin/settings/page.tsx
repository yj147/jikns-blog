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
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  Settings,
  Shield,
  Mail,
  Database,
  Palette,
  Bell,
  Save,
  RefreshCw,
  AlertTriangle,
} from "lucide-react"

export default function AdminSettingsPage() {
  return (
    <div className="bg-background min-h-screen">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8">
            <h1 className="mb-2 text-3xl font-bold">系统设置</h1>
            <p className="text-muted-foreground">配置网站的各项设置和参数</p>
          </div>

          <Tabs defaultValue="general" className="space-y-6">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="general" className="flex items-center">
                <Settings className="mr-2 h-4 w-4" />
                基本设置
              </TabsTrigger>
              <TabsTrigger value="security" className="flex items-center">
                <Shield className="mr-2 h-4 w-4" />
                安全
              </TabsTrigger>
              <TabsTrigger value="email" className="flex items-center">
                <Mail className="mr-2 h-4 w-4" />
                邮件
              </TabsTrigger>
              <TabsTrigger value="appearance" className="flex items-center">
                <Palette className="mr-2 h-4 w-4" />
                外观
              </TabsTrigger>
              <TabsTrigger value="notifications" className="flex items-center">
                <Bell className="mr-2 h-4 w-4" />
                通知
              </TabsTrigger>
              <TabsTrigger value="advanced" className="flex items-center">
                <Database className="mr-2 h-4 w-4" />
                高级
              </TabsTrigger>
            </TabsList>

            {/* General Settings */}
            <TabsContent value="general" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>网站基本信息</CardTitle>
                  <CardDescription>配置网站的基本信息和元数据</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="site-name">网站名称</Label>
                      <Input id="site-name" defaultValue="现代博客平台" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="site-url">网站URL</Label>
                      <Input id="site-url" defaultValue="https://blog.example.com" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="site-description">网站描述</Label>
                    <Textarea
                      id="site-description"
                      placeholder="描述你的网站..."
                      defaultValue="集博客与社交于一体的现代化平台"
                      className="min-h-[100px]"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="admin-email">管理员邮箱</Label>
                      <Input id="admin-email" type="email" defaultValue="admin@example.com" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="timezone">时区</Label>
                      <Select defaultValue="asia/shanghai">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="asia/shanghai">Asia/Shanghai (UTC+8)</SelectItem>
                          <SelectItem value="utc">UTC (UTC+0)</SelectItem>
                          <SelectItem value="america/new_york">America/New_York (UTC-5)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button>
                    <Save className="mr-2 h-4 w-4" />
                    保存设置
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>功能开关</CardTitle>
                  <CardDescription>控制网站的各项功能</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>用户注册</Label>
                        <p className="text-muted-foreground text-sm">允许新用户注册账户</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>评论功能</Label>
                        <p className="text-muted-foreground text-sm">允许用户发表评论</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>社交动态</Label>
                        <p className="text-muted-foreground text-sm">启用社交动态功能</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>搜索功能</Label>
                        <p className="text-muted-foreground text-sm">启用全站搜索</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </div>

                  <Button>
                    <Save className="mr-2 h-4 w-4" />
                    保存设置
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Security Settings */}
            <TabsContent value="security" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>安全设置</CardTitle>
                  <CardDescription>配置网站的安全策略</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>强制HTTPS</Label>
                        <p className="text-muted-foreground text-sm">自动重定向HTTP到HTTPS</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>两步验证</Label>
                        <p className="text-muted-foreground text-sm">要求管理员启用两步验证</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>登录限制</Label>
                        <p className="text-muted-foreground text-sm">限制登录失败次数</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="session-timeout">会话超时（分钟）</Label>
                      <Input id="session-timeout" type="number" defaultValue="60" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max-login-attempts">最大登录尝试次数</Label>
                      <Input id="max-login-attempts" type="number" defaultValue="5" />
                    </div>
                  </div>

                  <Button>
                    <Save className="mr-2 h-4 w-4" />
                    保存设置
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-orange-200">
                <CardHeader>
                  <CardTitle className="flex items-center text-orange-800">
                    <AlertTriangle className="mr-2 h-5 w-5" />
                    安全状态
                  </CardTitle>
                  <CardDescription>当前系统安全状态检查</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">SSL证书状态</span>
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">正常</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">防火墙状态</span>
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                        已启用
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">系统更新</span>
                      <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                        有更新
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Email Settings */}
            <TabsContent value="email" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>邮件配置</CardTitle>
                  <CardDescription>配置邮件发送服务</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="smtp-provider">SMTP服务商</Label>
                    <Select defaultValue="custom">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gmail">Gmail</SelectItem>
                        <SelectItem value="outlook">Outlook</SelectItem>
                        <SelectItem value="sendgrid">SendGrid</SelectItem>
                        <SelectItem value="custom">自定义SMTP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="smtp-host">SMTP主机</Label>
                      <Input id="smtp-host" defaultValue="smtp.example.com" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtp-port">端口</Label>
                      <Input id="smtp-port" type="number" defaultValue="587" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtp-username">用户名</Label>
                      <Input id="smtp-username" defaultValue="noreply@example.com" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtp-password">密码</Label>
                      <Input id="smtp-password" type="password" placeholder="••••••••" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="from-email">发件人邮箱</Label>
                    <Input id="from-email" defaultValue="noreply@example.com" />
                  </div>

                  <div className="flex space-x-4">
                    <Button>
                      <Save className="mr-2 h-4 w-4" />
                      保存设置
                    </Button>
                    <Button variant="outline">
                      <Mail className="mr-2 h-4 w-4" />
                      发送测试邮件
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Appearance Settings */}
            <TabsContent value="appearance" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>外观设置</CardTitle>
                  <CardDescription>自定义网站的外观和主题</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>默认主题</Label>
                    <Select defaultValue="light">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">浅色主题</SelectItem>
                        <SelectItem value="dark">深色主题</SelectItem>
                        <SelectItem value="auto">跟随系统</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>主色调</Label>
                    <div className="flex space-x-2">
                      <div className="h-8 w-8 cursor-pointer rounded-full border-2 border-white bg-blue-500 shadow-md" />
                      <div className="h-8 w-8 cursor-pointer rounded-full border-2 border-white bg-green-500 shadow-md" />
                      <div className="h-8 w-8 cursor-pointer rounded-full border-2 border-white bg-purple-500 shadow-md" />
                      <div className="h-8 w-8 cursor-pointer rounded-full border-2 border-white bg-red-500 shadow-md" />
                      <div className="h-8 w-8 cursor-pointer rounded-full border-2 border-white bg-yellow-500 shadow-md" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="custom-css">自定义CSS</Label>
                    <Textarea
                      id="custom-css"
                      placeholder="输入自定义CSS代码..."
                      className="min-h-[150px] font-mono text-sm"
                    />
                  </div>

                  <Button>
                    <Save className="mr-2 h-4 w-4" />
                    保存设置
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notifications Settings */}
            <TabsContent value="notifications" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>通知设置</CardTitle>
                  <CardDescription>配置系统通知和提醒</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>新用户注册通知</Label>
                        <p className="text-muted-foreground text-sm">有新用户注册时通知管理员</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>内容举报通知</Label>
                        <p className="text-muted-foreground text-sm">有内容被举报时立即通知</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>系统错误通知</Label>
                        <p className="text-muted-foreground text-sm">系统发生错误时通知管理员</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>每日统计报告</Label>
                        <p className="text-muted-foreground text-sm">每日发送网站统计报告</p>
                      </div>
                      <Switch />
                    </div>
                  </div>

                  <Button>
                    <Save className="mr-2 h-4 w-4" />
                    保存设置
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Advanced Settings */}
            <TabsContent value="advanced" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>高级设置</CardTitle>
                  <CardDescription>系统高级配置选项</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="cache-duration">缓存时长（小时）</Label>
                      <Input id="cache-duration" type="number" defaultValue="24" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max-file-size">最大文件大小（MB）</Label>
                      <Input id="max-file-size" type="number" defaultValue="10" />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>启用缓存</Label>
                        <p className="text-muted-foreground text-sm">启用页面和数据缓存</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>调试模式</Label>
                        <p className="text-muted-foreground text-sm">启用详细错误日志</p>
                      </div>
                      <Switch />
                    </div>
                  </div>

                  <div className="flex space-x-4">
                    <Button>
                      <Save className="mr-2 h-4 w-4" />
                      保存设置
                    </Button>
                    <Button variant="outline">
                      <RefreshCw className="mr-2 h-4 w-4" />
                      清除缓存
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-red-200">
                <CardHeader>
                  <CardTitle className="text-red-800">危险操作</CardTitle>
                  <CardDescription>这些操作可能影响系统稳定性，请谨慎使用</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    variant="outline"
                    className="border-red-200 bg-transparent text-red-600 hover:bg-red-50"
                  >
                    重置所有设置
                  </Button>
                  <Button
                    variant="outline"
                    className="border-red-200 bg-transparent text-red-600 hover:bg-red-50"
                  >
                    清空数据库
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
