'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function QQCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const handleQQCallback = async () => {
      try {
        const code = searchParams.get('code')
        const state = searchParams.get('state')
        const error = searchParams.get('error')

        // 检查是否有错误
        if (error) {
          console.error('QQ OAuth error:', error)
          router.push('/auth/error?message=' + encodeURIComponent('QQ登录被取消或失败'))
          return
        }

        // 验证state参数
        const savedState = sessionStorage.getItem('qq_oauth_state')
        if (!state || state !== savedState) {
          console.error('Invalid state parameter')
          router.push('/auth/error?message=' + encodeURIComponent('QQ登录验证失败'))
          return
        }

        // 清除保存的state
        sessionStorage.removeItem('qq_oauth_state')

        if (!code) {
          router.push('/auth/error?message=' + encodeURIComponent('QQ登录授权码缺失'))
          return
        }

        // 调用后端API处理QQ登录
        const response = await fetch('/api/auth/qq/callback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code }),
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'QQ登录处理失败')
        }

        if (result.success) {
          // 登录成功，重定向到首页
          router.push('/')
        } else {
          throw new Error(result.error || '登录失败')
        }
      } catch (error) {
        console.error('QQ callback error:', error)
        router.push(
          '/auth/error?message=' +
            encodeURIComponent(error instanceof Error ? error.message : 'QQ登录处理失败')
        )
      }
    }

    handleQQCallback()
  }, [router, searchParams])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="border-primary-600 mx-auto h-12 w-12 animate-spin rounded-full border-b-2"></div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
            正在处理QQ登录...
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            请稍候，我们正在验证您的QQ账户信息
          </p>
        </div>
      </div>
    </div>
  )
}

export default function QQAuthCallback() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="w-full max-w-md space-y-8">
            <div className="text-center">
              <div className="border-primary-600 mx-auto h-12 w-12 animate-spin rounded-full border-b-2"></div>
              <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
                正在处理QQ登录...
              </h2>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">加载中...</p>
            </div>
          </div>
        </div>
      }
    >
      <QQCallbackContent />
    </Suspense>
  )
}
