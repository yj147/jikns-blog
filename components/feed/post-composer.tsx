"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Textarea } from "@/components/ui/textarea"
import { ImageIcon, Smile, Hash } from "lucide-react"
import { useActivityMutations, useImageUpload } from "@/hooks/use-activities"
import { useAuth } from "@/hooks/use-auth"

export default function PostComposer() {
  const [newPost, setNewPost] = useState("")
  const { user } = useAuth()
  const { createActivity, isLoading: isMutating } = useActivityMutations()
  const { isUploading } = useImageUpload()

  const handleCreatePost = async () => {
    if (!newPost.trim()) return

    try {
      await createActivity({
        content: newPost,
        imageUrls: [],
        isPinned: false,
      })
      setNewPost("")
    } catch (error) {
      // Error handling is done in the hook
    }
  }

  if (!user) {
    return null
  }

  return (
    <Card className="mb-6 transition-shadow hover:shadow-lg">
      <CardHeader>
        <div className="flex items-center space-x-3">
          <div>
            <Avatar className="h-10 w-10">
              <AvatarImage
                src={user.avatarUrl || "/placeholder.svg"}
                alt={user.name || "当前用户"}
              />
              <AvatarFallback>{user.name?.[0] || "我"}</AvatarFallback>
            </Avatar>
          </div>
          <div className="flex-1">
            <div>
              <Textarea
                placeholder="分享你的想法..."
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                className="min-h-[80px] resize-none border-none p-0 focus-visible:ring-0"
                disabled={isMutating || isUploading}
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div>
              <Button variant="ghost" size="sm" disabled={isUploading}>
                <ImageIcon className="mr-2 h-4 w-4" />
                图片
              </Button>
            </div>
            <div>
              <Button variant="ghost" size="sm">
                <Smile className="mr-2 h-4 w-4" />
                表情
              </Button>
            </div>
            <div>
              <Button variant="ghost" size="sm">
                <Hash className="mr-2 h-4 w-4" />
                话题
              </Button>
            </div>
          </div>
          <div>
            <Button
              disabled={!newPost.trim() || isMutating || isUploading}
              onClick={handleCreatePost}
            >
              {isMutating ? "发布中..." : "发布"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
