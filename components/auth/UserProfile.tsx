'use client'

import { useState, useEffect } from 'react'
import { useAuth } from './AuthProvider'
import { UserAvatar } from './UserAvatar'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/ToastContainer'

interface UserProfileProps {
  className?: string
}

export function UserProfile({ className = '' }: UserProfileProps) {
  const { user, loading } = useAuth()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    display_name: '',
    username: '',
    bio: '',
    website: '',
  })
  const { showSuccess, showError } = useToast()

  useEffect(() => {
    if (user) {
      setFormData({
        display_name: user.display_name || '',
        username: user.username || '',
        bio: user.bio || '',
        website: user.website || '',
      })
    }
  }, [user])

  const handleSave = async () => {
    if (!user) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('users')
        .update({
          display_name: formData.display_name,
          username: formData.username,
          bio: formData.bio,
          website: formData.website,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (error) {
        throw error
      }

      setEditing(false)
      showSuccess('个人资料更新成功！')
    } catch (error) {
      console.error('Error updating profile:', error)
      showError('更新失败', '请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    if (user) {
      setFormData({
        display_name: user.display_name || '',
        username: user.username || '',
        bio: user.bio || '',
        website: user.website || '',
      })
    }
    setEditing(false)
  }

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <div className="h-16 w-16 rounded-full bg-gray-300 dark:bg-gray-600"></div>
            <div className="space-y-2">
              <div className="h-4 w-32 rounded bg-gray-300 dark:bg-gray-600"></div>
              <div className="h-3 w-48 rounded bg-gray-300 dark:bg-gray-600"></div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-3 rounded bg-gray-300 dark:bg-gray-600"></div>
            <div className="h-3 w-3/4 rounded bg-gray-300 dark:bg-gray-600"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className={`py-8 text-center ${className}`}>
        <p className="text-gray-500 dark:text-gray-400">请先登录以查看个人资料</p>
      </div>
    )
  }

  return (
    <div className={`mx-auto max-w-2xl ${className}`}>
      <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">个人资料</h2>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 border-primary-600 dark:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-md border px-4 py-2 text-sm font-medium transition-colors"
            >
              编辑资料
            </button>
          )}
        </div>

        <div className="space-y-6">
          {/* 头像和基本信息 */}
          <div className="flex items-center space-x-6">
            <UserAvatar user={user} size="xl" />
            <div className="flex-1">
              {editing ? (
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      显示名称
                    </label>
                    <input
                      type="text"
                      value={formData.display_name}
                      onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                      className="focus:ring-primary-500 focus:border-primary-500 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:ring-2 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      placeholder="请输入显示名称"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      用户名
                    </label>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className="focus:ring-primary-500 focus:border-primary-500 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:ring-2 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      placeholder="请输入用户名"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {user.display_name || user.username || '未设置名称'}
                  </h3>
                  {user.username && user.display_name !== user.username && (
                    <p className="text-gray-500 dark:text-gray-400">@{user.username}</p>
                  )}
                  <p className="mt-1 text-gray-600 dark:text-gray-300">{user.email}</p>
                </div>
              )}
            </div>
          </div>

          {/* 个人简介 */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              个人简介
            </label>
            {editing ? (
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                rows={4}
                className="focus:ring-primary-500 focus:border-primary-500 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:ring-2 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                placeholder="介绍一下自己..."
              />
            ) : (
              <div className="whitespace-pre-wrap text-gray-600 dark:text-gray-300">
                {user.bio || '这个人很懒，什么都没有留下...'}
              </div>
            )}
          </div>

          {/* 网站 */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              个人网站
            </label>
            {editing ? (
              <input
                type="url"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                className="focus:ring-primary-500 focus:border-primary-500 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:ring-2 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                placeholder="https://your-website.com"
              />
            ) : (
              <div>
                {user.website ? (
                  <a
                    href={user.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:underline"
                  >
                    {user.website}
                  </a>
                ) : (
                  <span className="text-gray-500 dark:text-gray-400">未设置</span>
                )}
              </div>
            )}
          </div>

          {/* 编辑模式的操作按钮 */}
          {editing && (
            <div className="flex space-x-3 pt-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-primary-600 hover:bg-primary-700 focus:ring-primary-500 rounded-md px-4 py-2 text-white focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存'}
              </button>
              <button
                onClick={handleCancel}
                disabled={saving}
                className="focus:ring-primary-500 rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                取消
              </button>
            </div>
          )}

          {/* 账户信息 */}
          <div className="border-t border-gray-200 pt-6 dark:border-gray-700">
            <h4 className="mb-4 text-lg font-medium text-gray-900 dark:text-white">账户信息</h4>
            <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
              <div>
                <span className="text-gray-500 dark:text-gray-400">注册时间：</span>
                <span className="ml-2 text-gray-900 dark:text-white">
                  {user.created_at ? new Date(user.created_at).toLocaleDateString('zh-CN') : '未知'}
                </span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">最后登录：</span>
                <span className="ml-2 text-gray-900 dark:text-white">
                  {user.last_login_at
                    ? new Date(user.last_login_at).toLocaleDateString('zh-CN')
                    : '未记录'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
