"use client"

import { useFormContext } from "react-hook-form"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { PostFormData } from "@/components/admin/post-form"

export function SeoFields() {
  const {
    register,
    formState: { errors },
  } = useFormContext<PostFormData>()

  return (
    <Card>
      <CardHeader>
        <CardTitle>SEO 优化设置</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="metaTitle">SEO 标题</Label>
          <Input
            id="metaTitle"
            {...register("metaTitle")}
            placeholder="自定义搜索引擎显示的标题..."
          />
          {errors.metaTitle && <p className="text-sm text-red-500">{errors.metaTitle.message}</p>}
          <p className="text-muted-foreground text-xs">
            建议控制在50-60个字符内，不填写则使用文章标题
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="metaDescription">SEO 描述</Label>
          <Textarea
            id="metaDescription"
            {...register("metaDescription")}
            placeholder="描述文章内容，用于搜索引擎结果展示..."
            rows={3}
          />
          {errors.metaDescription && (
            <p className="text-sm text-red-500">{errors.metaDescription.message}</p>
          )}
          <p className="text-muted-foreground text-xs">建议控制在150-160个字符内</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="metaKeywords">SEO 关键词</Label>
          <Input
            id="metaKeywords"
            {...register("metaKeywords")}
            placeholder="关键词1, 关键词2, 关键词3..."
          />
          {errors.metaKeywords && (
            <p className="text-sm text-red-500">{errors.metaKeywords.message}</p>
          )}
          <p className="text-muted-foreground text-xs">用逗号分隔多个关键词，建议3-5个</p>
        </div>
      </CardContent>
    </Card>
  )
}
