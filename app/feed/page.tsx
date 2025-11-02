"use client"

import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useState } from "react"
import {
  Heart,
  MessageCircle,
  Repeat2,
  Share,
  MoreHorizontal,
  ImageIcon,
  Smile,
  Hash,
  TrendingUp,
  Users,
  Clock,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

// Mock data for social activities
const activities = [
  {
    id: 1,
    user: {
      name: "张三",
      username: "@zhangsan",
      avatar: "/author-writing.png?height=40&width=40&query=user 1",
      verified: true,
    },
    content:
      "刚刚完成了一个React项目的重构，使用了最新的Hooks和Context API。代码量减少了30%，性能提升明显！分享一些心得：\n\n1. 合理使用useMemo和useCallback\n2. 状态管理要保持简洁\n3. 组件拆分要适度\n\n#React #前端开发 #重构",
    images: ["/code-refactoring.png"],
    timestamp: "2小时前",
    likes: 42,
    comments: 8,
    reposts: 3,
    isLiked: false,
    isReposted: false,
  },
  {
    id: 2,
    user: {
      name: "李四",
      username: "@lisi",
      avatar: "/author-writing.png?height=40&width=40&query=user 2",
      verified: false,
    },
    content:
      "今天参加了一个关于AI在设计领域应用的研讨会，收获满满！AI工具确实能提高效率，但设计师的创意思维和人文关怀仍然不可替代。\n\n未来的设计师需要学会与AI协作，而不是被AI替代。 #AI设计 #用户体验",
    images: [],
    timestamp: "4小时前",
    likes: 28,
    comments: 12,
    reposts: 5,
    isLiked: true,
    isReposted: false,
  },
  {
    id: 3,
    user: {
      name: "王五",
      username: "@wangwu",
      avatar: "/author-writing.png?height=40&width=40&query=user 3",
      verified: true,
    },
    content:
      "开源项目更新！🎉\n\n我们的UI组件库新增了10个组件，包括数据表格、日期选择器、文件上传等。感谢社区贡献者们的努力！\n\n📦 npm install @mylib/components@latest\n📚 文档：mylib.dev\n\n#开源 #组件库 #React",
    images: ["/ui-components.png", "/component-library.png"],
    timestamp: "6小时前",
    likes: 67,
    comments: 15,
    reposts: 12,
    isLiked: false,
    isReposted: true,
  },
  {
    id: 4,
    user: {
      name: "赵六",
      username: "@zhaoliu",
      avatar: "/author-writing.png?height=40&width=40&query=user 4",
      verified: false,
    },
    content: "动态内容暂无",
    images: [],
    timestamp: "8小时前",
    likes: 35,
    comments: 6,
    reposts: 8,
    isLiked: true,
    isReposted: false,
  },
  {
    id: 5,
    user: {
      name: "孙七",
      username: "@sunqi",
      avatar: "/author-writing.png?height=40&width=40&query=user 5",
      verified: true,
    },
    content:
      "刚刚看完了《设计心理学》这本书，深受启发。用户体验设计不仅仅是界面美观，更重要的是理解用户的认知模式和行为习惯。\n\n推荐给所有设计师和产品经理！📖 #设计心理学 #用户体验 #产品设计",
    images: ["/design-psychology-book.png"],
    timestamp: "1天前",
    likes: 89,
    comments: 23,
    reposts: 18,
    isLiked: false,
    isReposted: false,
  },
]

// Mock trending topics
const trendingTopics = [
  { tag: "React", posts: 1234 },
  { tag: "AI设计", posts: 856 },
  { tag: "前端开发", posts: 2341 },
  { tag: "用户体验", posts: 678 },
  { tag: "开源项目", posts: 445 },
]

// Mock suggested users
const suggestedUsers = [
  {
    name: "前端大师",
    username: "@frontend_master",
    avatar: "/author-writing.png?height=32&width=32&query=frontend expert",
    bio: "10年前端开发经验，React核心贡献者",
    followers: 15600,
  },
  {
    name: "设计思维",
    username: "@design_thinking",
    avatar: "/author-writing.png?height=32&width=32&query=design expert",
    bio: "UX设计师，专注于用户体验研究",
    followers: 8900,
  },
  {
    name: "开源爱好者",
    username: "@opensource_lover",
    avatar: "/author-writing.png?height=32&width=32&query=opensource developer",
    bio: "开源项目维护者，Node.js专家",
    followers: 12300,
  },
]

export default function FeedPage() {
  const [newPost, setNewPost] = useState("")
  const [activeTab, setActiveTab] = useState("following")
  const [likedPosts, setLikedPosts] = useState<Set<number>>(new Set())
  const [repostedPosts, setRepostedPosts] = useState<Set<number>>(new Set())

  const handleLike = (id: number) => {
    setLikedPosts((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const handleRepost = (id: number) => {
    setRepostedPosts((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const handleComment = (id: number) => {}

  return (
    <div className="bg-background min-h-screen">
      <Navigation />

      <div className="container mx-auto px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-4">
          {/* Main Feed */}
          <div className="lg:col-span-2 lg:col-start-2">
            {/* Post Composer */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Card className="mb-6 transition-shadow hover:shadow-lg">
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <motion.div whileHover={{ scale: 1.1 }}>
                      <Avatar className="h-10 w-10">
                        <AvatarImage
                          src="/author-writing.png?height=40&width=40&query=current user"
                          alt="当前用户"
                        />
                        <AvatarFallback>我</AvatarFallback>
                      </Avatar>
                    </motion.div>
                    <div className="flex-1">
                      <motion.div
                        whileFocus={{ scale: 1.01 }}
                        transition={{ type: "spring", stiffness: 300 }}
                      >
                        <Textarea
                          placeholder="分享你的想法..."
                          value={newPost}
                          onChange={(e) => setNewPost(e.target.value)}
                          className="min-h-[80px] resize-none border-none p-0 focus-visible:ring-0"
                        />
                      </motion.div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                        <Button variant="ghost" size="sm">
                          <ImageIcon className="mr-2 h-4 w-4" />
                          图片
                        </Button>
                      </motion.div>
                      <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                        <Button variant="ghost" size="sm">
                          <Smile className="mr-2 h-4 w-4" />
                          表情
                        </Button>
                      </motion.div>
                      <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                        <Button variant="ghost" size="sm">
                          <Hash className="mr-2 h-4 w-4" />
                          话题
                        </Button>
                      </motion.div>
                    </div>
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Button disabled={!newPost.trim()}>发布</Button>
                    </motion.div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Feed Tabs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="following">关注</TabsTrigger>
                  <TabsTrigger value="trending">热门</TabsTrigger>
                  <TabsTrigger value="latest">最新</TabsTrigger>
                </TabsList>
              </Tabs>
            </motion.div>

            {/* Activity Feed */}
            <motion.div
              className="space-y-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <AnimatePresence>
                {activities.map((activity, index) => (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -50 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    whileHover={{ y: -3, scale: 1.01 }}
                    layout
                  >
                    <Card className="from-background to-muted/5 border-0 bg-gradient-to-br transition-all duration-300 hover:shadow-xl">
                      <CardContent className="pt-6">
                        {/* User Info */}
                        <div className="mb-4 flex items-start space-x-3">
                          <motion.div whileHover={{ scale: 1.1, rotate: 5 }}>
                            <Avatar className="h-10 w-10">
                              <AvatarImage
                                src={activity.user.avatar || "/placeholder.svg"}
                                alt={activity.user.name}
                              />
                              <AvatarFallback>{activity.user.name[0]}</AvatarFallback>
                            </Avatar>
                          </motion.div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center space-x-2">
                              <p className="text-sm font-semibold">{activity.user.name}</p>
                              {activity.user.verified && (
                                <motion.div
                                  className="bg-primary flex h-4 w-4 items-center justify-center rounded-full"
                                  whileHover={{ scale: 1.2 }}
                                  animate={{ rotate: [0, 360] }}
                                  transition={{
                                    duration: 2,
                                    repeat: Number.POSITIVE_INFINITY,
                                    ease: "linear",
                                  }}
                                >
                                  <div className="h-2 w-2 rounded-full bg-white" />
                                </motion.div>
                              )}
                              <p className="text-muted-foreground text-sm">
                                {activity.user.username}
                              </p>
                              <span className="text-muted-foreground text-sm">·</span>
                              <p className="text-muted-foreground text-sm">{activity.timestamp}</p>
                            </div>
                          </div>
                          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </motion.div>
                        </div>

                        {/* Content */}
                        <motion.div
                          className="mb-4"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.2 }}
                        >
                          <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                            {activity.content}
                          </p>
                        </motion.div>

                        {/* Images */}
                        {activity.images.length > 0 && (
                          <motion.div
                            className={`mb-4 grid gap-2 ${activity.images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.3 }}
                          >
                            {activity.images.map((image, imageIndex) => (
                              <motion.div
                                key={imageIndex}
                                className="overflow-hidden rounded-lg"
                                whileHover={{ scale: 1.02 }}
                                transition={{ type: "spring", stiffness: 300 }}
                              >
                                <img
                                  src={image || "/placeholder.svg"}
                                  alt={`Activity image ${imageIndex + 1}`}
                                  className="h-auto w-full object-cover"
                                />
                              </motion.div>
                            ))}
                          </motion.div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center justify-between border-t pt-2">
                          <div className="flex items-center space-x-6">
                            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleLike(activity.id)}
                                className={likedPosts.has(activity.id) ? "text-red-500" : ""}
                              >
                                <motion.div
                                  animate={
                                    likedPosts.has(activity.id) ? { scale: [1, 1.3, 1] } : {}
                                  }
                                  transition={{ duration: 0.3 }}
                                >
                                  <Heart
                                    className={`mr-2 h-4 w-4 ${likedPosts.has(activity.id) ? "fill-current" : ""}`}
                                  />
                                </motion.div>
                                {activity.likes + (likedPosts.has(activity.id) ? 1 : 0)}
                              </Button>
                            </motion.div>

                            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleComment(activity.id)}
                              >
                                <MessageCircle className="mr-2 h-4 w-4" />
                                {activity.comments}
                              </Button>
                            </motion.div>

                            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRepost(activity.id)}
                                className={repostedPosts.has(activity.id) ? "text-green-500" : ""}
                              >
                                <motion.div
                                  animate={
                                    repostedPosts.has(activity.id) ? { rotate: [0, 360] } : {}
                                  }
                                  transition={{ duration: 0.5 }}
                                >
                                  <Repeat2 className="mr-2 h-4 w-4" />
                                </motion.div>
                                {activity.reposts + (repostedPosts.has(activity.id) ? 1 : 0)}
                              </Button>
                            </motion.div>

                            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                              <Button variant="ghost" size="sm">
                                <Share className="h-4 w-4" />
                              </Button>
                            </motion.div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          </div>

          {/* Left Sidebar */}
          <motion.div
            className="lg:col-span-1"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <div className="sticky top-24 space-y-6">
              {/* User Profile Card */}
              <motion.div whileHover={{ scale: 1.02 }}>
                <Card className="transition-shadow hover:shadow-lg">
                  <CardContent className="pt-6">
                    <div className="mb-4 flex items-center space-x-3">
                      <motion.div whileHover={{ scale: 1.1 }}>
                        <Avatar className="h-12 w-12">
                          <AvatarImage
                            src="/author-writing.png?height=48&width=48&query=current user profile"
                            alt="当前用户"
                          />
                          <AvatarFallback>我</AvatarFallback>
                        </Avatar>
                      </motion.div>
                      <div>
                        <p className="font-semibold">张三</p>
                        <p className="text-muted-foreground text-sm">@zhangsan</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      {[
                        { label: "动态", value: "128" },
                        { label: "关注", value: "456" },
                        { label: "粉丝", value: "789" },
                      ].map((stat, index) => (
                        <motion.div
                          key={stat.label}
                          whileHover={{ scale: 1.1, y: -2 }}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                        >
                          <p className="font-semibold">{stat.value}</p>
                          <p className="text-muted-foreground text-xs">{stat.label}</p>
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Quick Actions */}
              <motion.div whileHover={{ scale: 1.02 }}>
                <Card className="transition-shadow hover:shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-lg">快捷操作</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {[
                        { icon: Users, label: "发现用户" },
                        { icon: Hash, label: "热门话题" },
                        { icon: Clock, label: "我的动态" },
                      ].map((action, index) => {
                        const Icon = action.icon
                        return (
                          <motion.div
                            key={action.label}
                            whileHover={{ scale: 1.05, x: 5 }}
                            whileTap={{ scale: 0.95 }}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                          >
                            <Button
                              variant="outline"
                              className="w-full justify-start bg-transparent"
                            >
                              <Icon className="mr-2 h-4 w-4" />
                              {action.label}
                            </Button>
                          </motion.div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </motion.div>

          {/* Right Sidebar */}
          <motion.div
            className="lg:col-span-1"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <div className="sticky top-24 space-y-6">
              {/* Trending Topics */}
              <motion.div whileHover={{ scale: 1.02 }}>
                <Card className="transition-shadow hover:shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center text-lg">
                      <TrendingUp className="mr-2 h-5 w-5" />
                      热门话题
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {trendingTopics.map((topic, index) => (
                        <motion.div
                          key={topic.tag}
                          className="flex items-center justify-between"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          whileHover={{ x: 5, scale: 1.02 }}
                        >
                          <div>
                            <p className="font-medium">#{topic.tag}</p>
                            <p className="text-muted-foreground text-xs">{topic.posts} 条动态</p>
                          </div>
                          <motion.div
                            whileHover={{ scale: 1.1 }}
                            animate={{
                              backgroundColor:
                                index < 3 ? ["#10b981", "#059669", "#10b981"] : "#6b7280",
                            }}
                            transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                          >
                            <Badge variant="secondary" className="text-xs">
                              {index + 1}
                            </Badge>
                          </motion.div>
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Suggested Users */}
              <motion.div whileHover={{ scale: 1.02 }}>
                <Card className="transition-shadow hover:shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-lg">推荐关注</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {suggestedUsers.map((user, index) => (
                        <motion.div
                          key={user.username}
                          className="flex items-start space-x-3"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          whileHover={{ scale: 1.02, x: 5 }}
                        >
                          <motion.div whileHover={{ scale: 1.1 }}>
                            <Avatar className="h-10 w-10">
                              <AvatarImage
                                src={user.avatar || "/placeholder.svg"}
                                alt={user.name}
                              />
                              <AvatarFallback>{user.name[0]}</AvatarFallback>
                            </Avatar>
                          </motion.div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">{user.name}</p>
                            <p className="text-muted-foreground text-xs">{user.username}</p>
                            <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                              {user.bio}
                            </p>
                            <p className="text-muted-foreground mt-1 text-xs">
                              {user.followers.toLocaleString()} 关注者
                            </p>
                          </div>
                          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                            <Button size="sm" variant="outline">
                              关注
                            </Button>
                          </motion.div>
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
