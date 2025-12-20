"use client"

import { useEffect, useMemo, useRef, useState, useTransition, type ChangeEvent } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { useToast } from "@/components/ui/use-toast"
import {
  updateAvatar,
  updateNotificationPreferences,
  updatePrivacySettings,
  updateProfile,
  updateSocialLinks,
  updateCoverImage,
  deleteCoverImage,
} from "@/app/actions/settings"
import { useAuth } from "@/hooks/use-auth"
import {
  notificationPreferencesSchema,
  privacySettingsSchema,
  socialLinksSchema,
  type NotificationPreferences,
  type PrivacySettings,
  type SocialLinksInput,
} from "@/types/user-settings"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Loader2 } from "lucide-react"
import Image from "next/image"

const PHONE_PATTERN = /^[0-9()+\-\.\s]*$/

const AVATAR_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const
const AVATAR_ACCEPT = AVATAR_ALLOWED_TYPES.join(",")
const MAX_AVATAR_SIZE = 5 * 1024 * 1024
const COVER_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const
const COVER_ACCEPT = COVER_ALLOWED_TYPES.join(",")
const MAX_COVER_SIZE = 8 * 1024 * 1024

const profileFormSchema = z.object({
  name: z.string().trim().min(2, "用户名至少需要 2 个字符").max(50, "用户名不能超过 50 个字符"),
  location: z.string().trim().max(200, "所在地不能超过200个字符").optional(),
  phone: z
    .string()
    .trim()
    .max(40, "手机号不能超过40个字符")
    .regex(PHONE_PATTERN, "手机号格式不正确")
    .optional(),
  bio: z.string().trim().max(500, "个人简介不能超过500个字符").optional(),
})

type ProfileFormValues = z.infer<typeof profileFormSchema>

export default function SettingsPage() {
  const { user, loading, refreshUser, supabase } = useAuth()
  const { toast } = useToast()
  const router = useRouter()

  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(user?.avatarUrl ?? null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [coverUploadError, setCoverUploadError] = useState<string | null>(null)
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null)
  const [currentCoverUrl, setCurrentCoverUrl] = useState<string | null>(user?.coverImage ?? null)
  const coverInputRef = useRef<HTMLInputElement | null>(null)

  const [isProfilePending, startProfileTransition] = useTransition()
  const [isPrivacyPending, startPrivacyTransition] = useTransition()
  const [isNotificationPending, startNotificationTransition] = useTransition()
  const [isSocialPending, startSocialTransition] = useTransition()

  const profileDefaults = useMemo<ProfileFormValues>(
    () => ({
      name: user?.name ?? "",
      location: user?.location ?? "",
      phone: user?.phone ?? "",
      bio: user?.bio ?? "",
    }),
    [user?.name, user?.location, user?.phone, user?.bio]
  )

  const privacyDefaults = useMemo<PrivacySettings>(
    () => privacySettingsSchema.parse(user?.privacySettings ?? {}),
    [user?.privacySettings]
  )

  const notificationDefaults = useMemo<NotificationPreferences>(
    () => notificationPreferencesSchema.parse(user?.notificationPreferences ?? {}),
    [user?.notificationPreferences]
  )

  const socialLinksDefaults = useMemo<SocialLinksInput>(() => {
    const links = (user?.socialLinks as Record<string, unknown>) || {}
    const pick = (key: keyof SocialLinksInput) => {
      const value = links?.[key]
      return typeof value === "string" ? value : ""
    }

    return {
      website: pick("website"),
      github: pick("github"),
      twitter: pick("twitter"),
      linkedin: pick("linkedin"),
      email: pick("email"),
    }
  }, [user?.socialLinks])

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: profileDefaults,
  })

  const privacyForm = useForm<PrivacySettings>({
    resolver: zodResolver(privacySettingsSchema),
    defaultValues: privacyDefaults,
  })

  const notificationForm = useForm<NotificationPreferences>({
    resolver: zodResolver(notificationPreferencesSchema),
    defaultValues: notificationDefaults,
  })

  const socialLinksForm = useForm<SocialLinksInput>({
    resolver: zodResolver(socialLinksSchema),
    defaultValues: socialLinksDefaults,
  })

  useEffect(() => {
    setCurrentAvatarUrl(user?.avatarUrl ?? null)
    setPreviewUrl(null)
    setUploadError(null)
  }, [user?.avatarUrl])

  useEffect(() => {
    setCurrentCoverUrl(user?.coverImage ?? null)
    setCoverPreviewUrl(null)
    setCoverUploadError(null)
  }, [user?.coverImage])

  // 用户数据加载后重置表单以填充默认值
  useEffect(() => {
    if (user && !loading) {
      profileForm.reset(profileDefaults)
      privacyForm.reset(privacyDefaults)
      notificationForm.reset(notificationDefaults)
      socialLinksForm.reset(socialLinksDefaults)
    }
  }, [
    user,
    loading,
    profileDefaults,
    privacyDefaults,
    notificationDefaults,
    socialLinksDefaults,
    profileForm,
    privacyForm,
    notificationForm,
    socialLinksForm,
  ])

  const validateAvatarFile = (file: File): string | null => {
    if (!AVATAR_ALLOWED_TYPES.includes(file.type as (typeof AVATAR_ALLOWED_TYPES)[number])) {
      return "仅支持 JPG/PNG/WebP/GIF 图片"
    }

    if (file.size === 0) {
      return "头像文件为空"
    }

    if (file.size > MAX_AVATAR_SIZE) {
      return "头像大小不能超过 5MB"
    }

    return null
  }

  const validateCoverFile = (file: File): string | null => {
    if (!COVER_ALLOWED_TYPES.includes(file.type as (typeof COVER_ALLOWED_TYPES)[number])) {
      return "仅支持 JPG/PNG/WebP 图片"
    }

    if (file.size === 0) {
      return "封面文件为空"
    }

    if (file.size > MAX_COVER_SIZE) {
      return "封面大小不能超过 8MB"
    }

    return null
  }

  const handleAvatarSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null
    event.target.value = ""

    if (!user) {
      toast({ title: "用户未登录", variant: "destructive" })
      return
    }

    if (!file) return

    const validationMessage = validateAvatarFile(file)
    if (validationMessage) {
      setUploadError(validationMessage)
      return
    }

    setUploadError(null)

    // 本地预览
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string)
    }
    reader.readAsDataURL(file)

    const avatarForm = new FormData()
    avatarForm.append("avatar", file)

    setUploadingAvatar(true)
    try {
      const result = await updateAvatar(user.id, avatarForm)
      if (result.success) {
        const newUrl = result.data.avatarUrl

        // 先更新本地状态
        setCurrentAvatarUrl(newUrl)
        setPreviewUrl(null)
        setUploadError(null)

        // 同步 Supabase Auth metadata (关键步骤)
        let authMetadataUpdated = false
        if (supabase) {
          try {
            const { error: authError } = await supabase.auth.updateUser({
              data: { avatar_url: newUrl },
            })
            if (authError) {
              console.error("Supabase Auth metadata 更新失败:", authError)
              toast({
                title: "头像已更新，但部分同步失败",
                description: "请刷新页面查看最新头像",
                variant: "default",
              })
            } else {
              authMetadataUpdated = true
            }
          } catch (error) {
            console.error("Supabase Auth metadata 更新异常:", error)
          }
        }

        // 强制刷新客户端状态和服务端缓存
        await Promise.all([
          refreshUser(), // 刷新 AuthProvider 状态
          new Promise((resolve) => setTimeout(resolve, 100)), // 给 Supabase 一点时间同步
        ])

        // 强制刷新页面路由缓存
        router.refresh()

        // 显示成功提示
        toast({
          title: authMetadataUpdated ? "头像已更新" : "头像已更新 (部分同步延迟)",
          description: authMetadataUpdated ? undefined : "如果部分页面未显示新头像，请刷新页面",
        })
      } else {
        setUploadError(result.error)
        toast({ title: result.error, variant: "destructive" })
      }
    } catch (error) {
      console.error("updateAvatar failed", error)
      setUploadError("头像上传失败，请稍后重试")
      toast({ title: "头像上传失败，请稍后重试", variant: "destructive" })
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleCoverSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null
    event.target.value = ""

    if (!user) {
      toast({ title: "用户未登录", variant: "destructive" })
      return
    }

    if (!file) return

    const validationMessage = validateCoverFile(file)
    if (validationMessage) {
      setCoverUploadError(validationMessage)
      return
    }

    setCoverUploadError(null)

    const reader = new FileReader()
    reader.onloadend = () => {
      setCoverPreviewUrl(reader.result as string)
    }
    reader.readAsDataURL(file)

    const coverForm = new FormData()
    coverForm.append("cover", file)

    setUploadingCover(true)
    try {
      const result = await updateCoverImage(user.id, coverForm)
      if (result.success) {
        const newUrl = result.data.coverImage
        setCurrentCoverUrl(newUrl)
        setCoverPreviewUrl(null)
        setCoverUploadError(null)

        await Promise.all([refreshUser(), new Promise((resolve) => setTimeout(resolve, 100))])
        router.refresh()
        toast({ title: "封面已更新" })
      } else {
        setCoverUploadError(result.error)
        toast({ title: result.error, variant: "destructive" })
      }
    } catch (error) {
      console.error("updateCoverImage failed", error)
      setCoverUploadError("封面上传失败，请稍后重试")
      toast({ title: "封面上传失败，请稍后重试", variant: "destructive" })
    } finally {
      setUploadingCover(false)
    }
  }

  const handleCoverDelete = async () => {
    if (!user) {
      toast({ title: "用户未登录", variant: "destructive" })
      return
    }

    setUploadingCover(true)
    try {
      const result = await deleteCoverImage(user.id)
      if (result.success) {
        setCurrentCoverUrl(null)
        setCoverPreviewUrl(null)
        setCoverUploadError(null)
        await Promise.all([refreshUser(), new Promise((resolve) => setTimeout(resolve, 100))])
        router.refresh()
        toast({ title: "封面已移除" })
      } else {
        toast({ title: result.error, variant: "destructive" })
      }
    } catch (error) {
      console.error("deleteCoverImage failed", error)
      toast({ title: "删除封面失败，请稍后重试", variant: "destructive" })
    } finally {
      setUploadingCover(false)
    }
  }

  const handleProfileSubmit = profileForm.handleSubmit((values) => {
    if (!user) {
      toast({ title: "用户未登录", variant: "destructive" })
      return
    }

    startProfileTransition(async () => {
      const result = await updateProfile(user.id, values)

      if (result.success) {
        toast({ title: "个人资料已保存" })
        await Promise.all([refreshUser(), new Promise((resolve) => setTimeout(resolve, 100))])
        router.refresh()
        profileForm.reset({
          name: result.data.name ?? "",
          location: result.data.location ?? "",
          phone: result.data.phone ?? "",
          bio: result.data.bio ?? "",
        })
        return
      }

      if (result.field) {
        profileForm.setError(result.field as keyof ProfileFormValues, {
          type: "manual",
          message: result.error,
        })
      } else {
        toast({ title: result.error, variant: "destructive" })
      }
    })
  })

  const handlePrivacySubmit = privacyForm.handleSubmit((values) => {
    if (!user) {
      toast({ title: "用户未登录", variant: "destructive" })
      return
    }

    startPrivacyTransition(async () => {
      const result = await updatePrivacySettings(user.id, values)
      if (result.success) {
        toast({ title: "隐私设置已保存" })

        // 刷新客户端user对象和服务端路由缓存
        await Promise.all([
          refreshUser(), // 刷新AuthProvider状态
          new Promise((resolve) => setTimeout(resolve, 100)), // 给缓存一点时间同步
        ])
        router.refresh() // 刷新服务端路由缓存

        // 用最新数据重置表单
        privacyForm.reset(result.data)
      } else {
        toast({ title: result.error, variant: "destructive" })
      }
    })
  })

  const handleNotificationSubmit = notificationForm.handleSubmit((values) => {
    if (!user) {
      toast({ title: "用户未登录", variant: "destructive" })
      return
    }

    startNotificationTransition(async () => {
      const result = await updateNotificationPreferences(user.id, values)
      if (result.success) {
        toast({ title: "通知偏好已保存" })

        // 刷新客户端user对象和服务端路由缓存
        await Promise.all([refreshUser(), new Promise((resolve) => setTimeout(resolve, 100))])
        router.refresh()

        // 用最新数据重置表单
        notificationForm.reset(result.data)
      } else {
        toast({ title: result.error, variant: "destructive" })
      }
    })
  })

  const handleSocialLinksSubmit = socialLinksForm.handleSubmit((values) => {
    if (!user) {
      toast({ title: "用户未登录", variant: "destructive" })
      return
    }

    startSocialTransition(async () => {
      const result = await updateSocialLinks(user.id, values)
      if (result.success) {
        const nextValues: SocialLinksInput = {
          website: result.data?.website ?? "",
          github: result.data?.github ?? "",
          twitter: result.data?.twitter ?? "",
          linkedin: result.data?.linkedin ?? "",
          email: result.data?.email ?? "",
        }
        socialLinksForm.reset(nextValues)
        toast({ title: "社交链接已保存" })
        router.refresh()
      } else if (result.field) {
        socialLinksForm.setError(result.field as keyof SocialLinksInput, {
          type: "manual",
          message: result.error,
        })
      } else {
        toast({ title: result.error, variant: "destructive" })
      }
    })
  })

  if (loading) {
    return (
      <div className="bg-background min-h-screen">
        <div className="container mx-auto px-4 py-10">
          <p className="text-muted-foreground">加载用户数据中…</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="bg-background min-h-screen">
        <div className="container mx-auto px-4 py-10">
          <p className="text-destructive">无法加载用户信息，请重新登录。</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold">设置</h1>
          <p className="text-muted-foreground">管理个人资料、隐私和通知偏好</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-4">
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>个人资料</CardTitle>
              <CardDescription>更新所在地、联系方式与个人简介</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...profileForm}>
                <form onSubmit={handleProfileSubmit} className="space-y-4">
                  <div className="flex flex-col gap-3 rounded-lg border p-4">
                    <div className="bg-muted relative h-36 w-full overflow-hidden rounded-md md:h-44">
                      {coverPreviewUrl || currentCoverUrl ? (
                        <Image
                          src={coverPreviewUrl || currentCoverUrl || "/placeholder.svg"}
                          alt="封面预览"
                          fill
                          sizes="(min-width: 768px) 640px, 100vw"
                          className="object-cover"
                        />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-r from-sky-500/60 via-indigo-500/60 to-purple-500/60" />
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => coverInputRef.current?.click()}
                        disabled={uploadingCover}
                      >
                        {uploadingCover ? "上传中..." : "选择封面图"}
                      </Button>
                      {currentCoverUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={handleCoverDelete}
                          disabled={uploadingCover}
                        >
                          移除封面图
                        </Button>
                      )}
                      <input
                        ref={coverInputRef}
                        type="file"
                        accept={COVER_ACCEPT}
                        className="hidden"
                        onChange={handleCoverSelect}
                      />
                      {uploadingCover && (
                        <span className="text-muted-foreground flex items-center gap-2 text-sm">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          上传中...
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground text-sm">
                      推荐 1500x500，支持 JPG/PNG/WebP，≤8MB。
                    </p>
                    {coverUploadError && (
                      <p className="text-destructive text-sm">{coverUploadError}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center">
                    <Avatar className="h-16 w-16">
                      <AvatarImage
                        src={previewUrl || currentAvatarUrl || undefined}
                        alt={user.name || user.email || "头像"}
                      />
                      <AvatarFallback>
                        {(user.name || user.email || "U").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex flex-1 flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingAvatar}
                        >
                          {uploadingAvatar ? "上传中..." : "选择头像"}
                        </Button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept={AVATAR_ACCEPT}
                          className="hidden"
                          onChange={handleAvatarSelect}
                        />
                        {uploadingAvatar && (
                          <span className="text-muted-foreground flex items-center gap-2 text-sm">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            上传中...
                          </span>
                        )}
                      </div>
                      <p className="text-muted-foreground text-sm">
                        支持 JPG/PNG/WebP/GIF，≤5MB，推荐 400x400 尺寸。
                      </p>
                      {uploadError && <p className="text-destructive text-sm">{uploadError}</p>}
                    </div>
                  </div>

                  <FormField
                    control={profileForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>用户名</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="请输入 2-50 字的用户名" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={profileForm.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>所在地</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="例如：San Francisco, CA" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={profileForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>手机号</FormLabel>
                        <FormControl>
                          <Input {...field} inputMode="tel" placeholder="例如：+1 415 555 1234" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={profileForm.control}
                    name="bio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>个人简介</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="简要介绍你自己"
                            className="min-h-[120px]"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end">
                    <Button type="submit" disabled={isProfilePending}>
                      {isProfilePending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      保存个人资料
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>隐私设置</CardTitle>
                <CardDescription>控制资料可见性与公开信息</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...privacyForm}>
                  <form onSubmit={handlePrivacySubmit} className="space-y-4">
                    <FormField
                      control={privacyForm.control}
                      name="profileVisibility"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>资料可见性</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="选择可见性" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="public">公开</SelectItem>
                              <SelectItem value="followers">仅粉丝</SelectItem>
                              <SelectItem value="private">仅自己</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={privacyForm.control}
                      name="showEmail"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <Label>公开邮箱</Label>
                            <p className="text-muted-foreground text-sm">
                              在个人资料中展示邮箱地址
                            </p>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={privacyForm.control}
                      name="showPhone"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <Label>公开手机号</Label>
                            <p className="text-muted-foreground text-sm">允许他人看到你的电话</p>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={privacyForm.control}
                      name="showLocation"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <Label>公开所在地</Label>
                            <p className="text-muted-foreground text-sm">
                              在个人资料中显示你的所在地
                            </p>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end">
                      <Button type="submit" disabled={isPrivacyPending}>
                        {isPrivacyPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        保存隐私设置
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>通知偏好</CardTitle>
                <CardDescription>控制需要接收的通知类型</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...notificationForm}>
                  <form onSubmit={handleNotificationSubmit} className="space-y-3">
                    {(
                      [
                        { key: "LIKE", label: "点赞通知", desc: "有人点赞你的内容时通知你" },
                        { key: "COMMENT", label: "评论通知", desc: "有人评论你的内容时通知你" },
                        { key: "FOLLOW", label: "关注通知", desc: "有新用户关注你时通知你" },
                        { key: "SYSTEM", label: "系统通知", desc: "接收系统更新与公告" },
                      ] as const
                    ).map(({ key, label, desc }) => (
                      <FormField
                        key={key}
                        control={notificationForm.control}
                        name={key}
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-3">
                            <div>
                              <Label>{label}</Label>
                              <p className="text-muted-foreground text-sm">{desc}</p>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    ))}

                    <div className="flex justify-end pt-1">
                      <Button type="submit" disabled={isNotificationPending}>
                        {isNotificationPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        保存通知偏好
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>

          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>社交链接</CardTitle>
              <CardDescription>添加或清空常用社交链接，将在个人资料中展示</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...socialLinksForm}>
                <form onSubmit={handleSocialLinksSubmit} className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={socialLinksForm.control}
                      name="website"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>个人网站</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={typeof field.value === "string" ? field.value : ""}
                              type="url"
                              placeholder="https://example.com"
                              pattern="https?://.*"
                              title="仅支持 http:// 或 https:// 开头的链接"
                              onChange={(e) => {
                                const val = e.target.value
                                // 仅允许 http/https，其他协议立即提示，避免提交到后端
                                if (val && !/^https?:\/\//i.test(val)) {
                                  e.target.setCustomValidity(
                                    "仅支持 http:// 或 https:// 开头的链接"
                                  )
                                } else {
                                  e.target.setCustomValidity("")
                                }
                                field.onChange(e)
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={socialLinksForm.control}
                      name="github"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>GitHub</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={typeof field.value === "string" ? field.value : ""}
                              type="url"
                              placeholder="https://github.com/username"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={socialLinksForm.control}
                      name="twitter"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Twitter / X</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={typeof field.value === "string" ? field.value : ""}
                              type="url"
                              placeholder="https://twitter.com/username"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={socialLinksForm.control}
                      name="linkedin"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>LinkedIn</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={typeof field.value === "string" ? field.value : ""}
                              type="url"
                              placeholder="https://www.linkedin.com/in/username"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={socialLinksForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>邮箱链接</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={typeof field.value === "string" ? field.value : ""}
                              type="url"
                              placeholder="mailto:you@example.com"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={isSocialPending}>
                      {isSocialPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      保存社交链接
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
