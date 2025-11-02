"use client"

import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useState } from "react"
import {
  Search,
  Filter,
  Calendar,
  Clock,
  Eye,
  Heart,
  MessageCircle,
  Users,
  BookOpen,
} from "lucide-react"

// Mock search results
const searchResults = {
  posts: [
    {
      id: 1,
      title: "现代Web开发的最佳实践与思考",
      excerpt: "探讨现代Web开发中的关键技术栈选择、性能优化策略以及用户体验设计原则...",
      author: {
        name: "张三",
        avatar: "/author-writing.png?height=32&width=32&query=author 1",
      },
      publishedAt: "2024年1月15日",
      readTime: "8分钟阅读",
      views: 1250,
      likes: 89,
      comments: 23,
      tags: ["技术", "Web开发", "最佳实践"],
    },
    {
      id: 2,
      title: "AI时代的设计思维转变",
      excerpt:
        "人工智能正在重塑设计行业，从自动化工具到智能辅助设计，设计师需要重新思考自己的角色和价值...",
      author: {
        name: "李四",
        avatar: "/author-writing.png?height=32&width=32&query=author 2",
      },
      publishedAt: "2024年1月12日",
      readTime: "6分钟阅读",
      views: 980,
      likes: 67,
      comments: 15,
      tags: ["设计", "AI", "思维"],
    },
  ],
  users: [
    {
      id: 1,
      name: "前端大师",
      username: "@frontend_master",
      avatar: "/author-writing.png?height=40&width=40&query=frontend expert",
      bio: "10年前端开发经验，React核心贡献者",
      followers: 15600,
      following: 234,
      verified: true,
    },
    {
      id: 2,
      name: "设计思维",
      username: "@design_thinking",
      avatar: "/author-writing.png?height=40&width=40&query=design expert",
      bio: "UX设计师，专注于用户体验研究",
      followers: 8900,
      following: 456,
      verified: false,
    },
  ],
  activities: [
    {
      id: 1,
      user: {
        name: "王五",
        username: "@wangwu",
        avatar: "/author-writing.png?height=32&width=32&query=user 3",
      },
      content: "开源项目更新！我们的UI组件库新增了10个组件，包括数据表格、日期选择器、文件上传等。",
      timestamp: "6小时前",
      likes: 67,
      comments: 15,
      reposts: 12,
    },
  ],
}

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("all")

  return (
    <div className="bg-background min-h-screen">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-4xl">
          {/* Search Header */}
          <div className="mb-8">
            <h1 className="mb-4 text-3xl font-bold">搜索</h1>
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform" />
                <Input
                  placeholder="搜索文章、用户、话题..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button variant="outline">
                <Filter className="mr-2 h-4 w-4" />
                筛选
              </Button>
            </div>
          </div>

          {/* Search Results */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">全部</TabsTrigger>
              <TabsTrigger value="posts" className="flex items-center">
                <BookOpen className="mr-2 h-4 w-4" />
                文章
              </TabsTrigger>
              <TabsTrigger value="users" className="flex items-center">
                <Users className="mr-2 h-4 w-4" />
                用户
              </TabsTrigger>
              <TabsTrigger value="activities">动态</TabsTrigger>
            </TabsList>

            {/* All Results */}
            <TabsContent value="all" className="space-y-8">
              {/* Posts Section */}
              <div>
                <h2 className="mb-4 text-xl font-semibold">文章</h2>
                <div className="space-y-4">
                  {searchResults.posts.map((post) => (
                    <Card key={post.id} className="transition-shadow hover:shadow-lg">
                      <CardHeader>
                        <div className="mb-3 flex items-center space-x-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage
                              src={post.author.avatar || "/placeholder.svg"}
                              alt={post.author.name}
                            />
                            <AvatarFallback>{post.author.name[0]}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{post.author.name}</p>
                            <div className="text-muted-foreground flex items-center space-x-2 text-xs">
                              <Calendar className="h-3 w-3" />
                              <span>{post.publishedAt}</span>
                              <Clock className="ml-2 h-3 w-3" />
                              <span>{post.readTime}</span>
                            </div>
                          </div>
                        </div>
                        <CardTitle className="line-clamp-2 text-lg">{post.title}</CardTitle>
                        <CardDescription className="line-clamp-2">{post.excerpt}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="mb-4 flex flex-wrap gap-2">
                          {post.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        <div className="text-muted-foreground flex items-center justify-between text-sm">
                          <div className="flex items-center space-x-4">
                            <span className="flex items-center">
                              <Eye className="mr-1 h-3 w-3" />
                              {post.views}
                            </span>
                            <span className="flex items-center">
                              <Heart className="mr-1 h-3 w-3" />
                              {post.likes}
                            </span>
                            <span className="flex items-center">
                              <MessageCircle className="mr-1 h-3 w-3" />
                              {post.comments}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Users Section */}
              <div>
                <h2 className="mb-4 text-xl font-semibold">用户</h2>
                <div className="space-y-4">
                  {searchResults.users.map((user) => (
                    <Card key={user.id} className="transition-shadow hover:shadow-lg">
                      <CardContent className="pt-6">
                        <div className="flex items-start space-x-4">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={user.avatar || "/placeholder.svg"} alt={user.name} />
                            <AvatarFallback>{user.name[0]}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center space-x-2">
                              <h3 className="font-semibold">{user.name}</h3>
                              {user.verified && (
                                <div className="bg-primary flex h-4 w-4 items-center justify-center rounded-full">
                                  <div className="h-2 w-2 rounded-full bg-white" />
                                </div>
                              )}
                            </div>
                            <p className="text-muted-foreground mb-2 text-sm">{user.username}</p>
                            <p className="mb-3 line-clamp-2 text-sm">{user.bio}</p>
                            <div className="text-muted-foreground flex items-center space-x-4 text-sm">
                              <span>{user.followers.toLocaleString()} 关注者</span>
                              <span>{user.following} 关注中</span>
                            </div>
                          </div>
                          <Button variant="outline" size="sm">
                            关注
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Posts Only */}
            <TabsContent value="posts" className="space-y-4">
              {searchResults.posts.map((post) => (
                <Card key={post.id} className="transition-shadow hover:shadow-lg">
                  <CardHeader>
                    <div className="mb-3 flex items-center space-x-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage
                          src={post.author.avatar || "/placeholder.svg"}
                          alt={post.author.name}
                        />
                        <AvatarFallback>{post.author.name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{post.author.name}</p>
                        <div className="text-muted-foreground flex items-center space-x-2 text-xs">
                          <Calendar className="h-3 w-3" />
                          <span>{post.publishedAt}</span>
                          <Clock className="ml-2 h-3 w-3" />
                          <span>{post.readTime}</span>
                        </div>
                      </div>
                    </div>
                    <CardTitle className="line-clamp-2 text-lg">{post.title}</CardTitle>
                    <CardDescription className="line-clamp-2">{post.excerpt}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4 flex flex-wrap gap-2">
                      {post.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <div className="text-muted-foreground flex items-center justify-between text-sm">
                      <div className="flex items-center space-x-4">
                        <span className="flex items-center">
                          <Eye className="mr-1 h-3 w-3" />
                          {post.views}
                        </span>
                        <span className="flex items-center">
                          <Heart className="mr-1 h-3 w-3" />
                          {post.likes}
                        </span>
                        <span className="flex items-center">
                          <MessageCircle className="mr-1 h-3 w-3" />
                          {post.comments}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            {/* Users Only */}
            <TabsContent value="users" className="space-y-4">
              {searchResults.users.map((user) => (
                <Card key={user.id} className="transition-shadow hover:shadow-lg">
                  <CardContent className="pt-6">
                    <div className="flex items-start space-x-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={user.avatar || "/placeholder.svg"} alt={user.name} />
                        <AvatarFallback>{user.name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center space-x-2">
                          <h3 className="font-semibold">{user.name}</h3>
                          {user.verified && (
                            <div className="bg-primary flex h-4 w-4 items-center justify-center rounded-full">
                              <div className="h-2 w-2 rounded-full bg-white" />
                            </div>
                          )}
                        </div>
                        <p className="text-muted-foreground mb-2 text-sm">{user.username}</p>
                        <p className="mb-3 line-clamp-2 text-sm">{user.bio}</p>
                        <div className="text-muted-foreground flex items-center space-x-4 text-sm">
                          <span>{user.followers.toLocaleString()} 关注者</span>
                          <span>{user.following} 关注中</span>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        关注
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            {/* Activities Only */}
            <TabsContent value="activities" className="space-y-4">
              {searchResults.activities.map((activity) => (
                <Card key={activity.id} className="transition-shadow hover:shadow-md">
                  <CardContent className="pt-6">
                    <div className="mb-4 flex items-start space-x-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage
                          src={activity.user.avatar || "/placeholder.svg"}
                          alt={activity.user.name}
                        />
                        <AvatarFallback>{activity.user.name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex items-center space-x-2">
                          <p className="text-sm font-semibold">{activity.user.name}</p>
                          <p className="text-muted-foreground text-sm">{activity.user.username}</p>
                          <span className="text-muted-foreground text-sm">·</span>
                          <p className="text-muted-foreground text-sm">{activity.timestamp}</p>
                        </div>
                        <p className="text-foreground mb-3">{activity.content}</p>
                        <div className="text-muted-foreground flex items-center space-x-4 text-sm">
                          <span className="flex items-center">
                            <Heart className="mr-1 h-3 w-3" />
                            {activity.likes}
                          </span>
                          <span className="flex items-center">
                            <MessageCircle className="mr-1 h-3 w-3" />
                            {activity.comments}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          </Tabs>

          {/* No Results */}
          {searchQuery && (
            <div className="py-12 text-center">
              <Search className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
              <h3 className="mb-2 text-lg font-semibold">没有找到相关结果</h3>
              <p className="text-muted-foreground">尝试使用不同的关键词或检查拼写</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
