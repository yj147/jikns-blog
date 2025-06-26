'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()

        if (error) {
          console.error('Auth callback error:', error)
          router.push('/auth/error?message=' + encodeURIComponent(error.message))
          return
        }

        if (data.session) {
          // 认证成功，重定向到首页或用户指定的页面
          const redirectTo = new URLSearchParams(window.location.search).get('redirect_to') || '/'
          router.push(redirectTo)
        } else {
          // 没有会话，重定向到登录页面
          router.push('/auth/login')
        }
      } catch (error) {
        console.error('Unexpected error in auth callback:', error)
        router.push('/auth/error?message=' + encodeURIComponent('认证过程中发生未知错误'))
      }
    }

    handleAuthCallback()
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="border-primary mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2"></div>
        <p className="text-gray-600 dark:text-gray-400">正在处理登录...</p>
      </div>
    </div>
  )
}
