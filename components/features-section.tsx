import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BookOpen, Users, TrendingUp, Zap } from "lucide-react"
import { cn } from "@/lib/utils"

const featurePalette = {
  article: { color: "text-action-comment", bg: "bg-action-comment/10" },
  community: { color: "text-primary", bg: "bg-primary/10" },
  realtime: { color: "text-status-warning", bg: "bg-status-warning/10" },
  trending: { color: "text-action-like", bg: "bg-action-like/10" },
} as const

type FeatureTheme = keyof typeof featurePalette

const features: { icon: typeof BookOpen; title: string; subtitle: string; theme: FeatureTheme }[] = [
  {
    icon: BookOpen,
    title: "深度文章",
    subtitle: "每日精选技术干货",
    theme: "article",
  },
  {
    icon: Users,
    title: "社区互动",
    subtitle: "找到志同道合的伙伴",
    theme: "community",
  },
  {
    icon: Zap,
    title: "即时动态",
    subtitle: "掌握第一手资讯",
    theme: "realtime",
  },
  {
    icon: TrendingUp,
    title: "热门话题",
    subtitle: "大家都在讨论什么",
    theme: "trending",
  },
]

export function FeaturesSection() {
  return (
    <Card className="border-none shadow-none bg-muted/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-bold">探索更多</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {features.map((feature) => {
          const Icon = feature.icon
          const palette = featurePalette[feature.theme]
          return (
            <div
              key={feature.title}
              className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted/50 cursor-pointer group"
            >
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full",
                  palette.bg,
                  palette.color
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium leading-none group-hover:text-primary transition-colors">{feature.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{feature.subtitle}</p>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
