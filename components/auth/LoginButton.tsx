'use client'

import { useState } from 'react'
import { useAuth } from './AuthProvider'

interface LoginButtonProps {
  className?: string
  children?: React.ReactNode
}

export function LoginButton({ className = '', children }: LoginButtonProps) {
  const { user, signInWithOAuth, signOut, loading } = useAuth()
  const [isLoading, setIsLoading] = useState(false)

  const handleGitHubLogin = async () => {
    setIsLoading(true)
    try {
      const { error } = await signInWithOAuth('github')
      if (error) {
        console.error('GitHub login error:', error)
        alert('登录失败：' + error.message)
      }
    } catch (error) {
      console.error('Login error:', error)
      alert('登录过程中发生错误')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignOut = async () => {
    setIsLoading(true)
    try {
      const { error } = await signOut()
      if (error) {
        console.error('Sign out error:', error)
        alert('登出失败：' + error.message)
      }
    } catch (error) {
      console.error('Sign out error:', error)
      alert('登出过程中发生错误')
    } finally {
      setIsLoading(false)
    }
  }

  if (loading) {
    return (
      <div className={`inline-flex items-center ${className}`}>
        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-current"></div>
        <span>加载中...</span>
      </div>
    )
  }

  if (user) {
    return (
      <div className={`inline-flex items-center space-x-2 ${className}`}>
        {user.avatar_url && (
          <img
            src={user.avatar_url}
            alt={user.display_name || '用户头像'}
            className="h-6 w-6 rounded-full"
          />
        )}
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {user.display_name || user.username || '用户'}
        </span>
        <button
          onClick={handleSignOut}
          disabled={isLoading}
          className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50 dark:text-gray-400 dark:hover:text-gray-200"
        >
          {isLoading ? '登出中...' : '登出'}
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={handleGitHubLogin}
      disabled={isLoading}
      className={`inline-flex items-center rounded-md border border-transparent bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {isLoading ? (
        <>
          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
          登录中...
        </>
      ) : (
        <>
          <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z"
              clipRule="evenodd"
            />
          </svg>
          {children || '使用 GitHub 登录'}
        </>
      )}
    </button>
  )
}
