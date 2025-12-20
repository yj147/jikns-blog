"use client"

import { useEffect, useState } from "react"
import { Loader2, Save } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { FetchError, fetchGet, fetchPost } from "@/lib/api/fetch-json"
import { useToast } from "@/components/ui/use-toast"
import type { RegistrationToggle, SeoMeta } from "@/lib/services/system-settings"

const SEO_KEY = "seo.meta"
const REGISTRATION_KEY = "registration.toggle"

const DEFAULT_SEO: SeoMeta = { title: "", description: "", keywords: [] }
const DEFAULT_REGISTRATION: RegistrationToggle = { enabled: true }

export default function AdminSettingsPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [seo, setSeo] = useState<SeoMeta>(DEFAULT_SEO)
  const [keywordsInput, setKeywordsInput] = useState("")
  const [registration, setRegistration] = useState<RegistrationToggle>(DEFAULT_REGISTRATION)
  const [savingKey, setSavingKey] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function loadSettings() {
      setLoading(true)
      setError(null)
      try {
        const response = await fetchGet<{ data?: { settings?: Record<string, unknown> } }>(
          "/api/admin/settings"
        )
        const payload = (response as any)?.data ?? response
        const settings = (payload?.settings ?? {}) as Record<string, unknown>

        const nextSeo = { ...DEFAULT_SEO, ...(settings[SEO_KEY] as Partial<SeoMeta> | undefined) }
        const nextRegistration = {
          ...DEFAULT_REGISTRATION,
          ...(settings[REGISTRATION_KEY] as Partial<RegistrationToggle> | undefined),
        }

        if (!active) return
        setSeo(nextSeo)
        setKeywordsInput(formatKeywords(nextSeo.keywords))
        setRegistration(nextRegistration)
      } catch (err) {
        if (!active) return
        const message = err instanceof FetchError ? err.message : "加载设置失败"
        setError(message)
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadSettings()
    return () => {
      active = false
    }
  }, [])

  const handleSaveSetting = async (key: string, value: unknown, successMessage: string) => {
    try {
      setSavingKey(key)
      const response = await fetchPost("/api/admin/settings", { key, value })
      const payload = response as any
      if (payload?.success === false) {
        throw new FetchError(
          payload?.error?.message ?? "保存失败",
          payload?.error?.statusCode ?? 400
        )
      }
      toast({ title: successMessage })
    } catch (err) {
      const message = err instanceof FetchError ? err.message : "保存失败"
      toast({ title: message, variant: "destructive" })
      throw err
    } finally {
      setSavingKey(null)
    }
  }

  const handleSaveSeo = async () => {
    const keywords = parseKeywords(keywordsInput)
    const payload: SeoMeta = { ...seo, keywords }
    await handleSaveSetting(SEO_KEY, payload, "SEO 设置已保存")
    setSeo(payload)
    setKeywordsInput(formatKeywords(keywords))
  }

  const handleRegistrationToggle = async (enabled: boolean) => {
    const previous = registration.enabled
    setRegistration({ enabled })
    try {
      await handleSaveSetting(REGISTRATION_KEY, { enabled }, enabled ? "已启用注册" : "已禁用注册")
    } catch (_err) {
      setRegistration({ enabled: previous })
    }
  }

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">系统设置</h1>
        <p className="text-muted-foreground">SEO 配置与注册策略将立即保存并记录审计日志</p>
      </div>

      {loading ? (
        <SettingsSkeleton />
      ) : error ? (
        <div className="border-destructive/40 bg-destructive/5 text-destructive rounded-lg border p-6 text-sm">
          {error}
        </div>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>SEO 元数据</CardTitle>
              <CardDescription>用于搜索引擎与分享卡片的基础信息</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="seo-title">站点标题</Label>
                <Input
                  id="seo-title"
                  value={seo.title}
                  onChange={(event) => setSeo((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="例如：Jikns Blog"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="seo-description">站点描述</Label>
                <Textarea
                  id="seo-description"
                  value={seo.description}
                  onChange={(event) =>
                    setSeo((prev) => ({ ...prev, description: event.target.value }))
                  }
                  className="min-h-[100px]"
                  placeholder="简要描述站点用途，80-160 字符为宜"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="seo-keywords">关键词</Label>
                <Input
                  id="seo-keywords"
                  value={keywordsInput}
                  onChange={(event) => setKeywordsInput(event.target.value)}
                  placeholder="使用逗号分隔，如: blog, tech, nextjs"
                />
                <p className="text-muted-foreground text-sm">留空则不写入关键词元标签</p>
              </div>

              <Button onClick={handleSaveSeo} disabled={savingKey === SEO_KEY}>
                {savingKey === SEO_KEY ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                保存 SEO 设置
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>注册开关</CardTitle>
              <CardDescription>控制是否允许新用户创建账户</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-medium">启用用户注册</p>
                  <p className="text-muted-foreground text-sm">关闭后仅管理员可创建账号</p>
                </div>
                <Switch
                  role="switch"
                  aria-label="启用用户注册"
                  checked={registration.enabled}
                  disabled={savingKey === REGISTRATION_KEY}
                  onCheckedChange={handleRegistrationToggle}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  )
}

function parseKeywords(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function formatKeywords(keywords: string[]): string {
  return keywords.join(", ")
}

function SettingsSkeleton() {
  return (
    <div data-testid="settings-skeleton" className="space-y-6">
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
