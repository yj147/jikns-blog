import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BookOpen, Users, TrendingUp } from "lucide-react"

const features = [
  {
    icon: BookOpen,
    title: "精品博客",
    description: "高质量的原创内容，深度思考与专业见解",
    color: "text-blue-500",
  },
  {
    icon: Users,
    title: "社交动态",
    description: "分享生活点滴，与朋友保持实时互动",
    color: "text-emerald-500",
  },
  {
    icon: TrendingUp,
    title: "智能推荐",
    description: "基于兴趣的个性化内容推荐系统",
    color: "text-purple-500",
  },
]

export function FeaturesSection() {
  return (
    <section className="bg-muted/50 px-4 py-16">
      <div className="container mx-auto">
        <h2 className="mb-12 text-center text-3xl font-bold">平台特色</h2>

        <div className="grid gap-8 md:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <div
                key={feature.title}
                className="h-full rounded-xl border border-transparent transition-all duration-300 hover:-translate-y-2 hover:border-primary/40 hover:shadow-xl"
              >
                <Card className="bg-background/60 group h-full border-0 text-center backdrop-blur">
                  <CardHeader className="pb-8">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary/10 to-emerald-500/10 transition-transform duration-300 group-hover:scale-110 group-hover:shadow-lg">
                      <Icon className={`h-8 w-8 ${feature.color}`} />
                    </div>
                    <CardTitle className="transition-colors group-hover:text-primary">{feature.title}</CardTitle>
                    <CardDescription className="text-base leading-relaxed">{feature.description}</CardDescription>
                  </CardHeader>
                </Card>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
