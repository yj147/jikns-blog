'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline'

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        // 从URL hash中获取令牌
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        const type = hashParams.get('type')

        if (type === 'signup' && accessToken && refreshToken) {
          // 设置会话
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

          if (error) {
            setStatus('error')
            setMessage('邮箱验证失败：' + error.message)
          } else {
            setStatus('success')
            setMessage('邮箱验证成功！您现在可以正常使用所有功能。')

            // 3秒后自动跳转到首页
            setTimeout(() => {
              router.push('/')
            }, 3000)
          }
        } else {
          setStatus('error')
          setMessage('无效的验证链接或链接已过期')
        }
      } catch (error) {
        setStatus('error')
        setMessage('验证过程中发生错误，请稍后重试')
      }
    }

    verifyEmail()
  }, [router])

  const getIcon = () => {
    switch (status) {
      case 'success':
        return <CheckCircleIcon className="mx-auto h-12 w-12 text-green-500" />
      case 'error':
        return <ExclamationCircleIcon className="mx-auto h-12 w-12 text-red-500" />
      default:
        return (
          <div className="mx-auto h-12 w-12">
            <div className="border-primary-600 h-12 w-12 animate-spin rounded-full border-b-2"></div>
          </div>
        )
    }
  }

  const getTitle = () => {
    switch (status) {
      case 'success':
        return '邮箱验证成功'
      case 'error':
        return '邮箱验证失败'
      default:
        return '正在验证邮箱...'
    }
  }

  const getBgColor = () => {
    switch (status) {
      case 'success':
        return 'bg-green-50 dark:bg-green-900/20'
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20'
      default:
        return 'bg-blue-50 dark:bg-blue-900/20'
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md space-y-8">
        <div className={`rounded-lg p-8 text-center ${getBgColor()}`}>
          {getIcon()}

          <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
            {getTitle()}
          </h2>

          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{message}</p>

          {status === 'success' && (
            <p className="mt-4 text-xs text-gray-500 dark:text-gray-500">
              页面将在3秒后自动跳转到首页...
            </p>
          )}
        </div>

        <div className="space-y-4 text-center">
          <button
            onClick={() => router.push('/')}
            className="bg-primary-600 hover:bg-primary-700 focus:ring-primary-500 flex w-full justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white shadow-sm focus:ring-2 focus:ring-offset-2 focus:outline-none"
          >
            返回首页
          </button>

          {status === 'error' && (
            <button
              onClick={() => window.location.reload()}
              className="focus:ring-primary-500 flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:ring-2 focus:ring-offset-2 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              重新验证
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
