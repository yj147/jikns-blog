"use client"

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BookOpen, Users, TrendingUp } from "lucide-react"
import { motion } from "framer-motion"

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
        <motion.h2
          className="mb-12 text-center text-3xl font-bold"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          平台特色
        </motion.h2>

        <div className="grid gap-8 md:grid-cols-3">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                whileHover={{ y: -10, scale: 1.02 }}
                className="h-full"
              >
                <Card className="bg-background/60 group h-full border-0 text-center backdrop-blur transition-all duration-300 hover:shadow-xl">
                  <CardHeader className="pb-8">
                    <motion.div
                      className="mx-auto mb-4"
                      whileHover={{
                        scale: 1.2,
                        rotate: [0, -10, 10, 0],
                      }}
                      transition={{ duration: 0.5 }}
                    >
                      <div
                        className={`from-primary/20 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br to-emerald-500/20 transition-shadow group-hover:shadow-lg`}
                      >
                        <Icon
                          className={`h-8 w-8 ${feature.color} transition-transform group-hover:scale-110`}
                        />
                      </div>
                    </motion.div>

                    <CardTitle className="group-hover:text-primary transition-colors">
                      {feature.title}
                    </CardTitle>
                    <CardDescription className="text-base leading-relaxed">
                      {feature.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
