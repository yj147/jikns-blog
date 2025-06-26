'use client'

import { useState, Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { useAuth } from './AuthProvider'
import { useToast } from '@/components/ui/ToastContainer'
import { PasswordResetModal } from './PasswordResetModal'
import Image from 'next/image'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  defaultTab?: 'login' | 'register'
}

export function AuthModal({ isOpen, onClose, defaultTab = 'login' }: AuthModalProps) {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(defaultTab)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPasswordReset, setShowPasswordReset] = useState(false)

  const { signIn, signUp, signInWithOAuth } = useAuth()
  const { showSuccess, showError } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (activeTab === 'login') {
        const { error } = await signIn(email, password)
        if (error) {
          setError(error.message)
        } else {
          onClose()
          resetForm()
        }
      } else {
        if (password !== confirmPassword) {
          setError('密码确认不匹配')
          return
        }

        const { error } = await signUp(email, password, {
          display_name: displayName,
        })

        if (error) {
          setError(error.message)
        } else {
          setError('')
          showSuccess('注册成功！', '请检查您的邮箱以验证账户。')
          onClose()
          resetForm()
        }
      }
    } catch (err) {
      setError('操作失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const handleOAuthLogin = async (provider: 'github' | 'google' | 'qq') => {
    setLoading(true)
    try {
      const { error } = await signInWithOAuth(provider)
      if (error) {
        setError(error.message)
      } else if (provider !== 'qq') {
        // QQ登录会跳转，不需要关闭模态框
        onClose()
        resetForm()
      }
    } catch (err) {
      setError('OAuth 登录失败')
    } finally {
      if (provider !== 'qq') {
        setLoading(false)
      }
    }
  }

  const resetForm = () => {
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setDisplayName('')
    setError('')
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-white/20 backdrop-blur-sm dark:bg-black/20" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all dark:bg-gray-800">
                <div className="mb-4 flex items-center justify-between">
                  <Dialog.Title
                    as="h3"
                    className="text-lg leading-6 font-medium text-gray-900 dark:text-white"
                  >
                    {activeTab === 'login' ? '登录' : '注册'}
                  </Dialog.Title>
                  <button
                    onClick={handleClose}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {/* Tab 切换 */}
                <div className="mb-6 flex rounded-lg bg-gray-100 p-1 dark:bg-gray-700">
                  <button
                    onClick={() => setActiveTab('login')}
                    className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                      activeTab === 'login'
                        ? 'bg-white text-gray-900 shadow dark:bg-gray-600 dark:text-white'
                        : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                    }`}
                  >
                    登录
                  </button>
                  <button
                    onClick={() => setActiveTab('register')}
                    className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                      activeTab === 'register'
                        ? 'bg-white text-gray-900 shadow dark:bg-gray-600 dark:text-white'
                        : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                    }`}
                  >
                    注册
                  </button>
                </div>

                {/* OAuth 登录 */}
                <div className="mb-6 space-y-3">
                  <button
                    onClick={() => handleOAuthLogin('github')}
                    disabled={loading}
                    className="flex w-full items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                  >
                    <svg className="mr-2 h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    使用 GitHub 登录
                  </button>

                  <button
                    onClick={() => handleOAuthLogin('qq')}
                    disabled={loading}
                    className="flex w-full items-center justify-center rounded-md border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 shadow-sm hover:bg-blue-100 disabled:opacity-50 dark:border-blue-600 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/30"
                  >
                    <Image
                      src="/static/images/qq_login.png"
                      alt="QQ"
                      width={20}
                      height={20}
                      className="mr-2"
                    />
                    使用 QQ 登录
                  </button>
                </div>

                <div className="relative mb-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300 dark:border-gray-600" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="bg-white px-2 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                      或
                    </span>
                  </div>
                </div>

                {/* 表单 */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  {activeTab === 'register' && (
                    <div>
                      <label
                        htmlFor="displayName"
                        className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        显示名称
                      </label>
                      <input
                        id="displayName"
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="focus:ring-primary-500 focus:border-primary-500 w-full rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:ring-2 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
                        placeholder="请输入显示名称"
                      />
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="email"
                      className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      邮箱地址
                    </label>
                    <input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="focus:ring-primary-500 focus:border-primary-500 w-full rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:ring-2 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
                      placeholder="请输入邮箱地址"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="password"
                      className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      密码
                    </label>
                    <input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="focus:ring-primary-500 focus:border-primary-500 w-full rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:ring-2 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
                      placeholder="请输入密码"
                      minLength={6}
                    />
                  </div>

                  {activeTab === 'register' && (
                    <div>
                      <label
                        htmlFor="confirmPassword"
                        className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        确认密码
                      </label>
                      <input
                        id="confirmPassword"
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="focus:ring-primary-500 focus:border-primary-500 w-full rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:ring-2 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-500"
                        placeholder="请再次输入密码"
                        minLength={6}
                      />
                    </div>
                  )}

                  {error && <div className="text-sm text-red-600 dark:text-red-400">{error}</div>}

                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-primary-600 hover:bg-primary-700 focus:ring-primary-500 flex w-full justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white shadow-sm focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
                    ) : activeTab === 'login' ? (
                      '登录'
                    ) : (
                      '注册'
                    )}
                  </button>

                  {activeTab === 'login' && (
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => setShowPasswordReset(true)}
                        className="text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300 text-sm"
                      >
                        忘记密码？
                      </button>
                    </div>
                  )}
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>

      <PasswordResetModal isOpen={showPasswordReset} onClose={() => setShowPasswordReset(false)} />
    </Transition>
  )
}
