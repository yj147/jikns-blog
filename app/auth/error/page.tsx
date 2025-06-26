'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'

export default function AuthError() {
  const searchParams = useSearchParams()
  const message = searchParams.get('message') || '认证过程中发生未知错误'

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-500" />
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">登录失败</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{message}</p>
        </div>

        <div className="mt-8 space-y-4">
          <Link
            href="/"
            className="bg-primary-600 hover:bg-primary-700 focus:ring-primary-500 flex w-full justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white shadow-sm focus:ring-2 focus:ring-offset-2 focus:outline-none"
          >
            返回首页
          </Link>

          <button
            onClick={() => window.history.back()}
            className="focus:ring-primary-500 flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:ring-2 focus:ring-offset-2 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            重新尝试
          </button>
        </div>
      </div>
    </div>
  )
}
