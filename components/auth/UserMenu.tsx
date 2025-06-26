'use client'

import { useState, Fragment } from 'react'
import { Menu, Transition } from '@headlessui/react'
import {
  ChevronDownIcon,
  UserIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline'
import { useAuth } from './AuthProvider'
import { UserAvatar } from './UserAvatar'
import { AuthModal } from './AuthModal'
import { useRouter } from 'next/navigation'

interface UserMenuProps {
  className?: string
}

export function UserMenu({ className = '' }: UserMenuProps) {
  const { user, signOut, loading } = useAuth()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authModalTab, setAuthModalTab] = useState<'login' | 'register'>('login')
  const router = useRouter()

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  const handleShowLogin = () => {
    setAuthModalTab('login')
    setShowAuthModal(true)
  }

  const handleShowRegister = () => {
    setAuthModalTab('register')
    setShowAuthModal(true)
  }

  if (loading) {
    return (
      <div className={`flex items-center ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 w-8 rounded-full bg-gray-300 dark:bg-gray-600"></div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <>
        <div className={`flex items-center space-x-2 ${className}`}>
          <button
            onClick={handleShowLogin}
            className="text-sm text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
          >
            登录
          </button>
          <span className="text-gray-400 dark:text-gray-500">|</span>
          <button
            onClick={handleShowRegister}
            className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 text-sm transition-colors"
          >
            注册
          </button>
        </div>

        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          defaultTab={authModalTab}
        />
      </>
    )
  }

  return (
    <Menu as="div" className={`relative inline-block text-left ${className}`}>
      <div>
        <Menu.Button className="focus:ring-primary-500 flex items-center space-x-2 rounded-full text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none dark:focus:ring-offset-gray-800">
          <UserAvatar user={user} size="md" />
          <span className="hidden font-medium text-gray-700 sm:block dark:text-gray-300">
            {user.display_name || user.username || '用户'}
          </span>
          <ChevronDownIcon className="h-4 w-4 text-gray-400" />
        </Menu.Button>
      </div>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="ring-opacity-5 absolute right-0 mt-2 w-56 origin-top-right divide-y divide-gray-100 rounded-md bg-white shadow-lg ring-1 ring-black focus:outline-none dark:divide-gray-700 dark:bg-gray-800">
          <div className="px-4 py-3">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {user.display_name || user.username || '用户'}
            </p>
            <p className="truncate text-sm text-gray-500 dark:text-gray-400">
              {user.email || '未设置邮箱'}
            </p>
          </div>

          <div className="py-1">
            <Menu.Item>
              {({ active }) => (
                <button
                  className={`${
                    active
                      ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
                      : 'text-gray-700 dark:text-gray-300'
                  } group flex w-full items-center px-4 py-2 text-sm`}
                  onClick={() => router.push('/profile')}
                >
                  <UserIcon className="mr-3 h-4 w-4" aria-hidden="true" />
                  个人资料
                </button>
              )}
            </Menu.Item>

            <Menu.Item>
              {({ active }) => (
                <button
                  className={`${
                    active
                      ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
                      : 'text-gray-700 dark:text-gray-300'
                  } group flex w-full items-center px-4 py-2 text-sm`}
                  onClick={() => {
                    // TODO: 实现设置页面
                    console.log('Navigate to settings')
                  }}
                >
                  <Cog6ToothIcon className="mr-3 h-4 w-4" aria-hidden="true" />
                  设置
                </button>
              )}
            </Menu.Item>
          </div>

          <div className="py-1">
            <Menu.Item>
              {({ active }) => (
                <button
                  className={`${
                    active
                      ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
                      : 'text-gray-700 dark:text-gray-300'
                  } group flex w-full items-center px-4 py-2 text-sm`}
                  onClick={handleSignOut}
                >
                  <ArrowRightOnRectangleIcon className="mr-3 h-4 w-4" aria-hidden="true" />
                  退出登录
                </button>
              )}
            </Menu.Item>
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  )
}
