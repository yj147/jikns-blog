'use client'

import { useState } from 'react'
import Image from 'next/image'
import { generateAvatarUrl } from '@/lib/supabase'

interface UserAvatarProps {
  user?: {
    id: string
    display_name?: string
    username?: string
    email?: string
    avatar_url?: string
  } | null
  email?: string
  name?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  showName?: boolean
}

const sizeClasses = {
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-10 h-10',
  xl: 'w-12 h-12',
}

const textSizeClasses = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
  xl: 'text-lg',
}

export function UserAvatar({
  user,
  email,
  name,
  size = 'md',
  className = '',
  showName = false,
}: UserAvatarProps) {
  const [imageError, setImageError] = useState(false)

  // 确定头像 URL
  const avatarUrl = user?.avatar_url || (email ? generateAvatarUrl(email) : null)

  // 确定显示名称
  const displayName = user?.display_name || user?.username || name || email?.split('@')[0] || '用户'

  // 确定初始字母（用于备用头像）
  const initials = displayName.charAt(0).toUpperCase()

  const avatarElement =
    avatarUrl && !imageError ? (
      <Image
        src={avatarUrl}
        alt={displayName}
        width={size === 'sm' ? 24 : size === 'md' ? 32 : size === 'lg' ? 40 : 48}
        height={size === 'sm' ? 24 : size === 'md' ? 32 : size === 'lg' ? 40 : 48}
        className={`${sizeClasses[size]} rounded-full object-cover ${className}`}
        unoptimized={true}
        onError={(e) => {
          console.error('Avatar image failed to load:', avatarUrl)
          setImageError(true)
        }}
      />
    ) : (
      <div
        className={`${sizeClasses[size]} from-primary-400 to-primary-600 flex items-center justify-center rounded-full bg-gradient-to-br font-medium text-white ${textSizeClasses[size]} ${className}`}
      >
        {initials}
      </div>
    )

  if (showName) {
    return (
      <div className="flex items-center space-x-2">
        {avatarElement}
        <span className={`text-gray-700 dark:text-gray-300 ${textSizeClasses[size]} font-medium`}>
          {displayName}
        </span>
      </div>
    )
  }

  return avatarElement
}
