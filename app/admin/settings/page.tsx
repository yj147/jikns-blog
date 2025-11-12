"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchGet, fetchPost, FetchError } from "@/lib/api/fetch-json"
import { useToast } from "@/components/ui/use-toast"
import { Save, Loader2 } from "lucide-react"

type GeneralSettings = {
  name: string
  url: string
  description: string
  adminEmail: string
  timezone: string
}

type FeatureToggles = {
  userRegistration: boolean
  comments: boolean
  activity: boolean
  search: boolean
}

const DEFAULT_GENERAL: GeneralSettings = {
  name: "",
  url: "",
  description: "",
  adminEmail: "",
  timezone: "Asia/Shanghai",
}

const DEFAULT_FEATURES: FeatureToggles = {
  userRegistration: true,
  comments: true,
  activity: true,
  search: true,
}

export default function AdminSettingsPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [general, setGeneral] = useState(DEFAULT_GENERAL)
  const [features, setFeatures] = useState(DEFAULT_FEATURES)
  const [savingKey, setSavingKey] = useState<string | null>(null)

  useEffect(() => {
    async function loadSettings() {
      setLoading(true)
      setError(null)
      try {
        const response = await fetchGet<{ data?: { settings: Record<string, any> } }>("/api/admin/settings")
        const payload = (response as any)?.data ?? response
        const settings = (payload?.settings ?? {}) as Record<string, any>
        setGeneral({ ...DEFAULT_GENERAL, ...(settings["site.general"] ?? {}) })
        setFeatures({ ...DEFAULT_FEATURES, ...(settings["features.toggles"] ?? {}) })
      } catch (error) {
        const message = error instanceof FetchError ? error.message : "加载设置失败"
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [])

  const handleSave = async (key: string, value: unknown, successMessage: string) => {
    try {
      setSavingKey(key)
      const response = await fetchPost("/api/admin/settings", { key, value })
      if ((response as any)?.success === false) {
        throw new FetchError((response as any)?.error?.message ?? "保存失败", 400)
      }
      toast({ title: successMessage })
    } catch (error) {
      const message = error instanceof FetchError ? error.message : "保存失败"
      toast({ variant: "destructive", title: message })
    } finally {
      setSavingKey(null)
    }
  }

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="mb-1 text-3xl font-bold">系统设置</h1>
          <p className="text-muted-foreground">所有设置会立即保存到数据库并记录审计日志</p>
        </div>

        {loading ? (
          <SettingsSkeleton />
        ) : error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
            {error}
          </div>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>站点信息</CardTitle>
                <CardDescription>用于 SEO、邮件通知等位置</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="site-name">网站名称</Label>
                    <Input
                      id="site-name"
                      value={general.name}
                      onChange={(event) => setGeneral((prev) => ({ ...prev, name: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="site-url">网站 URL</Label>
                    <Input
                      id="site-url"
                      value={general.url}
                      onChange={(event) => setGeneral((prev) => ({ ...prev, url: event.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="site-description">网站描述</Label>
                  <Textarea
                    id="site-description"
                    value={general.description}
                    onChange={(event) => setGeneral((prev) => ({ ...prev, description: event.target.value }))}
                    className="min-h-[100px]"
                  />
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="admin-email">管理员邮箱</Label>
                    <Input
                      id="admin-email"
                      type="email"
                      value={general.adminEmail}
                      onChange={(event) => setGeneral((prev) => ({ ...prev, adminEmail: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timezone">时区</Label>
                    <Select value={general.timezone} onValueChange={(value) => setGeneral((prev) => ({ ...prev, timezone: value }))}>
                      <SelectTrigger id="timezone">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Asia/Shanghai">Asia/Shanghai (UTC+8)</SelectItem>
                        <SelectItem value="UTC">UTC</SelectItem>
                        <SelectItem value="America/New_York">America/New_York</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  onClick={() => handleSave("site.general", general, "站点信息已保存")}
                  disabled={savingKey === "site.general"}
                >
                  {savingKey === "site.general" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  保存设置
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>功能开关</CardTitle>
                <CardDescription>实时控制面向用户的核心能力</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FeatureToggle
                  label="用户注册"
                  description="允许新用户注册账户"
                  checked={features.userRegistration}
                  onCheckedChange={(value) => setFeatures((prev) => ({ ...prev, userRegistration: value }))}
                />
                <FeatureToggle
                  label="评论功能"
                  description="启用文章评论与回复"
                  checked={features.comments}
                  onCheckedChange={(value) => setFeatures((prev) => ({ ...prev, comments: value }))}
                />
                <FeatureToggle
                  label="社交动态"
                  description="开放 Activity Feed 功能"
                  checked={features.activity}
                  onCheckedChange={(value) => setFeatures((prev) => ({ ...prev, activity: value }))}
                />
                <FeatureToggle
                  label="全站搜索"
                  description="允许访客使用搜索功能"
                  checked={features.search}
                  onCheckedChange={(value) => setFeatures((prev) => ({ ...prev, search: value }))}
                />

                <Button
                  onClick={() => handleSave("features.toggles", features, "功能开关已更新")}
                  disabled={savingKey === "features.toggles"}
                >
                  {savingKey === "features.toggles" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  保存设置
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

function FeatureToggle({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string
  description: string
  checked: boolean
  onCheckedChange: (value: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 2 }).map((_, index) => (
        <Card key={`settings-skeleton-${index}`}>
          <CardContent className="space-y-4 pt-6">
            <Skeleton className="h-5 w-32" />
            {Array.from({ length: 3 }).map((__, inner) => (
              <Skeleton key={`settings-skeleton-${index}-${inner}`} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
