import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Link from "next/link"
import { ArrowRight, Star } from "lucide-react"

const samplePosts = [
  {
    id: 1,
    title: "现代Web开发的最佳实践与思考",
    description: "探讨现代Web开发中的关键技术栈选择、性能优化策略以及用户体验设计原则...",
    author: "作者 1",
    date: "2024年1月11日",
    likes: 25,
    views: 120,
    category: "技术",
  },
  {
    id: 2,
    title: "AI时代的设计思维转变",
    description: "人工智能正在重塑设计行业，从自动化工具到智能辅助设计...",
    author: "作者 2",
    date: "2024年1月12日",
    likes: 30,
    views: 140,
    category: "设计",
  },
  {
    id: 3,
    title: "构建可持续的开源项目",
    description: "开源项目的成功不仅在于代码质量，更在于社区建设和长期维护...",
    author: "作者 3",
    date: "2024年1月13日",
    likes: 35,
    views: 160,
    category: "开源",
  },
]

export function LatestContentSection() {
  return (
    <section className="px-4 py-16">
      <div className="container mx-auto">
        <div className="mb-8 flex flex-col items-center justify-between gap-4 md:flex-row">
          <h2 className="text-3xl font-bold">最新内容</h2>
          <div className="group inline-flex items-center gap-2">
            <Button variant="outline" asChild className="group bg-transparent transition-transform duration-200 group-hover:-translate-y-0.5">
              <Link href="/blog" className="flex items-center gap-2">
                查看全部
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {samplePosts.map((post) => (
            <div
              key={post.id}
              className="h-full transition-transform duration-300 hover:-translate-y-1.5 hover:shadow-lg"
            >
              <Card className="from-background to-muted/20 group h-full border-0 bg-gradient-to-br">
                <CardHeader>
                  <div className="mb-2 flex items-center space-x-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={`/author-writing.png?height=24&width=24&query=author ${post.id}`} />
                      <AvatarFallback>作者</AvatarFallback>
                    </Avatar>
                    <span className="text-muted-foreground text-sm">{post.author}</span>
                    <Badge
                      variant="secondary"
                      className="transition-colors group-hover:bg-primary group-hover:text-primary-foreground"
                    >
                      {post.category}
                    </Badge>
                  </div>

                  <CardTitle className="line-clamp-2 transition-colors group-hover:text-primary">{post.title}</CardTitle>
                  <CardDescription className="line-clamp-3">{post.description}</CardDescription>
                </CardHeader>

                <CardContent>
                  <div className="text-muted-foreground flex items-center justify-between text-sm">
                    <span>{post.date}</span>
                    <div className="flex items-center space-x-4">
                      <span className="flex items-center gap-1 transition-transform duration-200 group-hover:scale-105">
                        <Star className="h-3 w-3" />
                        {post.likes}
                      </span>
                      <span className="transition-transform duration-200 group-hover:translate-x-0.5">{post.views} 阅读</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
